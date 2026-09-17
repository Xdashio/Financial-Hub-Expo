-- ============================================================================
-- 039_savings_goal.sql — real savings-goal field (M7)
--
-- The mobile savings UI used to fabricate its goal as
-- `monthly_allocation * 12` (see goal-set.tsx / detail.tsx before this
-- change): an arbitrary multiple of the funding rate, not a target the user
-- ever set. That made `goal_reached` — which waives the early-unlock
-- discipline cost — reachable via a fake target.
--
-- NOTE on numbering: the audit asked for `036_savings_goal.sql`, but 036
-- was already taken (036_atomic_commit_onboarding.sql), so this lands as
-- the next free number, 039.
--
-- This migration adds the stored goal. There is deliberately NO backfill
-- from monthly_allocation * 12: backfilling would re-persist the exact
-- fabrication the audit flagged, and every backfilled row would then pass
-- the server-side goal check below. Pockets start with no goal (the client
-- shows its existing "Set a savings target" empty state); the user sets a
-- real one through the goal-set modal, which now writes these columns
-- instead of editing monthly_allocation.
-- ============================================================================

ALTER TABLE public.pockets
  ADD COLUMN IF NOT EXISTS savings_target_amount NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS savings_target_date DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pockets_savings_target_amount_check'
      AND conrelid = 'public.pockets'::regclass
  ) THEN
    ALTER TABLE public.pockets
      ADD CONSTRAINT pockets_savings_target_amount_check
      CHECK (
        savings_target_amount IS NULL
        OR (
          savings_target_amount > 0
          AND savings_target_amount <= 100000000
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.pockets.savings_target_amount IS
  'User-set savings goal for this pocket (KSh). Null = no goal set. The early-unlock goal_reached waiver (pockets.service unlockPocket) only applies when this is set AND the ledger balance covers it — never against a derived monthly_allocation multiple.';
COMMENT ON COLUMN public.pockets.savings_target_date IS
  'Optional target date for the savings goal. Display-only; no server logic keys off it.';

-- ============================================================================
-- Carry the goal through onboarding commit
-- ============================================================================
-- atomic_commit_onboarding (036) inserts pockets with an explicit column
-- list, so without this the savings_target_* built by pocket-provisioning
-- (from the onboarding savingsGoal the user actually stated) would be
-- silently dropped on every commit. This replaces the function in place —
-- same signature and semantics as 036, plus the two goal columns. If 036 is
-- ever changed, mirror the change here (or supersede this copy).
-- ============================================================================

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
  'Atomically deactivates the prior same-segment plan, inserts the new plan + pockets + optional fixed-expense replace, and records plan_created. 039 extension: persists pockets.savings_target_amount/savings_target_date (M7).';
