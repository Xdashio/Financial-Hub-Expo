-- ============================================================================
-- Loans Feature: Loan pocket type and repayment schedule support
-- ============================================================================
-- audit_team.md item 9: Loans as a pocket type with repayment schedules
-- and sub-pockets for repayment vs. purpose allocation.
--
-- This migration adds:
-- 1. 'loan' as a valid pocket kind
-- 2. repayment_schedule JSONB field for loan repayment terms
-- 3. loan_provider and loan_purpose fields for loan metadata
-- 4. due_day field for loan repayment due date (reusing fixed expense pattern)
--
-- The repayment_schedule JSONB structure:
-- {
--   "total_amount": number,
--   "repayment_amount": number,
--   "cadence": "weekly" | "biweekly" | "monthly",
--   "start_date": "ISO date string",
--   "end_date": "ISO date string",
--   "next_due_date": "ISO date string",
--   "total_payments": number,
--   "payments_made": number
-- }

-- Add 'loan' to the pocket kind constraint
ALTER TABLE public.pockets 
  DROP CONSTRAINT IF EXISTS pockets_kind_check;

ALTER TABLE public.pockets 
  ADD CONSTRAINT pockets_kind_check 
  CHECK (kind IN ('savings', 'fixed', 'spendable', 'loan'));

-- Add loan-specific fields to pockets table
ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS repayment_schedule JSONB,
  ADD COLUMN IF NOT EXISTS loan_provider TEXT,
  ADD COLUMN IF NOT EXISTS loan_purpose TEXT,
  ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

-- Add index for loan pockets to enable efficient querying
CREATE INDEX IF NOT EXISTS idx_pockets_kind_loan ON public.pockets(kind) WHERE kind = 'loan';

-- Add index for due_day to support upcoming payment queries
CREATE INDEX IF NOT EXISTS idx_pockets_due_day ON public.pockets(due_day) WHERE due_day IS NOT NULL;

-- Add comment to document the repayment_schedule structure
COMMENT ON COLUMN public.pockets.repayment_schedule IS 
'Repayment schedule for loan pockets. JSONB structure: {
  "total_amount": number,
  "repayment_amount": number,
  "cadence": "weekly" | "biweekly" | "monthly",
  "start_date": "ISO date string",
  "end_date": "ISO date string", 
  "next_due_date": "ISO date string",
  "total_payments": number,
  "payments_made": number
}';

-- Add constraint to ensure repayment_schedule is only set for loan pockets
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_schedule_only_for_loans CHECK (
    (kind = 'loan' AND repayment_schedule IS NOT NULL) OR 
    (kind != 'loan' AND repayment_schedule IS NULL)
  );

-- Add constraint to ensure due_day is only set for loan pockets
ALTER TABLE public.pockets
  ADD CONSTRAINT loan_due_day_only_for_loans CHECK (
    (kind = 'loan' AND due_day IS NOT NULL) OR 
    (kind != 'loan' AND due_day IS NULL)
  );
