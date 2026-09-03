-- ============================================================================
-- 024_stock_atomic_helpers.sql — atomic stock helpers (B-02)
-- ============================================================================
-- Helpers to make qty adjustments atomic and race-safe without requiring the
-- API to do read-modify-write in two round-trips. The service layer should
-- prefer these helpers; the CHECK (qty_on_hand >=0) remains as defense-in-depth.
-- ============================================================================

-- pgcrypto already enabled in 001 for gen_random_uuid; ensure present.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Atomic adjust: adds delta (positive or negative) to qty_on_hand, guards >=0.
-- Returns the updated row. Raises 23514 if would go negative.
CREATE OR REPLACE FUNCTION public.adjust_stock_qty(
  p_item_id UUID,
  p_delta NUMERIC
) RETURNS public.msme_stock_items AS $$
DECLARE
  v_row public.msme_stock_items;
BEGIN
  UPDATE public.msme_stock_items
     SET qty_on_hand = qty_on_hand + p_delta,
         updated_at = NOW()
   WHERE id = p_item_id
     AND qty_on_hand + p_delta >= 0
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    -- Distinguish not-found vs would-go-negative for better API error mapping.
    IF NOT EXISTS (SELECT 1 FROM public.msme_stock_items WHERE id = p_item_id) THEN
      RAISE EXCEPTION 'stock item % not found', p_item_id USING ERRCODE = 'P0002';
    ELSE
      RAISE EXCEPTION 'insufficient stock for item % delta %', p_item_id, p_delta USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.adjust_stock_qty(UUID, NUMERIC) IS 'Atomic stock qty adjust (B-02). Positive delta = in, negative = out. Guards qty_on_hand >=0 in one statement.';

-- Invoice pay helper is intentionally NOT added here — payInvoice is a multi-table
-- flow (invoice status + income_event + transactions) that is correctly handled
-- with compensation in the service layer (B-01) until a proper DB transaction
-- (supabase.rpc or PostgREST transaction) is introduced. Stock is the hot race.
