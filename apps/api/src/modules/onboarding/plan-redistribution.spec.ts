import {
  nextRetakeAvailableOn,
  planBalanceRedistribution,
  sameUtcMonth,
  type RedistributionSource,
  type RedistributionTarget,
} from './plan-redistribution';

const source = (
  partial: Partial<RedistributionSource> & Pick<RedistributionSource, 'id' | 'name' | 'kind' | 'available'>,
): RedistributionSource => ({
  category: null,
  ...partial,
});

const target = (
  partial: Partial<RedistributionTarget> & Pick<RedistributionTarget, 'id' | 'name' | 'kind' | 'monthlyAllocation'>,
): RedistributionTarget => ({
  category: null,
  ...partial,
});

describe('planBalanceRedistribution', () => {
  it('returns no movements when sources are empty or zero-balance', () => {
    const targets = [
      target({ id: 't-food', name: 'Food', kind: 'spendable', category: 'food', monthlyAllocation: 1000 }),
    ];
    expect(planBalanceRedistribution([], targets)).toEqual([]);
    expect(
      planBalanceRedistribution(
        [source({ id: 's1', name: 'Food', kind: 'spendable', category: 'food', available: 0 })],
        targets,
      ),
    ).toEqual([]);
  });

  it('matches same kind + category first', () => {
    const movements = planBalanceRedistribution(
      [source({ id: 's-food', name: 'Old Food', kind: 'spendable', category: 'food', available: 500 })],
      [
        target({ id: 't-food', name: 'Food', kind: 'spendable', category: 'food', monthlyAllocation: 1000 }),
        target({ id: 't-leis', name: 'Leisure', kind: 'spendable', category: 'leisure', monthlyAllocation: 1000 }),
      ],
    );

    expect(movements).toEqual([
      expect.objectContaining({
        fromPocketId: 's-food',
        toPocketId: 't-food',
        amount: 500,
        reason: 'category_match',
      }),
    ]);
  });

  it('falls back to same-kind proportional split when category differs', () => {
    const movements = planBalanceRedistribution(
      [source({ id: 's-other', name: 'Misc', kind: 'spendable', category: 'other', available: 300 })],
      [
        target({ id: 't-food', name: 'Food', kind: 'spendable', category: 'food', monthlyAllocation: 2000 }),
        target({ id: 't-trans', name: 'Transport', kind: 'spendable', category: 'transport', monthlyAllocation: 1000 }),
      ],
    );

    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.reason === 'kind_match')).toBe(true);
    expect(movements.reduce((s, m) => s + m.amount, 0)).toBeCloseTo(300);
    const food = movements.find((m) => m.toPocketId === 't-food')!;
    const trans = movements.find((m) => m.toPocketId === 't-trans')!;
    expect(food.amount).toBeCloseTo(200);
    expect(trans.amount).toBeCloseTo(100);
  });

  it('spills unmatched kinds into Savings', () => {
    const movements = planBalanceRedistribution(
      [source({ id: 's-fixed', name: 'Fixed', kind: 'fixed', available: 1200 })],
      [
        target({ id: 't-save', name: 'Savings', kind: 'savings', monthlyAllocation: 500 }),
        target({ id: 't-food', name: 'Food', kind: 'spendable', category: 'food', monthlyAllocation: 1000 }),
      ],
    );

    expect(movements).toEqual([
      expect.objectContaining({
        fromPocketId: 's-fixed',
        toPocketId: 't-save',
        amount: 1200,
        reason: 'spillover',
      }),
    ]);
  });

  it('matches same-named fixed pockets before proportional kind split', () => {
    const movements = planBalanceRedistribution(
      [
        source({ id: 's-rent', name: 'Rent', kind: 'fixed', category: 'housing', available: 800 }),
        source({ id: 's-net', name: 'Internet', kind: 'fixed', category: 'utilities', available: 200 }),
      ],
      [
        target({ id: 't-rent', name: 'Rent', kind: 'fixed', category: 'housing', monthlyAllocation: 10000 }),
        target({ id: 't-net', name: 'Internet', kind: 'fixed', category: 'utilities', monthlyAllocation: 2000 }),
      ],
    );

    expect(movements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fromPocketId: 's-rent', toPocketId: 't-rent', amount: 800 }),
        expect.objectContaining({ fromPocketId: 's-net', toPocketId: 't-net', amount: 200 }),
      ]),
    );
  });

  it('conserves total balance across many sources', () => {
    const sources = [
      source({ id: 's1', name: 'Food', kind: 'spendable', category: 'food', available: 100.01 }),
      source({ id: 's2', name: 'Transport', kind: 'spendable', category: 'transport', available: 50.5 }),
      source({ id: 's3', name: 'Fixed', kind: 'fixed', available: 999.99 }),
      source({ id: 's4', name: 'Savings', kind: 'savings', available: 10 }),
    ];
    const targets = [
      target({ id: 't1', name: 'Food', kind: 'spendable', category: 'food', monthlyAllocation: 1000 }),
      target({ id: 't2', name: 'Transport', kind: 'spendable', category: 'transport', monthlyAllocation: 1000 }),
      target({ id: 't3', name: 'Leisure', kind: 'spendable', category: 'leisure', monthlyAllocation: 1000 }),
      target({ id: 't4', name: 'Fixed', kind: 'fixed', monthlyAllocation: 5000 }),
      target({ id: 't5', name: 'Savings', kind: 'savings', monthlyAllocation: 500 }),
    ];

    const movements = planBalanceRedistribution(sources, targets);
    const totalIn = sources.reduce((s, x) => s + x.available, 0);
    const totalOut = movements.reduce((s, m) => s + m.amount, 0);
    expect(totalOut).toBeCloseTo(totalIn);
  });
});

describe('sameUtcMonth / nextRetakeAvailableOn', () => {
  it('detects same UTC month', () => {
    expect(sameUtcMonth('2026-08-01T12:00:00.000Z', new Date('2026-08-15T00:00:00.000Z'))).toBe(true);
    expect(sameUtcMonth('2026-07-31T23:00:00.000Z', new Date('2026-08-01T00:00:00.000Z'))).toBe(false);
  });

  it('returns the first day of the next UTC month', () => {
    expect(nextRetakeAvailableOn(new Date('2026-08-10T21:00:00.000Z'))).toBe('2026-09-01');
    expect(nextRetakeAvailableOn(new Date('2026-12-31T12:00:00.000Z'))).toBe('2027-01-01');
  });
});
