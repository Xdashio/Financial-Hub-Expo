-- Serialize and validate a parent-reserve transfer in the database. This is
-- intentionally one function: application-process locks do not protect users
-- when requests land on separate API instances.
CREATE OR REPLACE FUNCTION public.atomic_parent_borrow(
  p_parent_pocket_id UUID,
  p_child_pocket_id UUID,
  p_amount NUMERIC,
  p_reason TEXT DEFAULT 'other'
) RETURNS public.reallocations AS $$
DECLARE
  v_parent_available NUMERIC;
  v_children_available NUMERIC;
  v_reallocation public.reallocations;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Borrow amount must be positive' USING ERRCODE = '22023';
  END IF;

  -- Row locks serialize every borrow from this family, including requests to
  -- different children. They are held until all ledger rows are committed.
  PERFORM 1
  FROM public.pockets
  WHERE id = p_parent_pocket_id OR parent_pocket_id = p_parent_pocket_id
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.pockets
    WHERE id = p_child_pocket_id AND parent_pocket_id = p_parent_pocket_id
  ) THEN
    RAISE EXCEPTION 'Child pocket does not belong to parent' USING ERRCODE = '23503';
  END IF;

  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_parent_available
  FROM public.transactions t WHERE t.pocket_id = p_parent_pocket_id;

  SELECT COALESCE(SUM(balance), 0) INTO v_children_available
  FROM (
    SELECT COALESCE(SUM(CASE
      WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
      WHEN t.type = 'spend' THEN -t.amount
      WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
      ELSE 0
    END), 0) AS balance
    FROM public.pockets c
    LEFT JOIN public.transactions t ON t.pocket_id = c.id
    WHERE c.parent_pocket_id = p_parent_pocket_id
    GROUP BY c.id
  ) children;

  IF v_parent_available - v_children_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient parent reserve' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reallocations (
    from_pocket_id, to_pocket_id, amount, reason, status, completed_at
  ) VALUES (
    p_parent_pocket_id, p_child_pocket_id, p_amount, p_reason, 'completed', NOW()
  ) RETURNING * INTO v_reallocation;

  INSERT INTO public.transactions (pocket_id, amount, type) VALUES
    (p_parent_pocket_id, -p_amount, 'reallocation_out'),
    (p_child_pocket_id, p_amount, 'reallocation_in');

  RETURN v_reallocation;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_parent_borrow(UUID, UUID, NUMERIC, TEXT) IS
  'Atomically checks a parent reserve and transfers funds to one direct child.';
