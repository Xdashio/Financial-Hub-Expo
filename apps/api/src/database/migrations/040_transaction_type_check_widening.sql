-- ============================================================================
-- 040_transaction_type_check_widening.sql — M10
--
-- The transactions ledger's `type` column was created in 001 with an inline
-- CHECK limited to the original 5 values:
--   ('allocation', 'spend', 'reallocation_in', 'reallocation_out', 'rollover')
--
-- Migration 013 later added 5 more values — but via `ALTER TYPE
-- public.transaction_type ADD VALUE` (the Postgres ENUM of the same name)
-- and never widened this TEXT CHECK constraint. The result is drift:
-- database.types.ts and @financial-hub/shared's TransactionTypeSchema list
-- all 10 values, and the services write them (daily allocations, planning
-- cycle, reserve sweeps), yet any INSERT with one of the 5 newer values
-- would be rejected by this CHECK on a database where the constraint is
-- still the narrow 001 version.
--
-- This migration explicitly widens the CHECK (001 is never edited after the
-- fact — new migrations only). Constraint name: Postgres auto-names inline
-- column CHECKs `<table>_<column>_check`, i.e. transactions_type_check.
--
-- No backfill is required: rows that violate the CURRENT (narrow) constraint
-- cannot exist, and the widening only PERMITS the newer values — it removes
-- nothing. After this runs, the CHECK matches database.types.ts exactly.
-- ============================================================================

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'allocation',
    'spend',
    'reallocation_in',
    'reallocation_out',
    'rollover',
    'reserve_release',
    'reserve_return',
    'daily_overspend_debit',
    'fixed_expense_earmark',
    'fixed_expense_carry_forward'
  ));

COMMENT ON CONSTRAINT transactions_type_check ON public.transactions IS
  'Ledger entry types. Widened from the original 5 (001) to all 10 values (040) to match database.types.ts / TransactionTypeSchema — 013 added the newer values to the transaction_type ENUM but never widened this TEXT CHECK.';
