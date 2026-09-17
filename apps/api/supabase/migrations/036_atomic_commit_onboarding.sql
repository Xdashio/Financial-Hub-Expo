-- H1: onboarding commit used to deactivate the prior plan, insert the new
-- plan, insert pockets, optionally replace fixed expenses, and write the
-- plan_created behavior event as separate requests. A failure mid-way left
-- an inactive prior plan with no active replacement, or a plan with no
-- pockets. This function does the whole persist in one transaction.
--
-- Concurrent commits for the same user+segment serialize on the users row.
-- A unique-violation on one_active_plan_per_segment_per_user (the race
-- loser) raises a clean business error so the API can return 409 without
-- leaving a partial plan.

CREATE OR REPLACE FUNCTION public.atomic_commit_onboarding(
  p_user_id UUID,
  p_segment TEXT,
  p_plan JSONB,
  p_pockets JSONB,
  p_replace_fixed_expenses BOOLEAN,
  p_fixed_expenses JSONB,
  p_behavior_type TEXT,
  p_behavior_payload JSONB
) RETURNS JSONB AS $$
DECLARE
  v_plan_id UUID;
  p_item JSONB;
  v_pockets JSONB;
BEGIN
  IF p_segment NOT IN ('individual', 'msme') THEN
    RAISE EXCEPTION 'Invalid segment' USING ERRCODE = '22023';
  END IF;
  IF p_plan IS NULL OR p_pockets IS NULL THEN
    RAISE EXCEPTION 'Plan and pockets are required' USING ERRCODE = '22023';
  END IF;

  -- Serialize every onboarding persist for this user so deactivate+insert
  -- cannot interleave with a sibling commit of the same segment.
  PERFORM 1 FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1 FROM public.plans
  WHERE user_id = p_user_id AND segment = p_segment
  FOR UPDATE;

  UPDATE public.plans
  SET status = 'inactive'
  WHERE user_id = p_user_id
    AND segment = p_segment
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
    RAISE EXCEPTION 'Onboarding commit conflict' USING ERRCODE = 'P0001';
  END;

  FOR p_item IN SELECT value FROM jsonb_array_elements(p_pockets)
  LOOP
    INSERT INTO public.pockets (
      id, plan_id, name, kind, category, is_time_locked, lock_until,
      monthly_allocation, daily_cap
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
      END
    );
  END LOOP;

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
    COALESCE(NULLIF(p_behavior_type, ''), 'plan_created'),
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

COMMENT ON FUNCTION public.atomic_commit_onboarding IS
  'Atomically deactivates the prior same-segment plan, inserts the new plan + pockets + optional fixed-expense replace, and records plan_created.';
