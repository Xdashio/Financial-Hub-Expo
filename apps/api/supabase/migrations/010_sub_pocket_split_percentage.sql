-- ============================================================================
-- Sub-pocket percentage splits (replaces the flat-amount sub-pocket model)
-- ============================================================================
-- 007_sub_pockets.sql gave sub-pockets a flat `monthly_allocation` capped at
-- the parent's total, but nothing ever moved money into them — income
-- allocation only ever credits top-level pockets (getTopLevelPocketsByPlanId
-- filters parent_pocket_id IS NULL), so a sub-pocket's ledger balance sat at
-- zero forever. This migration switches sub-pockets to a percentage-of-
-- parent model instead: `split_percentage` is the source of truth for a
-- sub-pocket's share, and its `monthly_allocation` becomes a derived/cached
-- value (parent.monthly_allocation * split_percentage / 100), recomputed by
-- the application layer whenever the parent's plan changes.
--
-- Clean cutover, no backfill: no sub-pockets exist in production yet (team
-- testing only, confirmed 2026-08-14) — this feature was effectively
-- unused, so there's nothing to migrate data for.
--
-- NULL for top-level pockets (parent_pocket_id IS NULL) — the constraint
-- below only fires for rows that are themselves sub-pockets.
-- ============================================================================

ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS split_percentage NUMERIC;

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS sub_pocket_split_percentage_range;
ALTER TABLE public.pockets
  ADD CONSTRAINT sub_pocket_split_percentage_range
    CHECK (
      split_percentage IS NULL
      OR (parent_pocket_id IS NOT NULL AND split_percentage > 0 AND split_percentage <= 100)
    );

-- Sibling SUM(split_percentage) <= 100 needs sibling context a CHECK
-- constraint can't see (no cross-row CHECKs in Postgres) — enforced in
-- pockets.service.ts, same posture as the depth-cap-at-one-level rule in
-- 007_sub_pockets.sql.