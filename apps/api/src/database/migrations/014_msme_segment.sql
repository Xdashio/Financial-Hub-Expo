-- ============================================================================
-- 014_msme_segment.sql — MSME segment discriminator on plans (ADR-001 D1,
-- MSME_PHASED_BUILD_PLAN §5.1)
-- ============================================================================
-- A user may hold *two* active plans simultaneously — one `individual`, one
-- `msme` — so the "one active plan per user" guarantee becomes per-segment.
-- The default `'individual'` keeps every existing query (which passes no
-- segment) working unchanged.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual', 'msme'));

-- Replace the one-active-plan-per-user index with a per-segment variant.
DROP INDEX IF EXISTS one_active_plan_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS one_active_plan_per_segment_per_user
  ON public.plans(user_id, segment) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_plans_segment ON public.plans(segment);

COMMENT ON COLUMN public.plans.segment IS
  'Individual vs MSME — see docs/MSME_PHASED_BUILD_PLAN.md §5.1';