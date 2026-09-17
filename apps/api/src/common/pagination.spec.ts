import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parseLimit,
  parsePage,
  parsePagination,
} from './pagination';

describe('parsePagination (audit L6 / M2)', () => {
  it('falls back to defaults for NaN / non-numeric page', () => {
    expect(parsePage('abc')).toBe(DEFAULT_PAGE);
    expect(parsePage(Number.NaN)).toBe(DEFAULT_PAGE);
    expect(parsePage(undefined)).toBe(DEFAULT_PAGE);
    expect(parsePage('')).toBe(DEFAULT_PAGE);
  });

  it('accepts finite positive pages as integers', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage(2.9)).toBe(2);
  });

  it('caps limit and falls back for NaN', () => {
    expect(parseLimit('abc')).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimit(Number.NaN)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parseLimit(999)).toBe(MAX_PAGE_LIMIT);
  });

  it('returns a safe pair for ?page=abc', () => {
    expect(parsePagination('abc', 'xyz')).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_PAGE_LIMIT,
    });
  });
});
