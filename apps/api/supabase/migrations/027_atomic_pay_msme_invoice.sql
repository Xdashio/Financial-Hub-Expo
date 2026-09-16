-- Pay an invoice exactly once. Invoice state, the income event, and every
-- allocation row commit together so retries cannot create duplicate income.
CREATE OR REPLACE FUNCTION public.atomic_pay_msme_invoice(
  p_invoice_id UUID,
  p_user_id UUID,
  p_source TEXT,
  p_label TEXT,
  p_date DATE,
  p_allocations JSONB DEFAULT '[]'::jsonb
) RETURNS public.msme_invoices AS $$
DECLARE
  v_invoice public.msme_invoices;
  v_allocation JSONB;
BEGIN
  SELECT * INTO v_invoice FROM public.msme_invoices
  WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002'; END IF;
  IF v_invoice.user_id <> p_user_id THEN RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501'; END IF;
  IF v_invoice.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Invoice already paid or cannot be paid' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.income_events (user_id, amount, source, label, date, run_allocation, segment)
  VALUES (p_user_id, v_invoice.amount, p_source, p_label, p_date, TRUE, 'msme');

  FOR v_allocation IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    IF (v_allocation->>'amount')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Allocation amount must be positive' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.transactions (pocket_id, amount, type)
    VALUES ((v_allocation->>'pocket_id')::UUID, (v_allocation->>'amount')::NUMERIC, 'allocation');
  END LOOP;

  UPDATE public.msme_invoices SET status = 'paid', paid_at = NOW()
  WHERE id = p_invoice_id RETURNING * INTO v_invoice;
  RETURN v_invoice;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_pay_msme_invoice(UUID, UUID, TEXT, TEXT, DATE, JSONB) IS
  'Atomically creates invoice income and allocations, then marks the invoice paid.';
