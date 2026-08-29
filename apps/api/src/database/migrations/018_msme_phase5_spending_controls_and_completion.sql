-- ============================================================================
-- 018_msme_phase5_spending_controls_and_completion.sql — Phase 5 polish
-- MSME spending controls, completion audit, and excess → savings plumbing.
-- (MSME_PHASED_BUILD_PLAN.md § Phase 5: §20 spending controls, §21 excess,
--  §22 completed handling). No new tables; only additive columns on
--  msme_projects so RLS and the per-user cascade index stay intact.
-- ============================================================================

-- Spending controls JSONB (§20:500) — optional friction stored per-project.
-- { lockWantsUntilPrioritiesAndNeedsFunded: bool,
--   warnOnLowPrioritySpend: bool }
-- Defaults to both off so existing Phase 3/4 projects keep their current
-- spend behaviour until the owner opts in via PATCH :id/spending-controls.
ALTER TABLE public.msme_projects
  ADD COLUMN IF NOT EXISTS spending_controls JSONB
    NOT NULL DEFAULT '{"lockWantsUntilPrioritiesAndNeedsFunded": false, "warnOnLowPrioritySpend": false}'::jsonb;

COMMENT ON COLUMN public.msme_projects.spending_controls IS
  'MSME optional spending controls (§20:500): lockWantsUntilPrioritiesAndNeedsFunded + warnOnLowPrioritySpend — see docs/MSME_PHASED_BUILD_PLAN.md Phase 5';

-- Completion audit (§22:534) — capture where the leftover cash was sent
-- when a completed project was resolved. Null until the user acts; either
-- resolved_to='savings' (funds moved) or 'keep' (left in tiers) mirrors the
-- excess prompt target set. Purely audit/UX, never a money-movement trigger
-- itself — the ledger rows in `transactions` are the source of truth.
ALTER TABLE public.msme_projects
  ADD COLUMN IF NOT EXISTS completion_resolved_at TIMESTAMPTZ;

ALTER TABLE public.msme_projects
  ADD COLUMN IF NOT EXISTS completion_resolved_to TEXT
    CHECK (completion_resolved_to IN ('savings', 'keep'));

COMMENT ON COLUMN public.msme_projects.completion_resolved_to IS
  'Phase 5 §22 — where remaining cash was directed after completion (savings|keep), null until resolved';

-- Defensive shape check: ensure spending_controls stays a JSON object when present.
-- Full key/value validation is enforced in the API (Zod schema) rather than here
-- to keep the migration forgiving of forward-compatible additions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'msme_projects_spending_controls_shape'
  ) THEN
    ALTER TABLE public.msme_projects
      ADD CONSTRAINT msme_projects_spending_controls_shape
        CHECK (spending_controls IS NULL OR jsonb_typeof(spending_controls) = 'object');
  END IF;
END $$;
