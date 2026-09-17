-- H1: extend atomic_complete_reallocation so the behavior event and the
-- SKIP_COOLING_OFF_COST discipline delta commit with the ledger + status
-- flip. A concurrent loser still cannot double-move money, and now also
-- cannot double-apply the cooling-off skip cost or insert a second
-- reallocation_completed event.
--
-- Adding parameters creates a new PostgreSQL signature, so drop the C1
-- two-argument form first. Named-arg callers that only pass
-- p_reallocation_id / p_discipline_cost keep working via DEFAULTs.

DROP FUNCTION IF EXISTS public.atomic_complete_reallocation(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.atomic_complete_reallocation(
  p_reallocation_id UUID,
  p_discipline_cost NUMERIC DEFAULT 0,
  p_user_id UUID DEFAULT NULL,
  p_from_pocket_name TEXT DEFAULT NULL,
  p_to_pocket_name TEXT DEFAULT NULL
) RETURNS public.reallocations AS $$
DECLARE
  v_reallocation public.reallocations;
  v_available NUMERIC;
  v_prev NUMERIC;
  v_new NUMERIC;
BEGIN
  SELECT * INTO v_reallocation
  FROM public.reallocations
  WHERE id = p_reallocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reallocation not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_reallocation.status NOT IN ('pending', 'cooling_off') THEN
    RAISE EXCEPTION 'Reallocation has already been resolved' USING ERRCODE = 'P0001';
  END IF;
  IF p_discipline_cost < 0 THEN
    RAISE EXCEPTION 'Discipline cost cannot be negative' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.pockets
  WHERE id IN (v_reallocation.from_pocket_id, v_reallocation.to_pocket_id)
  ORDER BY id FOR UPDATE;

  SELECT COALESCE(SUM(CASE
    WHEN type IN ('allocation', 'reallocation_in') THEN amount
    WHEN type = 'spend' THEN -amount
    WHEN type IN ('reallocation_out', 'rollover') THEN amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions WHERE pocket_id = v_reallocation.from_pocket_id;

  IF v_available < v_reallocation.amount THEN
    RAISE EXCEPTION 'Insufficient balance in the source pocket' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type) VALUES
    (v_reallocation.from_pocket_id, -v_reallocation.amount, 'reallocation_out'),
    (v_reallocation.to_pocket_id, v_reallocation.amount, 'reallocation_in');

  UPDATE public.reallocations
  SET status = 'completed', completed_at = NOW(), discipline_cost = p_discipline_cost
  WHERE id = p_reallocation_id
  RETURNING * INTO v_reallocation;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO public.behavior_events (user_id, type, payload)
    VALUES (
      p_user_id,
      'reallocation_completed',
      jsonb_build_object(
        'reallocationId', v_reallocation.id,
        'fromPocket', COALESCE(p_from_pocket_name, ''),
        'toPocket', COALESCE(p_to_pocket_name, ''),
        'amount', v_reallocation.amount,
        'disciplineCost', p_discipline_cost
      )
    );
  END IF;

  -- Match DisciplineScoreService.applyDelta: start from the latest score
  -- (any period), default 0 when none exists, clamp to [0, 100], persist
  -- against the current UTC month period with a negative delta.
  IF p_discipline_cost > 0 AND p_user_id IS NOT NULL THEN
    PERFORM 1 FROM public.discipline_scores
    WHERE user_id = p_user_id
    FOR UPDATE;

    SELECT score INTO v_prev
    FROM public.discipline_scores
    WHERE user_id = p_user_id
    ORDER BY calculated_at DESC
    LIMIT 1;

    v_new := GREATEST(0, LEAST(100, COALESCE(v_prev, 0) - p_discipline_cost));

    INSERT INTO public.discipline_scores (user_id, score, delta, period, calculated_at)
    VALUES (
      p_user_id,
      v_new,
      -p_discipline_cost,
      to_char((timezone('utc', now())), 'YYYY-MM'),
      NOW()
    )
    ON CONFLICT (user_id, period)
    DO UPDATE SET
      score = EXCLUDED.score,
      delta = EXCLUDED.delta,
      calculated_at = EXCLUDED.calculated_at;
  END IF;

  RETURN v_reallocation;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_complete_reallocation(UUID, NUMERIC, UUID, TEXT, TEXT) IS
  'Exactly-once reallocation completion: ledger, status, behavior event, and skip-cooling-off discipline delta in one transaction.';
