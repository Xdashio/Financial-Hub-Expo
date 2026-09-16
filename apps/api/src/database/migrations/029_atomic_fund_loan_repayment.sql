-- C5: claim the next loan repayment slot exactly once. Locks the loan row,
-- validates the schedule, writes the repayment ledger credit, and advances
-- paymentsMade in one transaction so concurrent fundRepayment calls cannot
-- mint unbounded balance or completion points.
CREATE OR REPLACE FUNCTION public.atomic_fund_loan_repayment(
  p_loan_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_repayment_pocket_id UUID,
  p_next_due_date TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_loan public.pockets;
  v_schedule JSONB;
  v_payments_made INT;
  v_total_payments INT;
  v_repayment_amount NUMERIC;
  v_previous_next_due_date TEXT;
  v_completed BOOLEAN := FALSE;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Repayment amount must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_loan FROM public.pockets WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loan not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_loan.kind <> 'loan' THEN
    RAISE EXCEPTION 'Can only fund repayment for loan pockets' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.plans WHERE id = v_loan.plan_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  v_schedule := v_loan.repayment_schedule;
  IF v_schedule IS NULL THEN
    RAISE EXCEPTION 'Loan has no repayment schedule' USING ERRCODE = 'P0001';
  END IF;

  v_payments_made := COALESCE((v_schedule->>'paymentsMade')::INT, 0);
  v_total_payments := COALESCE((v_schedule->>'totalPayments')::INT, 0);
  v_repayment_amount := COALESCE((v_schedule->>'repaymentAmount')::NUMERIC, 0);
  v_previous_next_due_date := v_schedule->>'nextDueDate';

  IF v_payments_made >= v_total_payments OR COALESCE((v_schedule->>'fullyRepaid')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Loan already fully repaid' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <> v_repayment_amount THEN
    RAISE EXCEPTION 'Repayment amount mismatch' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pockets
    WHERE id = p_repayment_pocket_id
      AND parent_pocket_id = p_loan_id
      AND name = 'Repayment'
  ) THEN
    RAISE EXCEPTION 'Repayment sub-pocket not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type, merchant, category)
  VALUES (p_repayment_pocket_id, p_amount, 'allocation', 'Loan Repayment', 'other');

  v_payments_made := v_payments_made + 1;
  v_schedule := jsonb_set(v_schedule, '{paymentsMade}', to_jsonb(v_payments_made));

  IF v_payments_made >= v_total_payments THEN
    v_completed := TRUE;
    v_schedule := jsonb_set(v_schedule, '{fullyRepaid}', 'true'::jsonb);
  ELSIF p_next_due_date IS NOT NULL THEN
    v_schedule := jsonb_set(v_schedule, '{nextDueDate}', to_jsonb(p_next_due_date));
  END IF;

  UPDATE public.pockets
  SET repayment_schedule = v_schedule, updated_at = NOW()
  WHERE id = p_loan_id;

  RETURN jsonb_build_object(
    'payments_made', v_payments_made,
    'total_payments', v_total_payments,
    'completed', v_completed,
    'previous_next_due_date', v_previous_next_due_date,
    'schedule', v_schedule
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_fund_loan_repayment(UUID, UUID, NUMERIC, UUID, TEXT) IS
  'Atomically records one loan repayment credit and advances the schedule exactly once.';
