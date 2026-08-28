-- ============================================================================
-- 015_msme_pocket_categories.sql — widen pocket category enums (ADR-001 D2,
-- MSME_PHASED_BUILD_PLAN §5.2)
-- ============================================================================
-- Adds the 12 MSME business categories (stock, supplier, licence, tax,
-- salary, rent, operations, profit, owner_draw, growth, marketing,
-- equipment). Individual categories stay valid — the change is additive.
-- Same drop/recreate pattern as 003_pocket_categories_housing_family.sql.

ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pockets_category_check;
ALTER TABLE public.pockets
  ADD CONSTRAINT pockets_category_check
  CHECK (category IS NULL OR category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family',
    'stock', 'supplier', 'licence', 'tax', 'salary', 'rent',
    'operations', 'profit', 'owner_draw', 'growth', 'marketing', 'equipment',
    'other'
  ));

ALTER TABLE public.fixed_expenses DROP CONSTRAINT IF EXISTS fixed_expenses_category_check;
ALTER TABLE public.fixed_expenses
  ADD CONSTRAINT fixed_expenses_category_check
  CHECK (category IN (
    'food', 'transport', 'leisure', 'personal', 'utilities',
    'healthcare', 'education', 'housing', 'family',
    'stock', 'supplier', 'licence', 'tax', 'salary', 'rent',
    'operations', 'profit', 'owner_draw', 'growth', 'marketing', 'equipment',
    'other'
  ));