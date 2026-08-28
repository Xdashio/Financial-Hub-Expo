-- ============================================================================
-- 016_msme_phase2_segment_isolation.sql — Phase 2 segment isolation fixes
-- (known limits from Phase 1)
-- ============================================================================
-- 1. fixed_expenses is per-user/shared across segments — add segment discriminator
--    so Individual and MSME recurring costs do not overwrite each other.
-- 2. income_events likewise gains segment so surplus allocation can target the
--    correct segment's savings pocket (ADR-001 D1 + MSME_PHASED_BUILD_PLAN §5.1).
-- Both default to 'individual' so existing queries without a segment keep
-- working unchanged; MSME onboarding sets segment='msme' explicitly.
-- ============================================================================

-- fixed_expenses.segment
ALTER TABLE public.fixed_expenses
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual', 'msme'));

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_segment ON public.fixed_expenses(segment);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user_segment ON public.fixed_expenses(user_id, segment);

COMMENT ON COLUMN public.fixed_expenses.segment IS
  'Individual vs MSME recurring bill — see 016_msme_phase2_segment_isolation.sql / docs/MSME_PHASED_BUILD_PLAN.md §5.1';

-- income_events.segment — mirrors the plan that produced the surplus
ALTER TABLE public.income_events
  ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual', 'msme'));

CREATE INDEX IF NOT EXISTS idx_income_events_segment ON public.income_events(segment);
CREATE INDEX IF NOT EXISTS idx_income_events_user_segment ON public.income_events(user_id, segment);

COMMENT ON COLUMN public.income_events.segment IS
  'Which segment plan this income fed — see 016 / ADR-001';
