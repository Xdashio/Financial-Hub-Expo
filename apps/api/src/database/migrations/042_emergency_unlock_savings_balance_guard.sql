-- Review (Phase 7): migration 031 locked the plan and wrote the savings debit
-- without rechecking ledger availability under a pocket lock. A concurrent
-- atomic_commit_spend on the same savings pocket could pass its own balance
-- check and still lose to an unlock that used a stale pre-flight read —
-- driving savings negative. Replace the function so it:
--   1. locks plan + savings pocket FOR UPDATE
--   2. recomputes available with the same CASE as getPocketSummary / 034
--   3. raises if available < amount (clean rollback; no unlock row)
--   4. stores reserve_kept from the locked balance, not the client figure
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
  v_available NUMERIC;
  v_amount NUMERIC;
  v_reserve_kept NUMERIC;
BEGIN
  v_amount := ROUND(p_amount::numeric * 100) / 100;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Emergency amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Serialize unlocks against this plan (reserve_balance) and this savings
  -- pocket (ledger). Lock order: plan first, then pocket by id — matches the
  -- single-pocket spend path which locks the pocket alone, so a spend that
  -- already holds the pocket blocks here until it commits.
  PERFORM 1 FROM public.plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.pockets WHERE id = p_savings_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings pocket not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pockets
    WHERE id = p_savings_pocket_id AND plan_id = p_plan_id AND kind = 'savings'
  ) THEN
    RAISE EXCEPTION 'Savings pocket does not belong to plan' USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions t
  WHERE t.pocket_id = p_savings_pocket_id;

  IF v_available < v_amount THEN
    RAISE EXCEPTION 'Insufficient savings balance' USING ERRCODE = 'P0001';
  END IF;

  -- Ignore client p_reserve_kept; persist the locked post-debit figure.
  v_reserve_kept := ROUND((v_available - v_amount)::numeric * 100) / 100;

  INSERT INTO public.emergency_unlocks (
    id, user_id, plan_id, amount, days_calculated, least_daily_spend,
    average_daily_spend, reserve_kept,
    runway_days_before, runway_days_after, runway_reduction_days
  ) VALUES (
    p_id, p_user_id, p_plan_id, v_amount, p_days_calculated, p_least_daily_spend,
    p_average_daily_spend, v_reserve_kept,
    p_runway_days_before, p_runway_days_after, p_runway_reduction_days
  ) RETURNING * INTO v_unlock;

  INSERT INTO public.transactions (pocket_id, amount, type, emergency_unlock_id)
  VALUES (p_savings_pocket_id, -v_amount, 'reallocation_out', p_id);

  UPDATE public.plans
  SET reserve_balance = GREATEST(0, reserve_balance - v_amount)
  WHERE id = p_plan_id;

  RETURN jsonb_build_object(
    'id', v_unlock.id,
    'created_at', v_unlock.created_at,
    'reserve_kept', v_reserve_kept,
    'available_before', v_available
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_execute_emergency_unlock IS
  'Atomically records an emergency unlock, debits savings under a pocket lock with a ledger balance recheck, and shrinks the plan reserve (H1 + Phase 7 race guard).';
