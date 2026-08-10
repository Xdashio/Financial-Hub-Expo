-- ============================================================================
-- Merchant classifications: persist preferred pocket
-- ============================================================================
-- Batch 5 / ONBOARDING_AND_SCORING_REDESIGN.md Part 6 #1:
-- the classify UI asks which pocket a merchant belongs to, but the column
-- never existed — answers were silently dropped. ON DELETE SET NULL so
-- deleting a pocket (e.g. plan retake) does not cascade-delete the user's
-- recipient memory; they can re-point it later.

ALTER TABLE public.merchant_classifications
  ADD COLUMN IF NOT EXISTS pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_merchant_classifications_pocket_id
  ON public.merchant_classifications(pocket_id);
