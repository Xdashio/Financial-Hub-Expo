-- ============================================================================
-- Idempotency keys for income + spend writes
-- ============================================================================
-- Prevents double-recording when a mobile client times out and retries
-- (common on flaky connections). Scoped per user so keys never collide
-- across accounts.

CREATE TABLE IF NOT EXISTS public.idempotency_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Scoped per user+operation+segment so retries in one segment cannot collide
  -- with another. Pre-023 values 'income'/'spend' are kept for migration compat.
  scope TEXT NOT NULL CHECK (
    scope IN ('income', 'spend', 'loan_reminder')
    OR scope ~ '^(income|spend):(individual|msme)$'
    OR scope ~ '^invoice_pay:(individual|msme)$'
    OR scope ~ '^stock:(individual|msme)$'
  ),
  idempotency_key TEXT NOT NULL,
  resource_id UUID,
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_idempotency_record UNIQUE (user_id, scope, idempotency_key),
  CONSTRAINT idempotency_key_length CHECK (
    char_length(idempotency_key) >= 8 AND char_length(idempotency_key) <= 128
  )
);

CREATE INDEX IF NOT EXISTS idx_idempotency_records_user_scope
  ON public.idempotency_records(user_id, scope);

ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own idempotency records" ON public.idempotency_records
  FOR SELECT USING (auth.uid() = user_id);
