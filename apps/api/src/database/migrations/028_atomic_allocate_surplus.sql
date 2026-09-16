-- C3: allocate an income surplus exactly once. All target-pocket creation,
-- ledger rows, and income-event state changes share one transaction.
CREATE OR REPLACE FUNCTION public.atomic_allocate_surplus(
  p_income_event_id UUID,
  p_user_id UUID,
  p_allocations JSONB,
  p_new_pocket JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_income public.income_events;
  v_new_pocket public.pockets;
  v_allocation JSONB;
  v_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_income FROM public.income_events WHERE id = p_income_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Income event not found' USING ERRCODE = 'P0002'; END IF;
  IF v_income.user_id <> p_user_id THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  IF v_income.surplus_allocation_status <> 'pending' OR v_income.unallocated_surplus IS NULL THEN
    RAISE EXCEPTION 'Income event has no pending surplus' USING ERRCODE = 'P0001';
  END IF;

  IF p_new_pocket IS NOT NULL THEN
    INSERT INTO public.pockets (plan_id, name, kind, category, is_time_locked, monthly_allocation)
    VALUES ((p_new_pocket->>'plan_id')::UUID, p_new_pocket->>'name', 'spendable', 'other', FALSE, 0)
    RETURNING * INTO v_new_pocket;
  END IF;

  FOR v_allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF (v_allocation->>'amount')::NUMERIC <= 0 THEN RAISE EXCEPTION 'Allocation amount must be positive' USING ERRCODE = '22023'; END IF;
    v_total := v_total + (v_allocation->>'amount')::NUMERIC;
    INSERT INTO public.transactions (pocket_id, amount, type)
    VALUES (
      COALESCE((v_allocation->>'pocket_id')::UUID, v_new_pocket.id),
      (v_allocation->>'amount')::NUMERIC,
      'allocation'
    );
  END LOOP;

  IF v_total <> v_income.unallocated_surplus THEN
    RAISE EXCEPTION 'Allocation total must equal pending surplus' USING ERRCODE = '22023';
  END IF;

  UPDATE public.income_events SET surplus_allocation_status = 'allocated', unallocated_surplus = NULL
  WHERE id = p_income_event_id;
  RETURN jsonb_build_object('new_pocket', CASE WHEN v_new_pocket.id IS NULL THEN NULL ELSE to_jsonb(v_new_pocket) END);
END;
$$ LANGUAGE plpgsql;
