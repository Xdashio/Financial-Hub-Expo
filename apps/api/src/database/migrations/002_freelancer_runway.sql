-- ============================================================================
-- Freelancer adaptive runway — see docs/FREELANCER_RUNWAY.md
-- ============================================================================
-- Self-reported pay-cadence estimate captured at onboarding (banded: weekly
-- /biweekly/monthly/irregular, mapped to a day count in
-- packages/shared/src/schemas/index.ts's IncomeIntervalDaysByBand). Used by
-- RunwayService as a fallback until the user has >= 2 real income_events to
-- derive a historical cadence from. NULL for salaried/mix plans — the CHECK
-- constraint only enforces positivity when the value is present, it doesn't
-- require it.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS income_interval_days INTEGER CHECK (income_interval_days IS NULL OR income_interval_days > 0);

COMMENT ON COLUMN public.plans.income_interval_days IS
  'Freelancer-only. Onboarding-time estimate (days) of the gap between payments, used as a fallback by RunwayService before real income_events history exists. NULL for salaried/mix plans.';