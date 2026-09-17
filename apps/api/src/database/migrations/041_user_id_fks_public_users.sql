-- ============================================================================
-- 041_user_id_fks_public_users.sql — M12
--
-- FK inconsistency: tables created in 011 and later pointed their user_id
-- FKs at auth.users(id), while every other table in the schema (001, 005,
-- 006, 017, 033...) references public.users(id) — the app-level profile row
-- that the on_auth_user_created trigger creates on every signup.
--
-- This migration switches the post-011 tables' user_id FKs to
-- public.users(id) to match the rest of the schema. The
-- on_auth_user_created trigger keeps working unchanged: it inserts into
-- public.users BEFORE anything else can reference the user, so every auth
-- user still gets a profile row and every FK below still resolves.
--
-- Tables switched (all created 011+ with user_id REFERENCES auth.users):
--   emergency_unlocks        (011)
--   daily_allocations        (013)
--   planning_cycle_events    (013)
--   msme_invoices            (020)
--   msme_stock_items         (021)
--   msme_stock_movements     (021)
--
-- Constraint names: Postgres auto-names inline column FKs
-- `<table>_<column>_fkey`. ON DELETE CASCADE is preserved from the old
-- constraints. RLS policies key off auth.uid() and are unaffected.
--
-- No orphan risk either way: deleting an auth.users row cascades to both
-- public.users and these tables under either FK target, so no rows can
-- exist without an owner. The guarded cleanup below is defensive only —
-- a NOT VALID-free ADD CONSTRAINT would otherwise fail on a hypothetical
-- legacy database with orphaned rows.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  -- Defensive: remove (impossible-in-practice) orphaned rows so the
  -- validated FK re-add below can never fail. No-op on any healthy DB.
  FOREACH t IN ARRAY ARRAY[
    'emergency_unlocks',
    'daily_allocations',
    'planning_cycle_events',
    'msme_invoices',
    'msme_stock_items',
    'msme_stock_movements'
  ] LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE user_id NOT IN (SELECT id FROM public.users)',
      t
    );
  END LOOP;
END
$$;

ALTER TABLE public.emergency_unlocks
  DROP CONSTRAINT IF EXISTS emergency_unlocks_user_id_fkey;
ALTER TABLE public.emergency_unlocks
  ADD CONSTRAINT emergency_unlocks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.daily_allocations
  DROP CONSTRAINT IF EXISTS daily_allocations_user_id_fkey;
ALTER TABLE public.daily_allocations
  ADD CONSTRAINT daily_allocations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.planning_cycle_events
  DROP CONSTRAINT IF EXISTS planning_cycle_events_user_id_fkey;
ALTER TABLE public.planning_cycle_events
  ADD CONSTRAINT planning_cycle_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.msme_invoices
  DROP CONSTRAINT IF EXISTS msme_invoices_user_id_fkey;
ALTER TABLE public.msme_invoices
  ADD CONSTRAINT msme_invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.msme_stock_items
  DROP CONSTRAINT IF EXISTS msme_stock_items_user_id_fkey;
ALTER TABLE public.msme_stock_items
  ADD CONSTRAINT msme_stock_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.msme_stock_movements
  DROP CONSTRAINT IF EXISTS msme_stock_movements_user_id_fkey;
ALTER TABLE public.msme_stock_movements
  ADD CONSTRAINT msme_stock_movements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
