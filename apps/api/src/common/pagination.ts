/**
 * Pagination sanitiser (M2). Every paginated endpoint funnels `page`/`limit`
 * through here so:
 * - non-numeric input (NaN from `Number('abc')` / `parseInt`) falls back to
 *   defaults instead of poisoning `.range()`/`.slice()` into a crash or a
 *   full-table scan;
 * - `limit` is hard-capped at MAX_PAGE_LIMIT (50) everywhere — repo range
 *   calls, insights, merchant, merchant-report, MSME project txs, invoices
 *   and stock — so a client can never request an unbounded page.
 */
export const MAX_PAGE_LIMIT = 50;
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 20;

export function parsePage(value: unknown, fallback = DEFAULT_PAGE): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function parseLimit(value: unknown, fallback = DEFAULT_PAGE_LIMIT): number {
  const fallbackCapped = Math.min(Math.max(1, Math.floor(fallback)), MAX_PAGE_LIMIT);
  if (value === undefined || value === null || value === '') return fallbackCapped;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallbackCapped;
  return Math.min(Math.floor(n), MAX_PAGE_LIMIT);
}

export function parsePagination(
  page?: unknown,
  limit?: unknown,
  defaultLimit = DEFAULT_PAGE_LIMIT,
): { page: number; limit: number } {
  return { page: parsePage(page), limit: parseLimit(limit, defaultLimit) };
}

/** Clamp a lookback window like `months` to 1..max (default 24). */
export function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
