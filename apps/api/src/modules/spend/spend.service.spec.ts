import { SpendService } from './spend.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

const SPENDABLE_POCKET = {
  id: 'pocket-1',
  plan_id: 'plan-1',
  name: 'Groceries & food',
  kind: 'spendable',
  category: null,
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 5000,
  daily_cap: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const FIXED_POCKET = {
  ...SPENDABLE_POCKET,
  id: 'pocket-fixed',
  name: 'Rent',
  kind: 'fixed',
};

// SPENDABLE_POCKET carries monthly_allocation: 5000, but that field is a
// planning ceiling only — see supabase.repository.ts getPocketSummary.
// Available balance is always ledger-derived, so every test here drives
// balance purely through the getPocketSummary mock, not monthly_allocation
// or getTransactionsByPocketId (spend.service.ts no longer touches that
// directly; it calls repository.getPocketSummary(dto.pocket_id) and reads
// .available — see e9924bb "Ledger balance calculation in repository").
function makePocketSummary(overrides: Partial<{
  allocated: number;
  spent: number;
  available: number;
  transactionCount: number;
  reallocationCount: number;
}> = {}) {
  return {
    allocated: 5000,
    spent: 0,
    available: 5000,
    transactionCount: 0,
    reallocationCount: 0,
    ...overrides,
  };
}

describe('SpendService.commitSpend', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPocketById'
      | 'getPlanById'
      | 'getPocketSummary'
      | 'getMerchantClassification'
      | 'createTransaction'
    >
  >;
  let service: SpendService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(SPENDABLE_POCKET),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      getPocketSummary: jest.fn().mockResolvedValue(makePocketSummary()),
      getMerchantClassification: jest.fn().mockResolvedValue(null),
      createTransaction: jest.fn().mockImplementation((tx) => ({ id: 'tx-1', ...tx })),
    } as any;
    service = new SpendService(repository as unknown as SupabaseRepository);
  });

  it('writes a spend transaction when the check allows it', async () => {
    const result = await service.commitSpend(
      { pocket_id: 'pocket-1', amount: 500, category: 'grocery' },
      'user-1'
    );

    expect(result.allowed).toBe(true);
    expect(repository.createTransaction).toHaveBeenCalledWith({
      pocket_id: 'pocket-1',
      amount: 500,
      type: 'spend',
      merchant: null,
      category: 'grocery',
    });
    expect(result.transaction_id).toBe('tx-1');
  });

  it('does not write a transaction when the amount exceeds available balance', async () => {
    // Ledger-derived available balance is 200 (regardless of the pocket's
    // monthly_allocation ceiling of 5000).
    repository.getPocketSummary.mockResolvedValue(makePocketSummary({ allocated: 5000, spent: 4800, available: 200 }));

    const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('insufficient_funds');
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  it('does not write a transaction when the category is blocked for the pocket', async () => {
    repository.getPocketById.mockResolvedValue(FIXED_POCKET as any);

    const result = await service.commitSpend(
      { pocket_id: 'pocket-fixed', amount: 500, category: 'gambling_betting' },
      'user-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('blocked_category');
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  it('does not write a transaction for an unclassified recipient', async () => {
    const result = await service.commitSpend(
      { pocket_id: 'pocket-1', amount: 500, recipient_key: 'Juma K.' },
      'user-1'
    );

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('unclassified_merchant');
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  it('does not write a transaction when the pocket is time-locked, and still reports available balance', async () => {
    const LOCKED_POCKET = {
      ...SPENDABLE_POCKET,
      is_time_locked: true,
      lock_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1hr in the future
    };
    repository.getPocketById.mockResolvedValue(LOCKED_POCKET as any);
    repository.getPocketSummary.mockResolvedValue(makePocketSummary({ available: 3000 }));

    const result = await service.commitSpend({ pocket_id: 'pocket-1', amount: 500 }, 'user-1');

    expect(result.allowed).toBe(false);
    expect(result.block_reason).toBe('pocket_time_locked');
    expect(result.pocket.available_balance).toBe(3000);
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });
});