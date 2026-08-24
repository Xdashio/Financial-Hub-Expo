import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

const FOOD_POCKET = {
  id: 'pocket-food',
  plan_id: 'plan-1',
  name: 'Food & Groceries',
  kind: 'spendable',
  category: 'food',
  is_time_locked: false,
  lock_until: null,
  monthly_allocation: 10000,
  daily_cap: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const LEISURE_POCKET = {
  ...FOOD_POCKET,
  id: 'pocket-leisure',
  name: 'Personal & Leisure',
  category: 'leisure',
};

const PLAN = { id: 'plan-1', user_id: 'user-1' };

const SPEND_TX = {
  id: 'tx-1',
  pocket_id: 'pocket-leisure',
  amount: 500,
  type: 'spend' as const,
  merchant: 'Naivas Till',
  category: 'other' as const,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('MerchantService.classify', () => {
  let repository: jest.Mocked<
    Pick<
      SupabaseRepository,
      | 'getPocketById'
      | 'getPlanById'
      | 'upsertMerchantClassification'
      | 'getTransactionById'
      | 'getPocketSummary'
      | 'updateTransaction'
      | 'getMerchantClassificationsByUserId'
      | 'getMerchantClassificationById'
      | 'deleteMerchantClassification'
    >
  >;
  let service: MerchantService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockImplementation(async (id: string) => {
        if (id === FOOD_POCKET.id) return FOOD_POCKET;
        if (id === LEISURE_POCKET.id) return LEISURE_POCKET;
        return null;
      }),
      getPlanById: jest.fn().mockResolvedValue(PLAN),
      upsertMerchantClassification: jest.fn().mockImplementation(async (row) => ({
        id: 'class-1',
        created_at: '2026-01-01T00:00:00.000Z',
        ...row,
      })),
      getTransactionById: jest.fn().mockResolvedValue(SPEND_TX),
      getPocketSummary: jest.fn().mockResolvedValue({
        allocated: 10000,
        spent: 0,
        available: 10000,
        transactionCount: 0,
        reallocationCount: 0,
      }),
      updateTransaction: jest.fn().mockImplementation(async (id, updates) => ({
        ...SPEND_TX,
        id,
        ...updates,
      })),
      getMerchantClassificationsByUserId: jest.fn().mockResolvedValue([]),
      getMerchantClassificationById: jest.fn(),
      deleteMerchantClassification: jest.fn(),
    } as any;

    service = new MerchantService(repository as unknown as SupabaseRepository);
  });

  it('persists pocket_id on the classification upsert', async () => {
    const result = await service.classify(
      {
        recipient_key: 'Naivas Till',
        category: 'grocery',
        pocket_id: FOOD_POCKET.id,
        remember: true,
      },
      'user-1',
    );

    expect(repository.upsertMerchantClassification).toHaveBeenCalledWith({
      user_id: 'user-1',
      recipient_key: 'Naivas Till',
      category: 'grocery',
      pocket_id: FOOD_POCKET.id,
      remember: true,
    });
    expect(result.classification.pocket_id).toBe(FOOD_POCKET.id);
    expect(result.transaction_updated).toBeUndefined();
    expect(repository.updateTransaction).not.toHaveBeenCalled();
  });

  it('rejects categories the target pocket blocks', async () => {
    await expect(
      service.classify(
        {
          recipient_key: 'BetKing',
          category: 'gambling_betting',
          pocket_id: FOOD_POCKET.id,
          remember: true,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.upsertMerchantClassification).not.toHaveBeenCalled();
  });

  it('updates the transaction category and pocket when transaction_id is provided', async () => {
    const result = await service.classify(
      {
        recipient_key: 'Naivas Till',
        category: 'grocery',
        pocket_id: FOOD_POCKET.id,
        remember: true,
        transaction_id: SPEND_TX.id,
      },
      'user-1',
    );

    expect(repository.updateTransaction).toHaveBeenCalledWith(SPEND_TX.id, {
      category: 'grocery',
      pocket_id: FOOD_POCKET.id,
    });
    expect(result.transaction_updated).toEqual({
      id: SPEND_TX.id,
      category: 'grocery',
      pocket_id: FOOD_POCKET.id,
    });
  });

  it('blocks moving a spend into a pocket without enough available balance', async () => {
    repository.getPocketSummary.mockResolvedValue({
      allocated: 200,
      spent: 0,
      available: 200,
      transactionCount: 0,
      reallocationCount: 0,
    });

    await expect(
      service.classify(
        {
          recipient_key: 'Naivas Till',
          category: 'grocery',
          pocket_id: FOOD_POCKET.id,
          remember: true,
          transaction_id: SPEND_TX.id,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.updateTransaction).not.toHaveBeenCalled();
  });

  it('does not require a balance check when the pocket stays the same', async () => {
    repository.getTransactionById.mockResolvedValue({
      ...SPEND_TX,
      pocket_id: FOOD_POCKET.id,
      emergency_unlock_id: null,
          daily_allocation_id: null,
    });

    await service.classify(
      {
        recipient_key: 'Naivas Till',
        category: 'grocery',
        pocket_id: FOOD_POCKET.id,
        remember: true,
        transaction_id: SPEND_TX.id,
      },
      'user-1',
    );

    expect(repository.getPocketSummary).not.toHaveBeenCalled();
    expect(repository.updateTransaction).toHaveBeenCalled();
  });

  it('rejects reclassify of non-spend transactions', async () => {
    repository.getTransactionById.mockResolvedValue({
      ...SPEND_TX,
      type: 'allocation',
      emergency_unlock_id: null,
          daily_allocation_id: null,
    });

    await expect(
      service.classify(
        {
          recipient_key: 'Naivas Till',
          category: 'grocery',
          pocket_id: FOOD_POCKET.id,
          remember: true,
          transaction_id: SPEND_TX.id,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects pockets the user does not own', async () => {
    repository.getPlanById.mockResolvedValue({ id: 'plan-1', user_id: 'other-user' } as any);

    await expect(
      service.classify(
        {
          recipient_key: 'Naivas Till',
          category: 'grocery',
          pocket_id: FOOD_POCKET.id,
          remember: true,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 when the pocket is missing', async () => {
    repository.getPocketById.mockResolvedValue(null);

    await expect(
      service.classify(
        {
          recipient_key: 'Naivas Till',
          category: 'grocery',
          pocket_id: 'missing',
          remember: true,
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MerchantService.getClassifications', () => {
  let repository: jest.Mocked<
    Pick<SupabaseRepository, 'getMerchantClassificationsByUserId' | 'getPocketById'>
  >;
  let service: MerchantService;

  beforeEach(() => {
    repository = {
      getMerchantClassificationsByUserId: jest.fn().mockResolvedValue([
        {
          id: 'class-1',
          user_id: 'user-1',
          recipient_key: 'Naivas Till',
          category: 'grocery',
          pocket_id: FOOD_POCKET.id,
          remember: true,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
      getPocketById: jest.fn().mockResolvedValue(FOOD_POCKET),
    } as any;
    service = new MerchantService(repository as unknown as SupabaseRepository);
  });

  it('enriches classifications with the persisted pocket name', async () => {
    const result = await service.getClassifications('user-1');

    expect(result.classifications[0]).toMatchObject({
      pocket_id: FOOD_POCKET.id,
      pocket_name: FOOD_POCKET.name,
      category: 'grocery',
    });
  });
});
