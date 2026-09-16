-- H2: the plain (non-borrow) spend path used to be guarded only by an
-- in-process `Set<string>` (spend.service.ts `activeSpends`). Under horizontal
-- scaling two API instances could both pass checkSpend with the same
-- available balance and both insert a `spend` ledger row — double debiting the
-- pocket. The borrow path had the same gap at the ledger level until
-- atomic_parent_borrow (025) serialized it; this function closes the race for
-- every spend path.
--
-- Behavior contract (mirrors commitSpend's decision logic, but re-verified
-- under row locks so a stale pre-flight read cannot commit a double debit):
--   * Locks the target pocket row; when the pocket belongs to a sub-pocket
--     family it also locks the whole family (same set atomic_parent_borrow /
--     atomic_rebalance_sub_pockets lock), serializing spends against sibling
--     borrows and rebalances.
--   * Recomputes the pocket's ledger-derived available balance under the lock.
--   * If the spend exceeds the balance and p_borrow_from_parent is set, it
--     borrows the true gap from the parent in the same transaction (delegating
--     to atomic_parent_borrow, which re-raises the reserve check and family
--     lock). Only the real gap is borrowed — never the stale shortfall figure
--     computed outside the lock.
--   * If p_override is set, the spend is allowed through even when the balance
--     is short (an emergency overspend can legitimately push a pocket
--     negative, see getPocketSummary's no-clamp note).
--   * Otherwise the function raises, rolling back nothing (nothing written).
CREATE OR REPLACE FUNCTION public.atomic_commit_spend(
  p_pocket_id UUID,
  p_amount NUMERIC,
  p_merchant TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_borrow_from_parent BOOLEAN DEFAULT FALSE,
  p_override BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  v_pocket public.pockets;
  v_available NUMERIC;
  v_needed NUMERIC;
  v_borrowed NUMERIC := 0;
  v_tx_id UUID;
  v_available_after NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Spend amount must be positive' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pocket FROM public.pockets WHERE id = p_pocket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pocket not found' USING ERRCODE = 'P0002';
  END IF;

  -- Belongs to a sub-pocket family? Lock the whole family (ordering by id,
  -- the same order atomic_parent_borrow uses, to keep lock acquisition
  -- cycle-free). This also covers serializing the parent rows that a borrow
  -- below will touch.
  IF v_pocket.parent_pocket_id IS NOT NULL THEN
    PERFORM 1
    FROM public.pockets
    WHERE id = v_pocket.parent_pocket_id OR parent_pocket_id = v_pocket.parent_pocket_id
    ORDER BY id
    FOR UPDATE;
  END IF;

  -- Ledger-derived balance, identical formula to
  -- SupabaseRepository.getPocketSummary and atomic_parent_borrow:
  -- allocation / reallocation_in credit; spend debits; reallocation_out and
  -- rollover amounts are stored signed in the ledger so summing them already
  -- reduces the balance (migration 001 note, getPocketSummary comment).
  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_available
  FROM public.transactions t
  WHERE t.pocket_id = p_pocket_id;

  v_needed := ROUND(p_amount::numeric * 100) / 100 - v_available;

  IF v_needed > 0 THEN
    IF p_borrow_from_parent AND v_pocket.parent_pocket_id IS NOT NULL THEN
      -- Borrow exactly the true gap under the family lock. atomic_parent_borrow
      -- re-locks the family (same lock we already hold — same transaction, so
      -- re-entrant), enforces the parent-reserve rule, and writes the parent
      -- reallocation_out + child reallocation_in ledger pair.
      v_borrowed := v_needed;
      PERFORM public.atomic_parent_borrow(v_pocket.parent_pocket_id, v_pocket.id, v_borrowed, 'other');
    ELSIF NOT p_override THEN
      RAISE EXCEPTION 'Insufficient funds' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.transactions (pocket_id, amount, type, merchant, category)
  VALUES (p_pocket_id, ROUND(p_amount::numeric * 100) / 100, 'spend', p_merchant, p_category)
  RETURNING id INTO v_tx_id;

  -- Post-commit balance, recomputed under the same transaction so the caller
  -- returns the true figure (the service re-reads getPocketSummary today and
  -- this stays in agreement with it).
  SELECT COALESCE(SUM(CASE
    WHEN t.type IN ('allocation', 'reallocation_in') THEN t.amount
    WHEN t.type = 'spend' THEN -t.amount
    WHEN t.type IN ('reallocation_out', 'rollover') THEN t.amount
    ELSE 0
  END), 0) INTO v_available_after
  FROM public.transactions t
  WHERE t.pocket_id = p_pocket_id;

  RETURN jsonb_build_object(
    'transaction_id', v_tx_id,
    'borrowed_amount', v_borrowed,
    'available_after', v_available_after
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.atomic_commit_spend IS
  'Atomically checks a pocket balance under row locks, optionally borrows the parent reserve, and writes the spend ledger row (H2).';