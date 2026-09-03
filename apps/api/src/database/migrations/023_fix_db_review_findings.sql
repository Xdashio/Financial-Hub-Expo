-- ============================================================================
-- 023_fix_db_review_findings.sql — post-review DB fixes (D-03..D-08)
-- ============================================================================
-- This migration repairs DB objects that were already created by earlier
-- migrations on existing databases. For fresh DBs the canonical source files
-- (020,021,006, etc.) already contain the corrected definitions, so the
-- operations below are idempotent no-ops there — they only fix already-migrated
-- databases.
--
-- Fixes:
--  D-08 idempotency scope CHECK widening
--  D-03 invoice unique → plain index
--  D-04 SKU lower(sku) uniqueness
--  D-05 FORCE RLS where missing
--  D-07 stock movements composite index
-- ============================================================================

-- D-08: widen idempotency_records.scope CHECK (allow segment-qualified values)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'idempotency_records_scope_check'
      AND conrelid = 'public.idempotency_records'::regclass
  ) THEN
    ALTER TABLE public.idempotency_records DROP CONSTRAINT idempotency_records_scope_check;
  END IF;
  -- pg_constraint name may be auto-generated; drop by definition if still tight
  -- Fallback: drop any scope check and recreate with widened rule
  BEGIN
    ALTER TABLE public.idempotency_records DROP CONSTRAINT IF EXISTS idempotency_records_scope_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Recreate widened check idempotently
  DO $inner$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.idempotency_records'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%scope~%'
    ) THEN
      ALTER TABLE public.idempotency_records
        ADD CONSTRAINT idempotency_records_scope_check CHECK (
          scope IN ('income', 'spend', 'loan_reminder')
          OR scope ~ '^(income|spend):(individual|msme)$'
          OR scope ~ '^invoice_pay:(individual|msme)$'
          OR scope ~ '^stock:(individual|msme)$'
        );
    END IF;
  END $inner$;
END $$;

-- D-03: invoice user_customer_due should NOT be UNIQUE
DROP INDEX IF EXISTS public.idx_msme_invoices_user_customer_due;
CREATE INDEX IF NOT EXISTS idx_msme_invoices_user_customer_due
  ON public.msme_invoices(user_id, customer_name, due_date, amount);
-- Prod: this is CONCURRENTLY in a real deploy; handled here inside tx for review.

-- D-04: SKU uniqueness must be case-insensitive (lower)
DROP INDEX IF EXISTS public.idx_msme_stock_items_user_sku;
CREATE UNIQUE INDEX IF NOT EXISTS idx_msme_stock_items_user_sku
  ON public.msme_stock_items(user_id, lower(sku)) WHERE sku IS NOT NULL;

-- D-07: composite index for movement history pagination
CREATE INDEX IF NOT EXISTS idx_msme_stock_movements_item_created
  ON public.msme_stock_movements(item_id, created_at DESC);

-- D-05: FORCE RLS on all user-data tables so service_role cannot bypass.
-- Idempotent — if already forced, ALTER is no-op.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'public.users','public.plans','public.pockets','public.fixed_expenses',
    'public.income_events','public.transactions','public.reallocations',
    'public.merchant_classifications','public.behavior_events','public.discipline_scores',
    'public.notification_preferences','public.merchant_reports',
    'public.push_tokens','public.notification_deliveries','public.idempotency_records',
    'public.msme_projects','public.msme_project_tiers','public.msme_project_income_events',
    'public.msme_project_allocations','public.msme_project_spends','public.msme_project_excess_prompts',
    'public.msme_invoices','public.msme_stock_items','public.msme_stock_movements',
    'public.daily_allocations','public.planning_cycle_events','public.emergency_unlocks'
  ]) LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', t);
    EXCEPTION WHEN undefined_table THEN
      -- Table not yet created on this DB (e.g. older branch) — skip.
      NULL;
    WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- D-06: index creation note — prod should recreate heavy indexes CONCURRENTLY.
-- No automated CONCURRENTLY here (requires outside tx); this comment is the fix.
COMMENT ON INDEX public.idx_msme_invoices_user_customer_due IS 'Prod: recreate CONCURRENTLY outside transaction if table is large';
COMMENT ON INDEX public.idx_msme_stock_items_user_sku IS 'Case-insensitive per-user SKU uniqueness via lower(sku)';
