-- H1: manual income entry used to write three separate rows in three
-- separate requests:
--   1. INSERT income_events            (the income event)
--   2. UPDATE income_events            (surplus columns, when the amount
--                                       exceeds expected income)
--   3. INSERT transactions             (the per-pocket allocation credits)
-- A failure at 2 or 3 left an income event on the ledger with no allocation
-- rows ("Income saved but allocation ledger failed" — money silently stuck),
-- or surplus flags that never got written. This function does all of it in
-- one transaction.
--
-- The surplus UPDATE is wrapped in a sub-block that swallows
-- `undefined_column`: production databases that predate the surplus columns
-- (008) must still record the income event itself, matching the graceful
-- degradation the old split-request code had.
CREATE OR REPLACE FUNCTION public.atomic_create_manual_income(
  p_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_source TEXT,
  p_label TEXT,
  p_date DATE,
  p_run_allocation BOOLEAN,
  p_segment TEXT,
  p_unallocated_surplus NUMERIC DEFAULT NULL,
  p_surplus_allocation_status TEXT DEFAULT NULL,
  p_allocations JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_event public.income_events;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Income amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Step 1: the income event. '' is passed as NULL (older DBs still have
  -- label NOT NULL historically, so a real '' would violate it; matching the
  -- service which trims to '' but the ALTER made NULL the canonical empty).
  INSERT INTO public.income_events (
    id, user_id, amount, source, label, date, run_allocation, segment
  ) VALUES (
    p_id, p_user_id, p_amount, p_source, NULLIF(p_label, ''), p_date,
    p_run_allocation, p_segment
  ) RETURNING * INTO v_event;

  -- Step 2: surplus columns, best-effort against pre-008 databases.
  IF p_unallocated_surplus IS NOT NULL THEN
    BEGIN
      UPDATE public.income_events
      SET unallocated_surplus = p_unallocated_surplus,
          surplus_allocation_status = p_surplus_allocation_status
      WHERE id = p_id
      RETURNING * INTO v_event;
    EXCEPTION WHEN undefined_column THEN
      NULL; -- income still recorded; surplus tracking unavailable on this DB
    END;
  END IF;

  -- Step 3: allocation credits, only when run_allocation and there is
  -- something to write (matches the service's empty-array guard).
  IF p_run_allocation AND p_allocations IS NOT NULL
     AND jsonb_array_length(p_allocations) > 0 THEN
    INSERT INTO public.transactions (pocket_id, amount, type)
    SELECT
      (item->>'pocket_id')::UUID,
      ROUND((item->>'amount')::NUMERIC * 100) / 100,
      'allocation'
    FROM jsonb_array_elements(p_allocations) item;
  END IF;

  RETURN to_jsonb(v_event);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_create_manual_income IS
  'Atomically records an income event, applies surplus flags (when supported), and writes allocation credits in one transaction.';