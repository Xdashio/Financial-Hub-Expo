-- Add income surplus columns missing from production
-- (001_initial_schema defined them, but older projects never received them
-- because CREATE TABLE IF NOT EXISTS is a no-op on existing tables.)

ALTER TABLE public.income_events
  ADD COLUMN IF NOT EXISTS unallocated_surplus NUMERIC
  CHECK (unallocated_surplus IS NULL OR unallocated_surplus >= 0);

ALTER TABLE public.income_events
  ADD COLUMN IF NOT EXISTS surplus_allocation_status TEXT
  CHECK (surplus_allocation_status IN ('pending', 'allocated', 'skipped'));

ALTER TABLE public.income_events ALTER COLUMN label DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_income_events_surplus_status
  ON public.income_events(surplus_allocation_status)
  WHERE surplus_allocation_status = 'pending';
