-- ============================================================================
-- 044_dedupe_fixed_expenses.sql - One fixed expense per name per segment
-- ============================================================================
-- Why: fixed_expenses accumulated duplicate rows every time onboarding was
-- re-run. The onboarding RPCs only replace the list when the caller sends
-- fixedExpenses (including an explicit empty array); clients that omitted the
-- field when the user had no bills left the previous rows in place, and the
-- next submission appended another copy. Nothing at the database level
-- prevented identical names either.
--
-- This migration:
--   1. drops rows whose name is only whitespace (invalid under the table
--      CHECK constraint anyway),
--   2. trims stored names (the API now trims on write as well),
--   3. keeps only the newest row per (user_id, segment, lower(trim(name))),
--   4. enforces that key with a unique index.
--
-- The API also rejects duplicate creates/renames, dedupes bulk and onboarding
-- submissions, and the mobile form blocks double submits, so this index is the
-- last line of defence (including concurrent requests).

DELETE FROM public.fixed_expenses
WHERE btrim(name) = '';

UPDATE public.fixed_expenses
SET name = btrim(name)
WHERE name <> btrim(name);

DELETE FROM public.fixed_expenses AS older
USING public.fixed_expenses AS newer
WHERE older.user_id = newer.user_id
  AND older.segment IS NOT DISTINCT FROM newer.segment
  AND lower(btrim(older.name)) = lower(btrim(newer.name))
  AND (
    newer.created_at > older.created_at
    OR (newer.created_at = older.created_at AND newer.id > older.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_fixed_expenses_user_segment_name
  ON public.fixed_expenses (user_id, segment, lower(btrim(name)));
