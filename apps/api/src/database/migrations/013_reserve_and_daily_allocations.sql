-- ============================================================================
-- Ensure pgcrypto for gen_random_uuid() on fresh DBs (see 001).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reserve logical layer, daily allocation lifecycle, monthly planning cycle
-- and fixed-expense obligation protection.
--
-- Design principle: the Reserve Pocket is a LOGICAL layer — Financial HUB is
-- an intelligence layer that sits above existing financial institutions, not a
-- wallet. No real money moves; the ledger is the source of truth.
--
-- See: docs/FREELANCER_RUNWAY.md and the ChatGPT ↔ Viktor Cliff architecture
-- conversation committed alongside this migration.
-- ============================================================================

-- ============================================================================
-- 1. Reserve logical layer on plans
-- ============================================================================
-- reserve_balance: the logical pool that income flows into after savings.
--   Income → 10%+ Savings → 90% Reserve.
--   Reserve is then earmarked to fixed obligations + daily runway.
--   This is a ledger value, not a bank balance.
--
-- monthly_planning_day: 1–28, the day of the month the Monthly Planning Cycle
--   fires for this user's plan (cron reads this; user configures in Profile).
--   Default 1 (first of month). Capped at 28 to avoid Feb edge cases.
--
-- last_planning_cycle_at: timestamp of the most recent Monthly Planning Cycle
--   run, used by the cron to avoid double-firing within the same calendar day.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS reserve_balance NUMERIC NOT NULL DEFAULT 0
    CHECK (reserve_balance >= 0),
  ADD COLUMN IF NOT EXISTS monthly_planning_day INTEGER NOT NULL DEFAULT 1
    CHECK (monthly_planning_day BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS last_planning_cycle_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.plans.reserve_balance IS
  'Logical reserve pool (not a real bank balance). Income → 10%+ savings → remainder here. Fixed obligations and daily runway are earmarked against this value.';
COMMENT ON COLUMN public.plans.monthly_planning_day IS
  'Day of month (1–28) when the Monthly Planning Cycle cron fires for this plan. User-configurable in Profile. Default: 1.';
COMMENT ON COLUMN public.plans.last_planning_cycle_at IS
  'Timestamp of the last successfully completed Monthly Planning Cycle. Null if never run.';

-- ============================================================================
-- 2. Fixed-expense obligation protection
-- ============================================================================
-- Extend fixed_expenses with:
--   funded_amount: how much of this month's obligation is already earmarked
--     in the Reserve (updated by income allocation and planning cycle).
--   carry_forward: whether a surplus (funded > actual spend) rolls to next
--     month's pocket or returns to Reserve. Configurable per expense.
--   funded_at: when the current cycle's funding was last updated.
--   notification_day_offset: how many days before due_day to send the
--     payment reminder push notification. Default: 1 (day before).

ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS funded_amount NUMERIC NOT NULL DEFAULT 0
    CHECK (funded_amount >= 0),
  ADD COLUMN IF NOT EXISTS carry_forward BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS notification_day_offset INTEGER NOT NULL DEFAULT 1
    CHECK (notification_day_offset BETWEEN 0 AND 7);

COMMENT ON COLUMN public.fixed_expenses.funded_amount IS
  'Amount earmarked from Reserve for the current planning cycle. Reduced when the user marks the obligation as paid.';
COMMENT ON COLUMN public.fixed_expenses.carry_forward IS
  'If true, surplus (funded_amount > actual spend) carries to next month. If false, surplus returns to Reserve at month-end reconciliation.';
COMMENT ON COLUMN public.fixed_expenses.notification_day_offset IS
  'Days before due_day to fire the payment reminder push notification. 1 = day before (default). 0 = on the due date.';

-- ============================================================================
-- 3. Daily allocations table
-- ============================================================================
-- One row per plan per calendar day (UTC midnight-to-midnight, EAT cron).
-- Tracks what was authorized for today vs what was actually spent, and whether
-- unused funds were swept back to Reserve.
--
-- status lifecycle:  open → closed
--   open:   today's allocation is active (cron creates at 00:00 EAT)
--   closed: end-of-day sweep completed (cron closes at 23:59 EAT / next 00:00)

CREATE TABLE IF NOT EXISTS public.daily_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Calendar date this allocation covers (UTC date of EAT midnight)
  allocation_date DATE NOT NULL,

  -- Amount released from Reserve for today's variable spending
  planned_amount NUMERIC NOT NULL CHECK (planned_amount >= 0),

  -- Actual spend recorded during the day (updated by spend events)
  actual_spend NUMERIC NOT NULL DEFAULT 0 CHECK (actual_spend >= 0),

  -- Amount swept back to Reserve at end-of-day (planned - actual, floored 0)
  returned_amount NUMERIC NOT NULL DEFAULT 0 CHECK (returned_amount >= 0),

  -- Overspend above the planned cap (actual - planned, floored 0).
  -- Overspend reduces the reserve_balance directly (shrinks runway).
  overspend_amount NUMERIC NOT NULL DEFAULT 0 CHECK (overspend_amount >= 0),

  -- Runway days at open (snapshot for insight reporting / delta display)
  runway_days_at_open NUMERIC NULL CHECK (runway_days_at_open >= 0),

  -- Runway days after close (shows extension from underspend, compression
  -- from overspend). Null until the allocation is closed.
  runway_days_at_close NUMERIC NULL CHECK (runway_days_at_close >= 0),

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ NULL
);

COMMENT ON TABLE public.daily_allocations IS
  'One row per plan per day. Tracks the amount released from Reserve for variable spending, actual spend, and the end-of-day sweep back to Reserve. Runway delta is derived from planned vs actual.';

