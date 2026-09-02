-- ============================================================================
-- 020_msme_invoices.sql — MSME Invoicing & Receivables Ledger (Phase 1)
-- eTIMS-ready customer invoices with full RLS and pay→income linkage.
-- Spec: Financial_HUB_MSME_Feature_Requirements §4, livelife.ke eTIMS 2026
-- ============================================================================

-- 1. Feature flag for staged rollout (pilot → GA)
ALTER TABLE public.users
  ALTER COLUMN feature_flags SET DEFAULT '{"msme_segment": true, "msme_invoices": true}'::jsonb;

-- Backfill existing rows missing the new key (idempotent)
UPDATE public.users
SET feature_flags = feature_flags || '{"msme_invoices": true}'::jsonb
WHERE NOT (feature_flags ? 'msme_invoices');

-- 2. Invoices table
CREATE TABLE IF NOT EXISTS public.msme_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL CHECK (char_length(customer_name) >= 1 AND char_length(customer_name) <= 100),
  -- KRA PIN: e.g. P051234567A (11 chars, letter + 9 digits + letter). Nullable for non-KRA customers.
  customer_pin TEXT CHECK (customer_pin IS NULL OR customer_pin ~ '^[A-Z][0-9]{9}[A-Z]$'),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  -- 'overdue' is derived (due_date < today AND status IN ('draft','sent')), not stored.
  description TEXT CHECK (description IS NULL OR char_length(description) <= 200),
  -- eTIMS submission tracking (future OSCU integration)
  etims_status TEXT CHECK (etims_status IS NULL OR etims_status IN ('pending', 'submitted', 'accepted')),
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msme_invoices_paid_at_only_when_paid CHECK (
    (status = 'paid' AND paid_at IS NOT NULL) OR (status != 'paid' AND paid_at IS NULL)
  ),
  CONSTRAINT msme_invoices_voided_at_only_when_void CHECK (
    (status = 'void' AND voided_at IS NOT NULL) OR (status != 'void' AND voided_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_msme_invoices_user_id ON public.msme_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_msme_invoices_plan_id ON public.msme_invoices(plan_id);
CREATE INDEX IF NOT EXISTS idx_msme_invoices_status ON public.msme_invoices(status);
CREATE INDEX IF NOT EXISTS idx_msme_invoices_due_date ON public.msme_invoices(due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_msme_invoices_user_customer_due ON public.msme_invoices(user_id, customer_name, due_date, amount);

-- updated_at trigger (reuse existing function from 001)
DROP TRIGGER IF EXISTS update_msme_invoices_updated_at ON public.msme_invoices;
CREATE TRIGGER update_msme_invoices_updated_at BEFORE UPDATE ON public.msme_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.msme_invoices IS 'MSME customer invoices — draft/sent/paid/void; overdue is derived (due_date < today AND status in draft/sent). Links to income_events on pay (020).';
COMMENT ON COLUMN public.msme_invoices.customer_pin IS 'KRA PIN, 11 chars A + 9 digits + A, nullable for non-KRA customers — eTIMS ready';
COMMENT ON COLUMN public.msme_invoices.etims_status IS 'eTIMS OSCU submission state — pending/submitted/accepted, null until submitted';

-- 3. RLS
ALTER TABLE public.msme_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can view their own invoices" ON public.msme_invoices
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can insert their own invoices" ON public.msme_invoices
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can update their own invoices" ON public.msme_invoices
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.msme_invoices;
CREATE POLICY "Users can delete their own invoices" ON public.msme_invoices
  FOR DELETE USING (user_id = auth.uid());
