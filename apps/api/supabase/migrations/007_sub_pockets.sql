-- ============================================================================
-- Sub-pockets: parent_pocket_id on the existing pockets table
-- ============================================================================
-- audit_team.md item 10 (second half) / FLUTTER_TO_EXPO_PORT_GUIDE.md §5:
-- a `parent_pocket_id` FK on `pockets` rather than a separate `sub_pockets`
-- table, so sub-pockets are ordinary pockets that reuse every existing
-- ledger/cap/rollover/merchant-scope code path unmodified — a sub-pocket
-- IS a pocket, just one with a parent.
--
-- ON DELETE CASCADE: deleting a parent pocket (e.g. a future plan retake
-- that drops it) takes its sub-pockets with it, same as deleting a plan
-- already cascades to its pockets. The application layer (see
-- pockets.service.ts deleteSubPocket) additionally refuses to delete a
-- sub-pocket that still holds ledger balance, so this cascade path is only
-- ever hit alongside a parent that's already being torn down deliberately.
--
-- Depth is capped at one level (no sub-pockets of sub-pockets) — that's
-- enforced in the application layer (pockets.service.ts), not in SQL,
-- because a CHECK constraint can't see other rows to verify a parent has no
-- parent of its own.

ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS parent_pocket_id UUID REFERENCES public.pockets(id) ON DELETE CASCADE;

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pocket_not_own_parent;
ALTER TABLE public.pockets
  ADD CONSTRAINT pocket_not_own_parent CHECK (parent_pocket_id IS NULL OR parent_pocket_id != id);

CREATE INDEX IF NOT EXISTS idx_pockets_parent_pocket_id ON public.pockets(parent_pocket_id);