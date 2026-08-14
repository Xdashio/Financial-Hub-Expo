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
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Enforce once-per-month limit at database level
  CONSTRAINT emergency_unlocks_one_per_month UNIQUE (user_id, DATE_TRUNC('month', created_at))
);

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
