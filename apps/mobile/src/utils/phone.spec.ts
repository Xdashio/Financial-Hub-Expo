import { formatKenyanPhoneInput, isValidKenyanPhone, toE164Kenyan } from './phone';

describe('isValidKenyanPhone (audit L2)', () => {
  it('accepts plausible Safaricom / Airtel national numbers', () => {
    expect(isValidKenyanPhone('712345678')).toBe(true);
    expect(isValidKenyanPhone('712 345 678')).toBe(true);
    expect(isValidKenyanPhone('110123456')).toBe(true);
  });

  it('rejects repeating-digit sequences', () => {
    expect(isValidKenyanPhone('111111111')).toBe(false);
    expect(isValidKenyanPhone('000000000')).toBe(false);
    expect(isValidKenyanPhone('777777777')).toBe(false);
  });

  it('rejects wrong length or prefix', () => {
    expect(isValidKenyanPhone('612345678')).toBe(false);
    expect(isValidKenyanPhone('71234567')).toBe(false);
    expect(isValidKenyanPhone('7123456789')).toBe(false);
  });

  it('formats and converts to E.164 with +254 prefix', () => {
    expect(formatKenyanPhoneInput('712345678')).toBe('712 345 678');
    expect(toE164Kenyan('712 345 678')).toBe('+254712345678');
  });
});
