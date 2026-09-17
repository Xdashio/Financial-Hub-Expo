-- H1: daily allocation create/close used to write the daily_allocations row
-- and then (in a second request, or in parallel) insert reserve ledger rows
-- against a sentinel pocket id `_reserve_pool`. That sentinel is not a UUID
-- and cannot satisfy transactions.pocket_id -> pockets(id), so those ledger
-- inserts cannot commit. The durable state that *can* land is the
-- daily_allocations row itself (unique on plan_id + allocation_date).
--
-- These RPCs lock the plan / allocation row, insert or close that row in
-- one transaction, and return the existing row on a same-day retry so the
-- midnight cron cannot open or close the same day twice.

CREATE OR REPLACE FUNCTION public.atomic_create_daily_allocation(
  p_plan_id UUID,
  p_user_id UUID,
  p_allocation_date DATE,
  p_planned_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_existing public.daily_allocations;
  v_plan public.plans;
  v_runway NUMERIC;
  v_created public.daily_allocations;
BEGIN
  IF p_planned_amount < 0 THEN
    RAISE EXCEPTION 'Planned amount cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_plan.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.daily_allocations
  WHERE plan_id = p_plan_id AND allocation_date = p_allocation_date
  FOR UPDATE;

  IF FOUND THEN
    RETURN to_jsonb(v_existing);
  END IF;

  IF COALESCE(v_plan.reserve_balance, 0) > 0 AND p_planned_amount > 0 THEN
    v_runway := GREATEST(1, FLOOR(v_plan.reserve_balance / p_planned_amount));
  ELSE
    v_runway := 1;
  END IF;

  BEGIN
    INSERT INTO public.daily_allocations (
      plan_id, user_id, allocation_date, planned_amount, actual_spend,
      returned_amount, overspend_amount, runway_days_at_open,
      runway_days_at_close, status, created_at, closed_at
    ) VALUES (
      p_plan_id, p_user_id, p_allocation_date, p_planned_amount, 0,
      0, 0, v_runway,
      NULL, 'open', NOW(), NULL
    )
    RETURNING * INTO v_created;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_created
    FROM public.daily_allocations
    WHERE plan_id = p_plan_id AND allocation_date = p_allocation_date;
    RETURN to_jsonb(v_created);
  END;

  RETURN to_jsonb(v_created);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.atomic_close_daily_allocation(
  p_allocation_id UUID,
  p_actual_spend NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_alloc public.daily_allocations;
  v_unused NUMERIC;
  v_overspend NUMERIC;
  v_returned NUMERIC := 0;
  v_overspend_amount NUMERIC := 0;
  v_runway_close NUMERIC;
BEGIN
  IF p_actual_spend < 0 THEN
    RAISE EXCEPTION 'Actual spend cannot be negative' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_alloc
  FROM public.daily_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Daily allocation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_alloc.status = 'closed' THEN
    RETURN to_jsonb(v_alloc);
  END IF;

  v_unused := v_alloc.planned_amount - p_actual_spend;
  v_overspend := p_actual_spend - v_alloc.planned_amount;

  IF v_unused > 0 THEN
    v_returned := v_unused;
  END IF;
  IF v_overspend > 0 THEN
    v_overspend_amount := v_overspend;
  END IF;

  IF v_unused > 0 AND v_alloc.runway_days_at_open IS NOT NULL THEN
    v_runway_close := v_alloc.runway_days_at_open;
  ELSIF v_overspend > 0 AND v_alloc.runway_days_at_open IS NOT NULL THEN
    v_runway_close := GREATEST(1, v_alloc.runway_days_at_open - 1);
  ELSE
    v_runway_close := NULL;
  END IF;

  UPDATE public.daily_allocations
  SET actual_spend = p_actual_spend,
      returned_amount = v_returned,
      overspend_amount = v_overspend_amount,
      status = 'closed',
      closed_at = NOW(),
      runway_days_at_close = v_runway_close
  WHERE id = p_allocation_id
    AND status = 'open'
  RETURNING * INTO v_alloc;

  IF NOT FOUND THEN
    SELECT * INTO v_alloc FROM public.daily_allocations WHERE id = p_allocation_id;
  END IF;

  RETURN to_jsonb(v_alloc);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_create_daily_allocation IS
  'Creates today''s daily allocation exactly once under a plan row lock. Same-day retries return the existing row.';
COMMENT ON FUNCTION public.atomic_close_daily_allocation IS
  'Closes a daily allocation exactly once under a row lock. Already-closed rows are returned unchanged.';
