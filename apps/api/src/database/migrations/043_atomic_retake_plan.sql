-- H1 residual (Phase 7 review): plan retake used to deactivate the prior
-- plan, insert the new plan + pockets, write redistribution ledger rows,
-- optionally replace fixed expenses, and insert plan_retaken as separate
-- requests. A mid-flight failure could leave no active plan (or a new plan
-- with partial ledger moves); concurrent retakes could both pass the
-- application-level monthly gate. This function does the whole persist in
-- one transaction and claims the monthly retake under the user row lock.
--
-- Redistribution planning stays in TypeScript (planBalanceRedistribution);
-- the RPC rechecks each source pocket's ledger available under FOR UPDATE
-- so a concurrent spend cannot silently drive a source negative.

CREATE OR REPLACE FUNCTION public.atomic_retake_plan(
  p_user_id UUID,
  p_segment TEXT,
  p_previous_plan_id UUID,
  p_plan JSONB,
  p_pockets JSONB,
  p_ledger JSONB,
  p_replace_fixed_expenses BOOLEAN,
  p_fixed_expenses JSONB,
  p_behavior_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
  v_prev public.plans;
  p_item JSONB;
  v_tx JSONB;
  v_pocket_id UUID;
  v_amount NUMERIC;
  v_type TEXT;
  v_needed NUMERIC;
  v_available NUMERIC;
  v_pockets JSONB;
BEGIN
  IF p_segment NOT IN ('individual', 'msme') THEN
    RAISE EXCEPTION 'Invalid segment' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NULL OR p_pockets IS NULL THEN
    RAISE EXCEPTION 'Plan and pockets are required' USING ERRCODE = '22023';
  END IF;
  IF p_previous_plan_id IS NULL THEN
    RAISE EXCEPTION 'Previous plan is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize every retake for this user (monthly claim + deactivate/insert).
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  -- Exactly-once monthly claim (UTC month), matching sameUtcMonth() in TS.
  IF EXISTS (
    SELECT 1
    FROM public.behavior_events be
    WHERE be.user_id = p_user_id
      AND be.type = 'plan_retaken'
      AND date_trunc('month', be.created_at AT TIME ZONE 'UTC')
          = date_trunc('month', NOW() AT TIME ZONE 'UTC')
  ) THEN
    RAISE EXCEPTION 'Retake already used this month' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.plans
  WHERE user_id = p_user_id AND segment = p_segment
  FOR UPDATE;

  SELECT * INTO v_prev
  FROM public.plans
  WHERE id = p_previous_plan_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_prev.user_id <> p_user_id
     OR v_prev.segment <> p_segment
     OR v_prev.status <> 'active' THEN
    RAISE EXCEPTION 'No active plan to retake' USING ERRCODE = 'P0002';
  END IF;

  -- Lock every pocket on the previous plan (and hold until commit) so ledger
  -- rechecks below cannot race a concurrent spend/borrow on those ids.
  PERFORM 1
  FROM public.pockets
  WHERE plan_id = p_previous_plan_id
  ORDER BY id
  FOR UPDATE;

  -- Recheck planned source debits against locked ledger balances.
  IF p_ledger IS NOT NULL AND jsonb_array_length(p_ledger) > 0 THEN
    FOR v_pocket_id, v_needed IN
      SELECT (item->>'pocket_id')::UUID AS pocket_id,
             SUM(ABS((item->>'amount')::NUMERIC)) AS needed
      FROM jsonb_array_elements(p_ledger) item
      WHERE item->>'type' = 'reallocation_out'
      GROUP BY (item->>'pocket_id')::UUID
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.pockets
        WHERE id = v_pocket_id AND plan_id = p_previous_plan_id
      ) THEN
        RAISE EXCEPTION 'Source pocket does not belong to previous plan'
          USING ERRCODE = '23503';
      END IF;

      SELECT COALESCE(SUM(CASE
        WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
        WHEN t.type = 'spend' THEN -t.amount
        WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
        ELSE 0
      END), 0) INTO v_available
      FROM public.transactions t
      WHERE t.pocket_id = v_pocket_id;

      IF v_available < v_needed THEN
        RAISE EXCEPTION 'Insufficient source balance' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.plans
  SET status = 'inactive'
  WHERE id = p_previous_plan_id
    AND status = 'active';

  v_plan_id := COALESCE((p_plan->>'id')::UUID, gen_random_uuid());

  BEGIN
    INSERT INTO public.plans (
      id, user_id, segment, type, income_pattern, income_interval_days,
      expected_income_amount, status, money_personality
    ) VALUES (
      v_plan_id,
      p_user_id,
      p_segment,
      p_plan->>'type',
      p_plan->>'income_pattern',
      NULLIF(p_plan->>'income_interval_days', '')::INTEGER,
      NULLIF(p_plan->>'expected_income_amount', '')::NUMERIC,
      COALESCE(NULLIF(p_plan->>'status', ''), 'active'),
      COALESCE(NULLIF(p_plan->>'money_personality', ''), 'saver')
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Retake commit conflict' USING ERRCODE = 'P0001';
  END;

  FOR p_item IN SELECT value FROM jsonb_array_elements(p_pockets)
  LOOP
    INSERT INTO public.pockets (
      id, plan_id, name, kind, category, is_time_locked, lock_until,
      monthly_allocation, daily_cap,
      savings_target_amount, savings_target_date
    ) VALUES (
      COALESCE(NULLIF(p_item->>'id', '')::UUID, gen_random_uuid()),
      v_plan_id,
      p_item->>'name',
      p_item->>'kind',
      NULLIF(p_item->>'category', ''),
      COALESCE((p_item->>'is_time_locked')::BOOLEAN, FALSE),
      NULLIF(p_item->>'lock_until', '')::TIMESTAMPTZ,
      COALESCE((p_item->>'monthly_allocation')::NUMERIC, 0),
      CASE
        WHEN p_item->>'daily_cap' IS NULL OR p_item->>'daily_cap' = '' THEN NULL
        ELSE (p_item->>'daily_cap')::NUMERIC
      END,
      CASE
        WHEN p_item->>'savings_target_amount' IS NULL OR p_item->>'savings_target_amount' = '' THEN NULL
        ELSE (p_item->>'savings_target_amount')::NUMERIC
      END,
      CASE
        WHEN p_item->>'savings_target_date' IS NULL OR p_item->>'savings_target_date' = '' THEN NULL
        ELSE (p_item->>'savings_target_date')::DATE
      END
    );
  END LOOP;

  IF p_ledger IS NOT NULL AND jsonb_array_length(p_ledger) > 0 THEN
    FOR v_tx IN SELECT value FROM jsonb_array_elements(p_ledger)
    LOOP
      v_pocket_id := (v_tx->>'pocket_id')::UUID;
      v_amount := ROUND((v_tx->>'amount')::NUMERIC * 100) / 100;
      v_type := v_tx->>'type';

      IF v_type NOT IN ('reallocation_out', 'reallocation_in') THEN
        RAISE EXCEPTION 'Invalid retake ledger type' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.transactions (pocket_id, amount, type)
      VALUES (v_pocket_id, v_amount, v_type);
    END LOOP;
  END IF;

  IF p_replace_fixed_expenses THEN
    DELETE FROM public.fixed_expenses
    WHERE user_id = p_user_id AND segment = p_segment;

    IF p_fixed_expenses IS NOT NULL AND jsonb_array_length(p_fixed_expenses) > 0 THEN
      INSERT INTO public.fixed_expenses (
        user_id, name, amount, due_day, category, segment
      )
      SELECT
        p_user_id,
        item->>'name',
        (item->>'amount')::NUMERIC,
        (item->>'due_day')::INTEGER,
        NULLIF(item->>'category', ''),
        p_segment
      FROM jsonb_array_elements(p_fixed_expenses) item;
    END IF;
  END IF;

  INSERT INTO public.behavior_events (user_id, type, payload)
  VALUES (
    p_user_id,
    'plan_retaken',
    COALESCE(p_behavior_payload, '{}'::jsonb)
  );

  SELECT COALESCE(jsonb_agg(to_jsonb(p.*) ORDER BY p.created_at), '[]'::jsonb)
  INTO v_pockets
  FROM public.pockets p
  WHERE p.plan_id = v_plan_id;

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'pockets', v_pockets
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_retake_plan IS
  'Atomically claims a once-per-UTC-month plan retake, deactivates the prior plan, inserts the new plan + pockets, writes redistribution ledger rows under source pocket locks, optionally replaces fixed expenses, and records plan_retaken.';
