import { BadRequestException } from '@nestjs/common';
import { LoansService } from './loans.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import type { DisciplineScoreService } from '../discipline-score/discipline-score.service';

const PLAN = { id: 'plan-1', user_id: 'user-1' };

const LOAN_POCKET = {
  id: 'loan-1',
  plan_id: 'plan-1',
  name: 'School fees loan',
  kind: 'loan' as const,
  category: null,
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 3000,
  daily_cap: null,
  parent_pocket_id: null,
  loan_provider: 'M-Shwari',
  loan_purpose: 'School fees',
  due_day: 5,
  repayment_schedule: {
    totalAmount: 3000,
    repaymentAmount: 1000,
    cadence: 'monthly' as const,
    startDate: '2026-01-05',
    endDate: '2026-04-05',
    nextDueDate: '2026-02-05',
    totalPayments: 3,
    paymentsMade: 0,
  },
  created_at: '2026-01-05T00:00:00.000Z',
};

const REPAYMENT_SUB_POCKET = {
  id: 'sub-repayment-1',
  plan_id: 'plan-1',
  name: 'Repayment',
  kind: 'loan' as const, // inherits parent kind — this is the source of the leak bug
  category: 'other',
  is_time_locked: true,
  lock_until: null,
  monthly_allocation: 1000,
  daily_cap: null,
  parent_pocket_id: 'loan-1',
  created_at: '2026-01-05T00:00:00.000Z',
};

describe('LoansService', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPocketById'
      | 'getPlanById'
      | 'getActivePlanByUserId'
      | 'getTopLevelPocketsByPlanId'
      | 'getPocketsByPlanId'
      | 'getSubPocketsByParentId'
      | 'getPocketSummary'
      | 'createPocket'
      | 'updatePocket'
      | 'createTransaction'
      | 'createBehaviorEvent'
    >
  >;
  let disciplineScore: jest.Mocked<Pick<DisciplineScoreService, 'applyDelta'>>;
  let service: LoansService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(LOAN_POCKET),
      getPlanById: jest.fn().mockResolvedValue(PLAN),
      getActivePlanByUserId: jest.fn().mockResolvedValue(PLAN),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([LOAN_POCKET]),
      getPocketsByPlanId: jest.fn().mockResolvedValue([LOAN_POCKET, REPAYMENT_SUB_POCKET]),
      getSubPocketsByParentId: jest.fn().mockResolvedValue([REPAYMENT_SUB_POCKET]),
      getPocketSummary: jest.fn().mockResolvedValue({ available: 500 }),
      createPocket: jest.fn(),
      updatePocket: jest.fn().mockImplementation((id, updates) => ({ ...LOAN_POCKET, ...updates })),
      createTransaction: jest.fn().mockResolvedValue(undefined),
      createBehaviorEvent: jest.fn().mockResolvedValue(undefined),
    } as any;
    disciplineScore = { applyDelta: jest.fn() } as any;
    service = new LoansService(repository as unknown as SupabaseRepository, disciplineScore as unknown as DisciplineScoreService);
  });

  describe('fundRepayment (payments-tracking regression guard)', () => {
    // Code review 2026-08-13: this previously read/wrote `payments_made`
    // (snake_case) against a schedule object that only ever had
    // `paymentsMade` (camelCase) — `undefined + 1` produced NaN, which
    // silently broke "advance due date" and "loan fully repaid" checks,
    // and persisted as `null` once round-tripped through JSON into the
    // JSONB column. These tests pin the fix.
    it('increments paymentsMade (not payments_made) on the persisted schedule', async () => {
      await service.fundRepayment('loan-1', 'user-1', 1000);

      expect(repository.updatePocket).toHaveBeenCalledWith(
        'loan-1',
        expect.objectContaining({
          repayment_schedule: expect.objectContaining({ paymentsMade: 1 }),
        }),
      );
      const [, updates] = repository.updatePocket.mock.calls[0];
      const persistedSchedule = (updates as any).repayment_schedule;
      expect(persistedSchedule.payments_made).toBeUndefined();
      expect(Number.isNaN(persistedSchedule.paymentsMade)).toBe(false);
    });

    it('advances nextDueDate after a payment when more payments remain', async () => {
      await service.fundRepayment('loan-1', 'user-1', 1000);
      const [, updates] = repository.updatePocket.mock.calls[0];
      const persistedSchedule = (updates as any).repayment_schedule;
      // Started at 2026-02-05, monthly cadence — should have moved forward,
      // not stayed frozen (the NaN-comparison bug always evaluated false).
      expect(persistedSchedule.nextDueDate).not.toBe('2026-02-05');
    });

    it('marks the loan fully repaid once paymentsMade reaches totalPayments', async () => {
      const almostDone = {
        ...LOAN_POCKET,
        repayment_schedule: { ...LOAN_POCKET.repayment_schedule, paymentsMade: 2 }, // 1 payment left of 3
      };
      repository.getPocketById.mockResolvedValue(almostDone as any);

      await service.fundRepayment('loan-1', 'user-1', 1000);

      expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'loan_fully_repaid' }),
      );
      expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', 10);
    });
  });

  describe('getLoansForUser (sub-pocket leak regression guard)', () => {
    it('uses the top-level-only query, not the unfiltered one', async () => {
      await service.getLoansForUser('user-1');
      expect(repository.getTopLevelPocketsByPlanId).toHaveBeenCalledWith('plan-1');
      expect(repository.getPocketsByPlanId).not.toHaveBeenCalled();
    });

    it("does not list a loan's own Repayment sub-pocket as a separate loan", async () => {
      // getTopLevelPocketsByPlanId already excludes sub-pockets at the DB
      // level, so it never even sees REPAYMENT_SUB_POCKET here — this test
      // documents that guarantee rather than re-deriving it.
      const loans = await service.getLoansForUser('user-1');
      expect(loans).toHaveLength(1);
      expect(loans[0].id).toBe('loan-1');
    });
  });

  describe('createLoan validation', () => {
    it('rejects a repayment schedule whose math does not add up', async () => {
      await expect(
        service.createLoan('user-1', {
          name: 'Bad loan',
          totalAmount: 3000,
          repaymentAmount: 1000,
          cadence: 'monthly',
          startDate: '2026-01-05',
          endDate: '2026-02-05', // 1 month → 1 payment of 1000 ≠ totalAmount 3000
          dueDay: 5,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createPocket).not.toHaveBeenCalled();
    });
  });
});