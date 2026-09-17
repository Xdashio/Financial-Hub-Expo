import { formatMoney, MONEY_CURRENCY_LABEL } from './money';

describe('formatMoney (mobile harness spike)', () => {
  it('uses the shared whole-shilling KSh formatter by default', () => {
    expect(formatMoney(2166.4)).toBe('KSh 2,166');
    expect(formatMoney(-2166.4)).toBe('-KSh 2,166');
  });

  it('keeps exact decimals when rounded is explicitly false', () => {
    expect(formatMoney(1234.56, { rounded: false })).toBe('KSh 1,234.56');
  });

  it('exports the canonical currency label', () => {
    expect(MONEY_CURRENCY_LABEL).toBe('KSh');
  });
});
