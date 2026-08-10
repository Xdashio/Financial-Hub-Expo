-- ============================================================================
-- Batch 7: Expo push tokens + delivery idempotency
-- ============================================================================
-- Preferences already exist (notification_preferences). This migration adds:
-- 1. push_tokens — devices that can receive Expo push payloads
-- 2. notification_deliveries — dedupe so schedulers / event hooks don't
--    double-send the same cooling-off / milestone / monthly insight

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_push_token UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_notification_delivery UNIQUE (user_id, kind, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id
  ON public.notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_kind_sent
  ON public.notification_deliveries(kind, sent_at);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push tokens" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own push tokens" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notification deliveries" ON public.notification_deliveries
  FOR SELECT USING (auth.uid() = user_id);

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
