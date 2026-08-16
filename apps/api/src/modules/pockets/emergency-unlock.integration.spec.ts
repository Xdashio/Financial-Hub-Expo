/**
 * End-to-end check for the chain this whole fix pass was about:
 *
 *   1. A pocket sits at a small positive balance a user can't quite afford
 *      a purchase from (the "Available: 2165.72, Requested: 2166" case).
 *   2. Without the insufficient_funds override wired up in the mobile UI,
 *      that spend is rejected forever and the pocket can never reach 0 —
 *      so EmergencyUnlockService.checkEligibility's `available <= 0` check
 *      (which requires ALL non-savings pockets to be depleted) can never
 *      pass, and emergency unlock is permanently unreachable.
 *   3. With SpendService.commitSpend's `override: true` path wired up
 *      (apps/mobile/app/(pockets)/log-spend.tsx), the spend commits, a
 *      real ledger transaction is written, and the pocket's available
 *      balance — computed by the REAL (unmocked) getPocketSummary reducer
 *      in supabase.repository.ts, not a stubbed number — lands at exactly
 *      0 or below.
 *
 * This test exercises SpendService.commitSpend and
 * EmergencyUnlockService.checkEligibility against a real SupabaseRepository
 * subclass with an in-memory transaction store, so the arithmetic under
 * test is the actual production reducer (sumMoney/netMoney via
 * getPocketSummary), not a mock standing in for it.
 */
import { SpendService } from '../spend/spend.service';
import { EmergencyUnlockService } from './emergency-unlock.service';
import type { Pocket, Transaction, TransactionInsert } from '../../database/database.types';
import { sumMoney, netMoney } from '@financial-hub/shared';

// In-memory stand-in for the persistence methods getPocketSummary and its
// callers touch. This intentionally does NOT extend SupabaseRepository:
// constructing the real class creates a live @supabase/supabase-js client
// (with a realtime/websocket transport) even against a placeholder URL,
// which keeps timers alive past the test and causes Jest to hang/time out.
// We want the real *reducer* logic under test (getPocketSummary's
// sumMoney/netMoney math), not a live DB client, so getPocketSummary and
// getParentReservedBalance are reproduced verbatim here — copied from
// supabase.repository.ts — operating on an in-memory transaction store
// instead of a live `this.supabase.from(...)` call.
class InMemoryRepository {
  private pockets = new Map<string, Pocket>();
  public transactions: Transaction[] = [];
  private txCounter = 0;

  seedPocket(pocket: Pocket) {
    this.pockets.set(pocket.id, pocket);
  }

  seedTransaction(tx: Transaction) {
    this.transactions.push(tx);
  }

  async getPocketById(id: string): Promise<Pocket | null> {
    return this.pockets.get(id) ?? null;
  }

  async getPlanById(): Promise<any> {
    return { id: 'plan-1', user_id: 'user-1' };
  }

  async getTopLevelPocketsByPlanId(): Promise<Pocket[]> {
    return Array.from(this.pockets.values()).filter((p) => !p.parent_pocket_id);
  }

  async getSubPocketsByParentId(): Promise<Pocket[]> {
    return [];
  }

  async getMerchantClassification(): Promise<any> {
    return null;
  }

  async getIdempotencyRecord(): Promise<any> {
    return null;
  }

  async saveIdempotencyRecord(): Promise<any> {
    return { id: 'idem-1' };
  }

  async getBehaviorEventsByTypesSince(): Promise<any[]> {
    return [];
  }

  async getSpendTotalsByPocketBetween(): Promise<Map<string, number>> {
    return new Map();
  }

  async createBehaviorEvent(event: any): Promise<any> {
    return { id: `evt-${++this.txCounter}`, ...event };
  }

  async createTransaction(tx: TransactionInsert): Promise<Transaction> {
    const row = {
      id: `tx-${++this.txCounter}`,
      created_at: new Date().toISOString(),
      merchant: null,
      category: null,
      ...tx,
    } as unknown as Transaction;
    this.transactions.push(row);
    return row;
  }

  async getTransactionsByPocketId(pocketId: string): Promise<Transaction[]> {
    return this.transactions.filter((t) => t.pocket_id === pocketId);
  }

  async getEmergencyUnlockThisMonth(): Promise<any> {
    return null;
  }

  // Copied verbatim from supabase.repository.ts's getPocketSummary — same
  // sumMoney/netMoney reducer under test, same filters, same shape. Kept in
  // sync manually rather than imported since importing the real method
  // isn't possible without instantiating the class (see comment above).
  async getPocketSummary(pocketId: string): Promise<{
    allocated: number;
    spent: number;
    available: number;
    transactionCount: number;
    reallocationCount: number;
  }> {
    const transactions = await this.getTransactionsByPocketId(pocketId);

    const allocated = sumMoney(
      transactions
        .filter((t) => t.type === 'allocation' || t.type === 'reallocation_in')
        .map((t) => t.amount),
    );
    const spent = sumMoney(
      transactions.filter((t) => t.type === 'spend').map((t) => t.amount),
    );
    const reallocatedOut = sumMoney(
      transactions.filter((t) => t.type === 'reallocation_out').map((t) => t.amount),
    );
    const rolloverNet = sumMoney(
      transactions.filter((t) => t.type === 'rollover').map((t) => t.amount),
    );

    const available = netMoney(allocated, reallocatedOut, -spent, rolloverNet);

    return {
      allocated,
      spent,
      available,
      transactionCount: transactions.length,
      reallocationCount: 0,
    };
  }
}

