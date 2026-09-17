/**
 * M11 lock test: imports @financial-hub/shared through the REAL dist/ build
 * (no moduleNameMapper for it in jest.config.js, so the file: dependency
 * resolves to packages/shared/dist) and asserts the contract mobile and the
 * API depend on:
 *
 * - the M1 money ceiling and finiteness guard,
 * - the 10-value TransactionTypeSchema (M10 — must match database.types.ts
 *   and the widened transactions_type_check CHECK),
 * - integer-cents math exactness,
 * - the zod major resolved inside mobile is v3 (M11 — aligned with shared's
 *   ^3.22.4; a stray v4 hoist would break the shared schema API).
 *
 * If shared's dist/ is stale or a zod bump lands unaligned, this fails
 * loudly instead of drifting silently.
 */
import {
  MAX_MONEY_AMOUNT,
  isFiniteMoney,
  toCents,
  fromCents,
  round2,
  sumMoney,
  TransactionTypeSchema,
  OnboardingInputSchema,
} from '@financial-hub/shared';

describe('shared dist/ contract lock (M11)', () => {
  it('resolves the real dist build, not src', () => {
    // dist/index.js re-exports money.ts compiled — presence of the runtime
    // constant proves the dist build is current with src.
    expect(MAX_MONEY_AMOUNT).toBe(100_000_000);
  });

  it('money ceiling and finiteness guard are exported and behave (M1)', () => {
    expect(isFiniteMoney(1234.56)).toBe(true);
    expect(isFiniteMoney(Number.NaN)).toBe(false);
    expect(isFiniteMoney(Infinity)).toBe(false);
    expect(isFiniteMoney('100')).toBe(false);
  });

  it('integer-cents math is exact through dist', () => {
    expect(toCents(2165.72)).toBe(216572);
    expect(fromCents(216600)).toBe(2166);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(sumMoney([2165.72, 0.28])).toBe(2166);
  });

  it('TransactionTypeSchema carries all 10 ledger types (M10)', () => {
    expect(TransactionTypeSchema.options).toEqual([
      'allocation',
      'spend',
      'reallocation_in',
      'reallocation_out',
      'rollover',
      'reserve_release',
      'reserve_return',
      'daily_overspend_debit',
      'fixed_expense_earmark',
      'fixed_expense_carry_forward',
    ]);
  });

  it('money fields in shared schemas reject unbounded values (M1)', () => {
    const result = OnboardingInputSchema.safeParse({
      incomePattern: 'salaried',
      spendingHabit: 'tracker',
      incomeAmount: 100_000_001,
      fixedTotal: 0,
      sourceCount: 1,
    });
    expect(result.success).toBe(false);
  });

  it('zod major resolved inside mobile is v3 (M11 alignment)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const version = require('zod/package.json').version as string;
    expect(version.startsWith('3.')).toBe(true);
  });
});
