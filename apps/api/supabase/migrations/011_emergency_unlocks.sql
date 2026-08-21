-- ============================================================================
-- Emergency unlock tracking (once-per-month limit for savings withdrawals)
-- ============================================================================
-- This table tracks when users unlock emergency funds from their savings
-- pocket. The unique constraint on (user_id, month) enforces the once-per-month
-- limit at the database level.
--
-- Related change: transactions table gets emergency_unlock_id FK to link
-- unlock transactions to their parent unlock event.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emergency_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  days_calculated INTEGER NOT NULL CHECK (days_calculated > 0),
  least_daily_spend NUMERIC NOT NULL CHECK (least_daily_spend >= 0),
  average_daily_spend NUMERIC NOT NULL CHECK (average_daily_spend >= 0),
  reserve_kept NUMERIC NOT NULL CHECK (reserve_kept >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enforce the once-per-month limit at the database level.
--
-- A table-level UNIQUE constraint can only reference plain columns, not
-- expressions — `UNIQUE (user_id, DATE_TRUNC('month', created_at))` is
-- invalid syntax (Postgres: "syntax error at or near ..."), which made this
-- migration fail outright on a from-scratch run (nothing after it in this
-- file, or in any later migration, ever applied either).
--
-- The fix needs two things, not just moving to CREATE UNIQUE INDEX:
-- 1. An index on an expression requires that expression to be IMMUTABLE.
--    date_trunc(text, timestamptz) is only STABLE — its result depends on
--    the session's `TimeZone` setting, so Postgres refuses it in an index
--    ("functions in index expression must be marked IMMUTABLE").
-- 2. Pinning the conversion to UTC explicitly (rather than trusting
--    whatever TimeZone happens to be set) makes the result genuinely
--    deterministic, so wrapping it in a same-signature IMMUTABLE SQL
--    function is safe, not just silencing the check — this is the
--    standard pattern for indexing timestamptz by calendar bucket. Matches
--    the UTC-anchoring convention already used elsewhere in this codebase
--    (see InsightsService.getActivityHeatmap's Date.UTC/getUTC* comment).
CREATE OR REPLACE FUNCTION public.immutable_utc_month(ts TIMESTAMPTZ)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (DATE_TRUNC('month', ts AT TIME ZONE 'UTC'))::date;
$$;

DROP INDEX IF EXISTS public.emergency_unlocks_one_per_month;
CREATE UNIQUE INDEX emergency_unlocks_one_per_month
  ON public.emergency_unlocks (user_id, public.immutable_utc_month(created_at));

-- Add comment to explain the table
COMMENT ON TABLE public.emergency_unlocks IS 'Tracks emergency unlock events from savings to enforce once-per-month usage limit';

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_emergency_unlocks_user_id ON public.emergency_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_unlocks_plan_id ON public.emergency_unlocks(plan_id);
CREATE INDEX IF NOT EXISTS idx_emergency_unlocks_created_at ON public.emergency_unlocks(created_at DESC);

-- Add emergency_unlock_id to transactions table to link unlock transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS emergency_unlock_id UUID REFERENCES public.emergency_unlocks(id) ON DELETE SET NULL;

-- Add index for finding all transactions in an unlock
CREATE INDEX IF NOT EXISTS idx_transactions_emergency_unlock_id ON public.transactions(emergency_unlock_id) WHERE emergency_unlock_id IS NOT NULL;