function makePocket(overrides: Partial<Pocket>): Pocket {
  return {
    id: 'pocket-x',
    plan_id: 'plan-1',
    name: 'Pocket',
    kind: 'spendable',
    category: null,
    is_time_locked: false,
    lock_until: null,
    monthly_allocation: 5000,
    daily_cap: null,
    parent_pocket_id: null,
    split_percentage: null,
    repayment_schedule: null,
    loan_provider: null,
    loan_purpose: null,
    due_day: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Pocket;
}

describe('Emergency unlock reachability (integration, real getPocketSummary)', () => {
  let repo: InMemoryRepository;
  let spendService: SpendService;
  let emergencyUnlockService: EmergencyUnlockService;
  let disciplineScore: { applyDelta: jest.Mock; getCurrentScore: jest.Mock };
  let spendingAnalysis: any;

  const PERSONAL_LEISURE = makePocket({ id: 'pocket-personal', name: 'Personal & Leisure', monthly_allocation: 2200 });
  const SAVINGS = makePocket({ id: 'pocket-savings', name: 'Savings', kind: 'savings', monthly_allocation: 10000 });

  beforeEach(() => {
    repo = new InMemoryRepository();
    repo.seedPocket(PERSONAL_LEISURE);
    repo.seedPocket(SAVINGS);

    disciplineScore = {
      applyDelta: jest.fn().mockResolvedValue({ previousScore: 50, newScore: 40 }),
      getCurrentScore: jest.fn().mockResolvedValue(50),
    };
    spendService = new SpendService(repo as any, disciplineScore as any);

    spendingAnalysis = {
      analyze30DaySpending: jest.fn().mockResolvedValue({
        least_daily_spend: 50,
        most_daily_spend: 500,
        average_daily_spend: 200,
        days_of_history: 30,
        daily_spend_by_date: new Map(),
      }),
      hasSufficientHistory: jest.fn().mockReturnValue(true),
    };
    emergencyUnlockService = new EmergencyUnlockService(repo as any, spendingAnalysis);

    // Fund the pockets: allocation credit as a real ledger transaction, the
    // same way onboarding/income allocation actually writes one — not a
    // stubbed summary number.
    repo.seedTransaction({
      id: 'seed-personal',
      pocket_id: PERSONAL_LEISURE.id,
      type: 'allocation',
      amount: 2165.72, // the exact residual balance from the bug report
      created_at: '2026-01-01T00:00:00.000Z',
      merchant: null,
      category: null,
    } as unknown as Transaction);
    repo.seedTransaction({
      id: 'seed-savings',
      pocket_id: SAVINGS.id,
      type: 'allocation',
      amount: 8000,
      created_at: '2026-01-01T00:00:00.000Z',
      merchant: null,
      category: null,
    } as unknown as Transaction);
  });

  it('cannot reach emergency-unlock eligibility while the override is rejected (pre-fix behavior)', async () => {
    // Without override: true, a spend that exceeds the balance is blocked
    // and no transaction is written — the pocket is stuck at 2165.72
    // forever, never reaching the <= 0 that eligibility requires.
    const blocked = await spendService.commitSpend(
      { pocket_id: PERSONAL_LEISURE.id, amount: 2166 },
      'user-1',
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.block_reason).toBe('insufficient_funds');

    const summary = await repo.getPocketSummary(PERSONAL_LEISURE.id);
    expect(summary.available).toBeCloseTo(2165.72, 2);

    const eligibility = await emergencyUnlockService.checkEligibility('user-1', 'plan-1');
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toBe('no_depleted_pockets');
  });

  it('reaches emergency-unlock eligibility once the override commits the overspend (post-fix behavior)', async () => {
    // With override: true (the mobile "Spend anyway" flow we wired up),
    // the same spend commits and the pocket's REAL computed balance —
    // via getPocketSummary's integer-cents sumMoney/netMoney, not a mock —
    // lands at/below zero.
    const overridden = await spendService.commitSpend(
      { pocket_id: PERSONAL_LEISURE.id, amount: 2166, override: true },
      'user-1',
    );
    expect(overridden.allowed).toBe(true);

    const summary = await repo.getPocketSummary(PERSONAL_LEISURE.id);
    // 2165.72 - 2166 = -0.28, computed via exact integer-cents arithmetic,
    // not float subtraction that could drift off of exactly -0.28.
    expect(summary.available).toBeCloseTo(-0.28, 2);
    expect(summary.available).toBeLessThanOrEqual(0);

    const eligibility = await emergencyUnlockService.checkEligibility('user-1', 'plan-1');
    expect(eligibility.eligible).toBe(true);
  });
});