-- Unique: only one open allocation per plan per day
CREATE UNIQUE INDEX IF NOT EXISTS daily_allocations_plan_date_unique
  ON public.daily_allocations (plan_id, allocation_date);

CREATE INDEX IF NOT EXISTS idx_daily_allocations_user_id
  ON public.daily_allocations (user_id);
CREATE INDEX IF NOT EXISTS idx_daily_allocations_plan_id_status
  ON public.daily_allocations (plan_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_allocations_date
  ON public.daily_allocations (allocation_date DESC);

-- ============================================================================
-- 4. Monthly planning cycle event log
-- ============================================================================
-- Audit trail of every Monthly Planning Cycle run. Used by behavioral analysis
-- to compare plan vs actual across cycles and surface allocation recommendations.

CREATE TABLE IF NOT EXISTS public.planning_cycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The calendar month this cycle covers (first day of month, UTC)
  cycle_month DATE NOT NULL,

  -- Reserve balance at the start of this cycle
  reserve_balance_at_start NUMERIC NOT NULL DEFAULT 0,

  -- Total fixed obligations identified and earmarked this cycle
  total_fixed_obligations NUMERIC NOT NULL DEFAULT 0,

  -- Reserve remaining for daily runway after obligations are earmarked
  discretionary_reserve NUMERIC NOT NULL DEFAULT 0,

  -- Daily budget and runway calculated at start of cycle
  daily_budget NUMERIC NOT NULL DEFAULT 0,
  runway_days NUMERIC NOT NULL DEFAULT 0,

  -- JSON snapshot of per-expense allocation decisions for this cycle
  -- e.g. [{ expense_id, name, amount, funded_amount, carry_forward_amount }]
  allocation_snapshot JSONB NULL,

  -- JSON snapshot of behavioral recommendations surfaced this cycle
  -- e.g. [{ expense_id, name, current_allocation, recommended_allocation, reason }]
  recommendations_snapshot JSONB NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.planning_cycle_events IS
  'Audit log of Monthly Planning Cycle runs. One row per cycle per plan. Behavioral analysis reads this to generate allocation recommendations.';

CREATE UNIQUE INDEX IF NOT EXISTS planning_cycle_plan_month_unique
  ON public.planning_cycle_events (plan_id, cycle_month);

CREATE INDEX IF NOT EXISTS idx_planning_cycle_user_id
  ON public.planning_cycle_events (user_id);
CREATE INDEX IF NOT EXISTS idx_planning_cycle_created_at
  ON public.planning_cycle_events (created_at DESC);

-- ============================================================================
-- 5. Transaction type extensions
-- ============================================================================
-- Add 'reserve_release' and 'reserve_return' to track the daily allocation
-- lifecycle in the transaction ledger.
-- 'daily_overspend_debit' marks when overspend directly reduces Reserve.

-- Postgres doesn't support DROP/ADD for enum values cleanly; we use ALTER TYPE
-- ... ADD VALUE which is safe and idempotent in Postgres 14+.

DO $$
BEGIN
  -- reserve_release: Reserve → spendable pocket (daily allocation open)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'reserve_release'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'reserve_release';
  END IF;

  -- reserve_return: spendable pocket → Reserve (end-of-day sweep, unused funds)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'reserve_return'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'reserve_return';
  END IF;

  -- daily_overspend_debit: Reserve debited for overspend (reduces runway)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'daily_overspend_debit'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'daily_overspend_debit';
  END IF;

  -- fixed_expense_earmark: Reserve → fixed obligation pocket (planning cycle)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'fixed_expense_earmark'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'fixed_expense_earmark';
  END IF;

  -- fixed_expense_carry_forward: surplus carried forward to next cycle
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.transaction_type'::regtype
      AND enumlabel = 'fixed_expense_carry_forward'
  ) THEN
    ALTER TYPE public.transaction_type ADD VALUE 'fixed_expense_carry_forward';
  END IF;
EXCEPTION
  WHEN invalid_schema_name THEN
    -- enum type doesn't exist yet (first-run schema has it as a text column)
    NULL;
END
$$;

-- ============================================================================
-- 6. Link daily_allocations to transactions
-- ============================================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS daily_allocation_id UUID
    REFERENCES public.daily_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_daily_allocation_id
  ON public.transactions(daily_allocation_id)
  WHERE daily_allocation_id IS NOT NULL;

-- ============================================================================
-- 7. Emergency unlock redesign: freelancer-only, runway-impact model
-- ============================================================================
-- Add runway_impact columns to emergency_unlocks so each unlock records
-- the before/after runway days for display and insight reporting.
-- The 'plan_pattern' column lets service-layer guards enforce freelancer-only.

ALTER TABLE public.emergency_unlocks
  ADD COLUMN IF NOT EXISTS runway_days_before NUMERIC NULL CHECK (runway_days_before >= 0),
  ADD COLUMN IF NOT EXISTS runway_days_after NUMERIC NULL CHECK (runway_days_after >= 0),
  ADD COLUMN IF NOT EXISTS runway_reduction_days NUMERIC NULL CHECK (runway_reduction_days >= 0);

COMMENT ON COLUMN public.emergency_unlocks.runway_days_before IS
  'Discretionary runway days available before the emergency allocation was taken.';
COMMENT ON COLUMN public.emergency_unlocks.runway_days_after IS
  'Discretionary runway days remaining after the emergency allocation.';
COMMENT ON COLUMN public.emergency_unlocks.runway_reduction_days IS
  'runway_days_before − runway_days_after. The number the UI shows to make the cost conscious.';