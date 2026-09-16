-- H5: rebalance sub-pockets atomically. Two concurrent rebalances of the same
-- family previously both read the same parent available balance, then both
-- funded the same growing siblings from it — double-funding and a deeply
-- negative parent (returns empty siblings for a no-op, like the old code).
-- This function locks the whole family (parent + children), recomputes every
-- balance from the ledger inside the lock, does the decrease-then-fund math
-- the service used to do across unguarded reads, writes all ledger rows, and
-- persists the new percentages in one transaction.
CREATE OR REPLACE FUNCTION public.atomic_rebalance_sub_pockets(
  p_parent_pocket_id UUID,
  p_splits JSONB,
  p_confirm_partial BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_parent public.pockets;
  v_parent_available NUMERIC;
  v_total_needed NUMERIC := 0;
  v_funding_scale NUMERIC;
  v_partial BOOLEAN;
  v_plan_row RECORD;
BEGIN
  -- Defensive input guards (the service's zod schema already enforces these,
  -- but the RPC is the last line of defense against direct callers).
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_splits) item
    WHERE (item->>'split_percentage')::NUMERIC <= 0
       OR (item->>'split_percentage')::NUMERIC > 100
  ) THEN
    RAISE EXCEPTION 'Split percentage must be between 0 and 100' USING ERRCODE = '22023';
  END IF;

  -- Every split must reference a direct child before we touch money. (The
  -- service pre-validates this too, but a concurrent family change can slip
  -- past a stale pre-flight read — this is the check that always holds.)
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) item
    LEFT JOIN public.pockets c
      ON c.id = (item->>'pocket_id')::UUID
     AND c.parent_pocket_id = p_parent_pocket_id
    WHERE c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Split references a pocket that is not a sub-pocket of this parent' USING ERRCODE = '23503';
  END IF;

  -- Row locks serialize every rebalance of this family, including concurrent
  -- parent-borrow flows (atomic_parent_borrow locks the same row set). Held
  -- until the whole transaction commits.
  PERFORM 1
  FROM public.pockets
  WHERE id = p_parent_pocket_id OR parent_pocket_id = p_parent_pocket_id
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_parent FROM public.pockets WHERE id = p_parent_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent pocket not found' USING ERRCODE = 'P0002';
  END IF;

  -- Per-sibling plan: current stored percentage, requested percentage (last
  -- split wins for a duplicated pocket, matching the old Map), and the
  -- ledger-derived available balance. The balance CASE mirrors
  -- supabase.repository getPocketSummary: allocation + reallocation_in land,
  -- spend debits, reallocation_out and rollover are signed amounts.
  CREATE TEMP TABLE tmp_rebalance_plan ON COMMIT DROP AS
  SELECT
    c.id AS pocket_id,
    COALESCE(c.split_percentage, 0) AS old_pct,
    COALESCE(
      (SELECT (item->>'split_percentage')::NUMERIC
       FROM jsonb_array_elements(p_splits) item
       WHERE (item->>'pocket_id')::UUID = c.id),
      COALESCE(c.split_percentage, 0)
    ) AS new_pct,
    COALESCE(SUM(CASE
      WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
      WHEN t.type = 'spend' THEN -t.amount
      WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
      ELSE 0
    END), 0) AS available,
    0::NUMERIC AS freed,
    0::NUMERIC AS needed
  FROM public.pockets c
  LEFT JOIN public.transactions t ON t.pocket_id = c.id
  WHERE c.parent_pocket_id = p_parent_pocket_id
  GROUP BY c.id;

  -- Total percentage ceiling — siblings NOT part of this request still count
  -- toward the 100% cap via old_pct. NULL (no rows) means no-op, allowed.
  IF (SELECT SUM(new_pct) FROM tmp_rebalance_plan) > 100.01 THEN
    RAISE EXCEPTION 'Sub-pockets would total more than 100 percent of the parent pocket' USING ERRCODE = '22023';
  END IF;

  -- Parent's own ledger available balance, read inside the family lock.
  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_parent_available
  FROM public.transactions t WHERE t.pocket_id = p_parent_pocket_id;

  -- Free up money from shrinking siblings first: target falls to
  -- (parent.monthly_allocation * newPct / 100), the excess above it flows
  -- back to the parent's balance.
  UPDATE tmp_rebalance_plan SET
    freed = GREATEST(0, ROUND(available - ROUND((v_parent.monthly_allocation * new_pct) / 100, 2), 2))
  WHERE new_pct < old_pct - 0.001;

  SELECT v_parent_available + COALESCE(SUM(freed), 0) INTO v_parent_available
  FROM tmp_rebalance_plan;

  -- Growth needs for increasing siblings, funded from the parent's fresh total.
  UPDATE tmp_rebalance_plan SET
    needed = GREATEST(0, ROUND(ROUND((v_parent.monthly_allocation * new_pct) / 100, 2) - available, 2))
  WHERE new_pct > old_pct + 0.001;

  SELECT COALESCE(SUM(needed), 0) INTO v_total_needed FROM tmp_rebalance_plan;

  -- Dry-run under-funding: nothing has been written yet, so report the
  -- shortfall and require the client to confirm a partial fill.
  IF v_total_needed > v_parent_available + 0.01 AND NOT p_confirm_partial THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'shortfall', ROUND(v_total_needed - v_parent_available, 2),
      'requires_confirmation', TRUE
    );
  END IF;

  v_funding_scale := CASE WHEN v_total_needed > 0 THEN LEAST(1, v_parent_available / v_total_needed) ELSE 1 END;
  v_partial := v_total_needed > v_parent_available + 0.01;

  -- Write every ledger row in one multi-row insert: freed amounts leave the
  -- sibling and land on the parent; funded amounts leave the parent and land
  -- on the growing siblings (proportional fill when partial).
  INSERT INTO public.transactions (pocket_id, amount, type)
  SELECT pocket_id, -freed, 'reallocation_out'::TEXT FROM tmp_rebalance_plan WHERE freed > 0
  UNION ALL
  SELECT p_parent_pocket_id, freed, 'reallocation_in'::TEXT FROM tmp_rebalance_plan WHERE freed > 0
  UNION ALL
  SELECT p_parent_pocket_id, -ROUND(needed * v_funding_scale, 2), 'reallocation_out'::TEXT FROM tmp_rebalance_plan WHERE needed > 0
  UNION ALL
  SELECT pocket_id, ROUND(needed * v_funding_scale, 2), 'reallocation_in'::TEXT FROM tmp_rebalance_plan WHERE needed > 0;

  -- Persist the requested percentages (and the derived monthly_allocation
  -- cache) even for partial fills — the remaining gap closes over later
  -- income events, which always split toward the stored percentage.
  UPDATE public.pockets c
  SET split_percentage = p.new_pct,
      monthly_allocation = ROUND((v_parent.monthly_allocation * p.new_pct) / 100, 2)
  FROM tmp_rebalance_plan p
  WHERE c.id = p.pocket_id
    AND ABS(p.new_pct - p.old_pct) > 0.001;

  RETURN jsonb_build_object(
    'applied', TRUE,
    'partial', v_partial,
    'funded_amount', ROUND(LEAST(v_total_needed, v_parent_available), 2),
    'shortfall', GREATEST(0, ROUND(v_total_needed - v_parent_available, 2))
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_rebalance_sub_pockets(UUID, JSONB, BOOLEAN) IS
  'Atomically recomputes sub-pocket balances under a family lock and moves money for a rebalance exactly once.';