-- H1: emergency unlock used to write three separate rows in three separate
-- requests:
--   1. INSERT emergency_unlocks (record the unlock event)
--   2. INSERT transactions   (the savings debit)
--   3. UPDATE plans          (reserve_balance shrink)
-- If any of steps 2/3 failed after step 1, the unlock record persisted with
-- no money actually moving — orphaned data and a silently-broken once-a-month
-- limit. This function does all of it in one transaction.
--
-- It also locks the owning plan row FOR UPDATE, so two concurrent unlocks of
-- the same plan serialize their reserve_balance writes, and the existing
-- `emergency_unlocks_one_per_month` unique index (010/011) rejects a same-
-- month duplicate inside the same transaction (rolling everything back).
CREATE OR REPLACE FUNCTION public.atomic_execute_emergency_unlock(
  p_id UUID,
  p_user_id UUID,
  p_plan_id UUID,
  p_amount NUMERIC,
  p_days_calculated INT,
  p_least_daily_spend NUMERIC,
  p_average_daily_spend NUMERIC,
  p_reserve_kept NUMERIC,
  p_runway_days_before NUMERIC,
  p_runway_days_after NUMERIC,
  p_runway_reduction_days NUMERIC,
  p_savings_pocket_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_unlock public.emergency_unlocks;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Emergency amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Serialize every unlock against this plan so the reserve_balance update
  -- below always applies to a fresh value (READ COMMITTED would otherwise
  -- let two concurrent unlocks both compute from the same pre-debit value).
  PERFORM 1 FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002';
  END IF;

  -- Step 1: the unlock event. The one-per-month unique index (011) rejects a
  -- same-month duplicate here, rolling back the entire function.
  INSERT INTO public.emergency_unlocks (
    id, user_id, plan_id, amount, days_calculated, least_daily_spend,
    average_daily_spend, reserve_kept,
    runway_days_before, runway_days_after, runway_reduction_days
  ) VALUES (
    p_id, p_user_id, p_plan_id, p_amount, p_days_calculated, p_least_daily_spend,
    p_average_daily_spend, p_reserve_kept,
    p_runway_days_before, p_runway_days_after, p_runway_reduction_days
  ) RETURNING * INTO v_unlock;

  -- Step 2: the savings debit (signed negative).
  INSERT INTO public.transactions (pocket_id, amount, type, emergency_unlock_id)
  VALUES (p_savings_pocket_id, -p_amount, 'reallocation_out', p_id);

  -- Step 3: shrink the plan reserve by the unlocked amount.
  UPDATE public.plans
  SET reserve_balance = GREATEST(0, reserve_balance - p_amount)
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'id', v_unlock.id,
    'created_at', v_unlock.created_at
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_execute_emergency_unlock IS
  'Atomically records an emergency unlock event, debits the savings pocket ledger, and shrinks the plan reserve in one transaction.';