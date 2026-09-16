-- Complete a requested reallocation exactly once. The status transition and
-- both ledger rows share one transaction, so neither retries nor failures can
-- leave a completed transfer without its money movement.
CREATE OR REPLACE FUNCTION public.atomic_complete_reallocation(
  p_reallocation_id UUID,
  p_discipline_cost NUMERIC DEFAULT 0
) RETURNS public.reallocations AS $$
DECLARE
  v_reallocation public.reallocations;
  v_available NUMERIC;
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

  -- Lock both pockets in a stable order before checking the source ledger.
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

  RETURN v_reallocation;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_complete_reallocation(UUID, NUMERIC) IS
  'Exactly-once, atomic requested-reallocation completion with a locked source-balance check.';
