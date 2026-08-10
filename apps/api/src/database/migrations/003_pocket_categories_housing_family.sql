-- ============================================================================
-- Expand pocket / fixed-expense category enums
-- ============================================================================
-- Adds `housing` and `family` so rent/mortgage and dependents/family-support
-- lines are first-class categories (see ONBOARDING_AND_SCORING_REDESIGN.md
-- Part 6 #5 and Part 3). Postgres CHECK constraints must be dropped and
-- recreated to widen the allowed set.

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pockets_category_check;
ALTER TABLE public.pockets
  ADD CONSTRAINT pockets_category_check
  CHECK (category IS NULL OR category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family', 'other'
  ));

ALTER TABLE public.fixed_expenses DROP CONSTRAINT IF EXISTS fixed_expenses_category_check;
ALTER TABLE public.fixed_expenses
  ADD CONSTRAINT fixed_expenses_category_check
  CHECK (category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family', 'other'
  ));
