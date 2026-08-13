-- ============================================================================
-- Money personality as a modifier layer (audit_team.md item 2 batch 2 /
-- ONBOARDING_AND_SCORING_REDESIGN.md §2.3)
-- ============================================================================
-- `moneyPersonality` was captured at onboarding (rules-engine.ts) but never
-- persisted anywhere past the initial plan-assignment call — every later
-- read of it (reallocations cooling-off, notification cadence, insights
-- ordering) had nothing to read. This adds it to `plans` so it survives
-- past onboarding and is available to the modifier-layer consumers.
--
-- Defaults to 'saver' (same fallback rules-engine.ts already used for a
-- missing answer: `input.moneyPersonality ?? 'saver'`) so existing rows and
-- clients that don't send the field keep the same effective behavior as
-- before this migration.
-- ============================================================================

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS money_personality TEXT NOT NULL DEFAULT 'saver'
    CHECK (money_personality IN ('spender', 'saver', 'avoider'));