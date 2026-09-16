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
      | 'fundLoanRepaymentAtomic'
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
      fundLoanRepaymentAtomic: jest.fn().mockResolvedValue({
        payments_made: 1,
        total_payments: 3,
        completed: false,
        previous_next_due_date: '2026-02-05',
        schedule: { ...LOAN_POCKET.repayment_schedule, paymentsMade: 1, nextDueDate: '2026-03-05' },
      }),
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
    it('advances paymentsMade through the atomic repayment claim (not payments_made)', async () => {
      await service.fundRepayment('loan-1', 'user-1', 1000);

      expect(repository.fundLoanRepaymentAtomic).toHaveBeenCalledWith(
        'loan-1',
        'user-1',
        1000,
        'sub-repayment-1',
        expect.any(String),
      );
      const [, , , , nextDueDate] = repository.fundLoanRepaymentAtomic.mock.calls[0];
      expect(nextDueDate).not.toBe('2026-02-05');
      expect(repository.createTransaction).not.toHaveBeenCalled();
      expect(repository.updatePocket).not.toHaveBeenCalled();
    });

    it('advances nextDueDate after a payment when more payments remain', async () => {
      await service.fundRepayment('loan-1', 'user-1', 1000);
      const [, , , , nextDueDate] = repository.fundLoanRepaymentAtomic.mock.calls[0];
      // Started at 2026-02-05, monthly cadence — should have moved forward,
      // not stayed frozen (the NaN-comparison bug always evaluated false).
      expect(nextDueDate).not.toBe('2026-02-05');
    });

    it('marks the loan fully repaid once paymentsMade reaches totalPayments', async () => {
      const almostDone = {
        ...LOAN_POCKET,
        repayment_schedule: { ...LOAN_POCKET.repayment_schedule, paymentsMade: 2 }, // 1 payment left of 3
      };
      repository.getPocketById.mockResolvedValue(almostDone as any);
      repository.fundLoanRepaymentAtomic.mockResolvedValue({
        payments_made: 3,
        total_payments: 3,
        completed: true,
        previous_next_due_date: '2026-04-05',
        schedule: { ...almostDone.repayment_schedule, paymentsMade: 3, fullyRepaid: true },
      });

      await service.fundRepayment('loan-1', 'user-1', 1000);

      expect(repository.fundLoanRepaymentAtomic).toHaveBeenCalledWith(
        'loan-1',
        'user-1',
        1000,
        'sub-repayment-1',
        null,
      );
      expect(repository.createBehaviorEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'loan_fully_repaid' }),
      );
      expect(disciplineScore.applyDelta).toHaveBeenCalledWith('user-1', 10);
    });

    it('rejects a second fundRepayment once the loan is already fully repaid (C5)', async () => {
      const repaid = {
        ...LOAN_POCKET,
        repayment_schedule: {
          ...LOAN_POCKET.repayment_schedule,
          paymentsMade: 3,
          fullyRepaid: true,
        },
      };
      repository.getPocketById.mockResolvedValue(repaid as any);

      await expect(service.fundRepayment('loan-1', 'user-1', 1000)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.fundLoanRepaymentAtomic).not.toHaveBeenCalled();
      expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
    });

    it('rejects when the atomic claim loses a concurrent final-payment race (C5)', async () => {
      repository.fundLoanRepaymentAtomic.mockResolvedValue(null);

      await expect(service.fundRepayment('loan-1', 'user-1', 1000)).rejects.toThrow(
        /already been fully repaid/,
      );
      expect(repository.createBehaviorEvent).not.toHaveBeenCalled();
      expect(disciplineScore.applyDelta).not.toHaveBeenCalled();
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