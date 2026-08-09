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

describe('SpendService.commitSpend', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPocketById'
      | 'getPlanById'
      | 'getTransactionsByPocketId'
      | 'getMerchantClassification'
      | 'createTransaction'
    >
  >;
  let service: SpendService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(SPENDABLE_POCKET),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      getTransactionsByPocketId: jest.fn().mockResolvedValue([]),
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
    repository.getTransactionsByPocketId.mockResolvedValue([
      { id: 't1', pocket_id: 'pocket-1', amount: 4800, type: 'spend', merchant: null, category: null, created_at: '' },
    ] as any);

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
});