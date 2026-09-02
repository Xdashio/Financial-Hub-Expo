# MSME Phased Build Plan — Financial HUB

> **Status:** Working plan — approved to build sequentially  
> **Scope:** MSME/business segment only (does not replace Individual segment)  
> **Source spec:** `docs/Financial_HUB_MSME_Feature_Requirements.md:1-724`  
> **Roadmap anchor:** `ROADMAP.md:119` Phase 3 MSME | `PRD.md:23` deferred MSME  
> **Date:** 2026-08-28  
> **Owner:** Xdashio

---

## 0. Decisions Confirmed (2026-08-28)

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| D1 | `plans.segment` | Use single column `plans.segment TEXT CHECK ('individual','msme') DEFAULT 'individual'` | Keeps RLS `001_initial_schema.sql:394` and `one_active_plan_per_user` pattern intact; no new top-level table needed. One active plan **per segment** per user, so Individual and MSME can coexist. Mirrors existing `income_pattern` discriminator `database.types.ts:42` |
| D2 | Pocket categories | **Extend** `PocketCategorySchema` `packages/shared/src/schemas/index.ts:13` | Individual set (`food|transport|leisure|personal|utilities|healthcare|education|housing|family|other`) is personal-centric. MSME needs business semantics without breaking existing checks. Add business values + keep `other` fallback. See §5.2 |
| D3 | Build order | Phase 1 → Phase 2 → Phase 3 → 4 → 5 → 6 | General MSME pockets first (unblocks onboarding), then savings/surplus/loans, then the differentiator Funding Cascade (§27:692). No parallel tracks until engine is proven |

Graphify note: `graphify-out/` not yet installed — run `graphify update .` after Phase 1 migration lands and after each phase.

---

## 1. Executive Summary

MSME in Financial HUB is **not** "Individual with different labels" (`ROADMAP.md:120`). It has two isolated functional areas (`§24:571`):

1. **General MSME financial management** (`§2:30`–`§10:174`) — 6 custom main pockets, sub-pockets, recurring expenses, 10% savings + surplus prompt, restocking/capital, suppliers, licences/taxes, profit/owner draw, growth, Loan Plan + Repayment Pocket.
2. **Event/Project-based financial planning** (`§11:197`–`§23:553`) — one active Funding Cascade at a time (`§11.1:215`), exactly 3 levels Priorities/Needs/Wants (`§12:223`), target-based funding (`§13:253`), separation Funding vs Spending vs Remaining Cash (`§14:270`), forward cascade (`§15:308`), instalments (`§16:356`), visual progress (`§19:466`), optional controls (`§20:500`), excess prompts (`§21:515`), completion handling (`§22:534`).

The strongest differentiator (`§27:692`) is the **Funding Cascade Model** (aka Priority Allocation Engine) — income moves forward through predefined targets based on funding completion, not backward to refill spent categories. This is the build's critical path (Phase 3).

**Total effort:** ~9–10 weeks for 2 engineers (API + mobile) if done sequentially per phase.

---

## 2. Spec Coverage Map

| Spec § | Feature | Phase | Reuses existing |
|--------|---------|-------|-----------------|
| §2.2 | Max 6 custom main pockets | 1 | `pockets.service.ts:172` limit |
| §2.3 | Sub-pockets (Rent/Electricity/Wifi…) | 1 | `007_sub_pockets.sql:1` + `010_sub_pocket_split_percentage.sql:1` `split_percentage` |
| §3,5,6,7 | Recurring/Restocking/Suppliers/Licences | 1 | `fixed_expenses` table `001_initial_schema.sql:68` |
| §4 | Savings 10% + surplus→Savings prompt | 2 | `MIN_SAVINGS_RATE=0.10` `rules-engine.ts:48` + `income.service.ts:522` floor |
| §8 | Profit / owner allocation | 1 | pocket `kind` + `category` |
| §9 | Growth / expansion | 1 | pockets |
| §10 | Loan Plan + Repayment Pocket | 2 | `008_loans.sql:1` `loans.service.ts:36` `kind='loan'` + Repayment sub-pocket |
| §11 | One project at a time | 3 | new constraint `is_active_cascade` |
| §12 | Exactly 3 levels P/N/W | 3 | new `tier` enum |
| §13 | Target-based, Funded/Complete | 3 | new `target_amount` + `funding_status` |
| §14 | Funding vs Spending vs Remaining | 3,4 | `allocated_amount` separate from `spent_amount` |
| §15 | Forward cascade, no re-funding | 3 | pure `funding-cascade.service.ts` |
| §16 | Down payments / instalments | 3,4 | `msme_project_income_events` |
| §17 | Catering KES 500k example | 3 | test fixture |
| §18,19 | Dashboard + visual bars | 4 | `PlanningCycleScreen.tsx:527` pattern |
| §20 | Optional spending controls | 5 | `spend.service.ts:373` borrow flow analogue |
| §21 | Excess → prompt Needs/Wants/Savings | 5 | `income.service.ts:590` `allocateSurplus` pattern |
| §22 | Completed/closed handling | 5 | `planning_cycle_events` pattern `013_reserve:135` |
| §23 | 11 rules (immutable sequence etc.) | 3 | validation layer |
| §24 | Isolation general vs project | 3,6 | guard in income service |

---

## 3. Architecture Principles (must hold)

1. **Ledger is truth** — `supabase.repository.ts:566` `getPocketSummary` sums `allocation/reallocation_in` minus `spend/rollover`. Keep for general MSME pockets. Project funding needs a *parallel* truth: `allocated_amount` (sum of cascade allocations) vs `spent_amount` vs `remaining = allocated - spent` (`§14:286`). Funding status derives from `allocated >= target`, never from `remaining` (`§15.1:335`).
2. **Boundary §24:607** — General pockets and project cascade must not auto-interact. Enforced at service layer: `POST /income/manual` with `segment=msme` never touches `msme_project_tiers`, and `POST /msme/projects/:id/income` never touches `pockets`. Test both directions.
3. **Top-level filter invariant** — After audit, every read uses `getTopLevelPocketsByPlanId` `supabase.repository.ts:209` to avoid double-counting sub-pockets that inherit `plan_id`. Project tiers must not leak into that query (they live in separate tables).
4. **Limits carry over** — Max 6 top-level pockets `pockets.service.ts:164`, sub-pocket depth=1 `pockets.service.ts:382`, `split_percentage` 0–100 `010:25`, sibling sum ≤100 `pockets.service.ts:392`.
5. **Single active cascade** — Exactly one project per user may have `is_active_cascade=true` where `status='active'` (`§11.1:215`). Enforced by partial unique index (see §5.3).
6. **Immutability** — Tier order Priorities(1) → Needs(2) → Wants(3) is fixed; auto-allocation cannot be overridden (`§23:553` bullets 5–6). API rejects `PATCH` reordering.

---

## 4. Current State (what exists, what doesn't)

**Exists and reusable:**
- `apps/api/src/app.module.ts:41` 16 modules, `PocketsModule`, `IncomeModule`, `LoansModule`, `OnboardingModule`, `PlanningCycleModule`, `DailyAllocationModule` — add `MsmeModule` + `MsmeProjectsModule` alongside.
- `database.types.ts:91` `pockets` row (kind `savings|fixed|spendable|loan`, `parent_pocket_id`, `split_percentage`, `repayment_schedule`) + `plans` row (`type`, `income_pattern`, `expected_income_amount`).
- Allocation engine `income.service.ts:457` `calculateAllocationsBasedOnProportions` (proportional split, fixed cap `income.service.ts:485`, MIN_SAVINGS_RATE floor `income.service.ts:511`, rounding reconciliation `income.service.ts:553`), `applySubPocketSplits` `income.service.ts:373` via `common/sub-pocket-split.ts:53` `resolveSubPocketSplit`.
- Surplus handling `income.service.ts:590` three targets `main_pocket|pocket|new_pocket` — template for excess prompt.
- Loans `loans.service.ts:36` `kind='loan'` + Repayment sub-pocket `loans.service.ts:395` locked, `split_percentage:100`.
- Mobile shell: `apps/mobile/app/_layout.tsx:120` Stack, `apps/mobile/app/(tabs)/_layout.tsx:58` Tabs (Home, Runway conditional, Insights, Profile), `apps/mobile/app/(income)/entry.tsx:520` preview + idempotency `income.service.ts:98`, `apps/mobile/app/(loans)/index.tsx:330` list + create + detail, `apps/mobile/app/(pockets)/detail.tsx:1077` sub-pocket section + `SubPocketRebalanceSheet.tsx:429`.

**Does not exist (MSME greenfield):**
- Zero `msme` tables/columns (grep confirms). No `msme_projects`, no project tiers, no funding cascade service, no MSME onboarding branch, no MSME mobile tab.

---

## 5. Data Model

### 5.1 `plans.segment` (Phase 1 migration `014_msme_segment.sql`)

```sql
-- 014_msme_segment.sql
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'individual'
  CHECK (segment IN ('individual','msme'));
-- Replace one-active-plan index with per-segment variant
DROP INDEX IF EXISTS one_active_plan_per_user;
CREATE UNIQUE INDEX one_active_plan_per_segment_per_user
  ON public.plans(user_id, segment) WHERE status = 'active';
CREATE INDEX idx_plans_segment ON public.plans(segment);
COMMENT ON COLUMN public.plans.segment IS 'Individual vs MSME — see docs/MSME_PHASED_BUILD_PLAN.md §5.1';
```

`supabase.repository.ts:83` `getActivePlanByUserId(userId, segment?)` gains optional `segment` param (default `individual` for backward compat). `onboarding.service.ts:89` `commit` sets it; `pockets.service.ts:31` `getAllForUser` filters by segment.

Consequence: a user can have **two** active plans simultaneously — one `individual`, one `msme` — without duplicating auth or billing.

### 5.2 Pocket Category Extension (Phase 1 migration `015_msme_pocket_categories.sql`)

Current `PocketCategorySchema` `packages/shared/src/schemas/index.ts:13`:
`food|transport|leisure|personal|utilities|healthcare|education|housing|family|other`

Extended `BusinessPocketCategorySchema` (new export, `PocketCategorySchema` stays for Individual; union type `PocketCategory = IndividualCategory | BusinessCategory`):

```
-- Individual (existing, unchanged)
food, transport, leisure, personal, utilities, healthcare, education, housing, family
-- MSME additions (business semantics, §2–§10)
stock,           -- §5 restocking / purchase of stock
supplier,        -- §6 supplier payments
licence,         -- §7 licences
tax,             -- §7 taxes
salary,          -- §3 salaries and wages
rent,            -- §3 rent (distinct from housing)
operations,      -- §5 working capital / cash flow
profit,          -- §8 business profit
owner_draw,      -- §8 personal pay / owner allocation
growth,          -- §9 general growth/expansion
marketing,       -- §9 marketing / untapped market
equipment,       -- §9 new equipment
-- fallback
other
```

**Why these names:** they map 1:1 to spec bullets (`§3:78` Rent/Electricity/Wifi/Security/Salaries/Licences/Taxes, `§5:112` Restocking/Capital, `§6:124` Suppliers, `§7:136` Licences/Taxes, `§8:148` Profit/Personal pay, `§9:160` Marketing/Expansion/Equipment/Ventures, `§10:174` Loan). `rent`/`salary` split from `housing`/`family` so business rent and payroll are reportable separately from personal housing/family (per `pocket-rules.ts:59` `allowedCategoriesForPocketUnguarded` — extend mapping there).

Migration mirrors `003_pocket_categories_housing_family.sql:23` — drops and recreates `CHECK` constraints:

```sql
-- 015_msme_pocket_categories.sql
ALTER TABLE public.pockets DROP CONSTRAINT IF EXISTS pockets_category_check;
ALTER TABLE public.pockets ADD CONSTRAINT pockets_category_check
  CHECK (category IN ('food','transport','leisure','personal','utilities','healthcare','education','housing','family',
                      'stock','supplier','licence','tax','salary','rent','operations','profit','owner_draw','growth','marketing','equipment','other'));
ALTER TABLE public.fixed_expenses DROP CONSTRAINT IF EXISTS fixed_expenses_category_check;
ALTER TABLE public.fixed_expenses ADD CONSTRAINT fixed_expenses_category_check
  CHECK (category IN (...same set...));
```

Shared validation: `packages/shared/src/schemas/index.ts:168` `SPENDABLE_CATEGORY_LABELS` gains business labels; `pocket-rules.ts:33` `isEssentialPocket` keeps `fixed` + `food|transport|housing|family` for Individual but adds MSME essentials `rent|salary|stock|supplier|licence|tax` when `segment==='msme'` (guarded branch).

Backward compat: existing rows stay valid; new MSME pockets use new categories; Individual onboarding still resolves `food|transport|leisure|family` only `pocket-provisioning.ts:344`.

### 5.3 Project Funding Tables (Phase 3 migration `017_msme_projects.sql`)

> Renumbered from `016` — Phase 2 shipped `016_msme_phase2_segment_isolation.sql`
> (fixed_expenses/income_events segment columns) first, so the projects domain
> moves to the next free number.

```sql
-- 017_msme_projects.sql — Funding Cascade domain (§11–§15)
CREATE TABLE IF NOT EXISTS public.msme_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 100),
  kind TEXT NOT NULL CHECK (kind IN ('catering','wedding','trip','tour','contract','construction','agri','other')),
  contract_value NUMERIC NOT NULL CHECK (contract_value > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
  is_active_cascade BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT msme_projects_active_cascade_only_when_active
    CHECK (is_active_cascade = FALSE OR status = 'active')
);
-- Exactly one active cascade per user (satisfies §11.1)
CREATE UNIQUE INDEX msme_projects_one_active_cascade_per_user
  ON public.msme_projects(user_id) WHERE is_active_cascade = TRUE;
CREATE INDEX idx_msme_projects_user_id ON public.msme_projects(user_id);
CREATE INDEX idx_msme_projects_plan_id ON public.msme_projects(plan_id);
CREATE INDEX idx_msme_projects_status ON public.msme_projects(status);

CREATE TABLE IF NOT EXISTS public.msme_project_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('priorities','needs','wants')),
  sort_order SMALLINT NOT NULL CHECK (sort_order IN (1,2,3)),
  target_amount NUMERIC NOT NULL CHECK (target_amount > 0),
  allocated_amount NUMERIC NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
  spent_amount NUMERIC NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
  -- funding_status is derived: complete when allocated >= target. Stored as generated or computed in service.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT msme_project_tiers_one_per_tier_per_project UNIQUE (project_id, tier),
  CONSTRAINT msme_project_tiers_sort_matches_tier
    CHECK ((tier='priorities' AND sort_order=1) OR (tier='needs' AND sort_order=2) OR (tier='wants' AND sort_order=3)),
  CONSTRAINT msme_project_tiers_allocated_lte_target_plus_excess
    CHECK (allocated_amount >= 0) -- allow over-target only via explicit excess flow (Phase 5)
);
CREATE INDEX idx_msme_project_tiers_project_id ON public.msme_project_tiers(project_id);

-- Income that feeds the cascade (§16)
CREATE TABLE IF NOT EXISTS public.msme_project_income_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL CHECK (char_length(source) >=1 AND char_length(source) <=100),
  label TEXT CHECK (label IS NULL OR char_length(label) <=200),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msme_project_income_project_id ON public.msme_project_income_events(project_id);
CREATE INDEX idx_msme_project_income_date ON public.msme_project_income_events(date);

-- Atomic cascade allocations (audit trail for §17 example flow)
CREATE TABLE IF NOT EXISTS public.msme_project_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES public.msme_project_tiers(id) ON DELETE CASCADE,
  income_event_id UUID NOT NULL REFERENCES public.msme_project_income_events(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msme_alloc_tier_id ON public.msme_project_allocations(tier_id);
CREATE INDEX idx_msme_alloc_income_id ON public.msme_project_allocations(income_event_id);

-- Spending against a tier (§14:286) — separate from funding
CREATE TABLE IF NOT EXISTS public.msme_project_spends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_id UUID NOT NULL REFERENCES public.msme_project_tiers(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  merchant TEXT,
  category TEXT,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_msme_spends_tier_id ON public.msme_project_spends(tier_id);
CREATE INDEX idx_msme_spends_project_id ON public.msme_project_spends(project_id);

-- Excess prompts audit (§21)
CREATE TABLE IF NOT EXISTS public.msme_project_excess_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.msme_projects(id) ON DELETE CASCADE,
  income_event_id UUID NOT NULL REFERENCES public.msme_project_income_events(id) ON DELETE CASCADE,
  excess_amount NUMERIC NOT NULL CHECK (excess_amount > 0),
  chosen_target TEXT CHECK (chosen_target IN ('needs','wants','savings','keep')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- RLS — same pattern as 001_initial_schema.sql:372
ALTER TABLE public.msme_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_income_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_spends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msme_project_excess_prompts ENABLE ROW LEVEL SECURITY;
-- Policies: user_id = auth.uid() directly, or via project → user_id join for tiers/allocations/spends
-- (tiers: EXISTS (SELECT 1 FROM msme_projects p WHERE p.id = project_id AND p.user_id = auth.uid()))

-- updated_at trigger reuse
CREATE TRIGGER update_msme_projects_updated_at BEFORE UPDATE ON public.msme_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_msme_project_tiers_updated_at BEFORE UPDATE ON public.msme_project_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Key invariants in DB vs service:**
- `contract_value = sum(tier.target_amount)` — validated in service on create/update, not via DB trigger (avoids cross-row CHECK complexity).
- `funding_status` is **not stored** as a column that spending can flip; service computes `allocated_amount >= target_amount` on read, and enforces `spent_amount` never decrements `allocated_amount` (the `§15.1:335` core rule).
- `remaining_cash` per tier is `allocated_amount - spent_amount` (computed, `max(0, ...)` for display but not clamped in DB so overdraft is visible like `supabase.repository.ts:623` `getPocketSummary`).

### 5.4 Surplus / Loans — no new tables

- Savings/surplus reuses `income_events.unallocated_surplus` `001_initial_schema.sql:96` and `income.service.ts:590` `allocateSurplus` — Phase 2 adds MSME-aware prompt (see §7.3).
- Loans reuse `pockets.kind='loan'` `008_loans.sql:26` — Phase 2 exposes MSME Loan Plan UX on top of `LoansModule` `loans.service.ts:36`.

---

## 6. Shared Schemas (`packages/shared/src/schemas/index.ts`)

### 6.1 Segment + Business Categories (Phase 1)

```ts
// packages/shared/src/schemas/index.ts additions
export const SegmentSchema = z.enum(['individual','msme']);
export type Segment = z.infer<typeof SegmentSchema>;

export const BusinessPocketCategorySchema = z.enum([
  'stock','supplier','licence','tax','salary','rent','operations',
  'profit','owner_draw','growth','marketing','equipment',
]);
export type BusinessPocketCategory = z.infer<typeof BusinessPocketCategorySchema>;

export const PocketCategorySchema = z.enum([
  // individual (existing)
  'food','transport','leisure','personal','utilities','healthcare','education','housing','family',
  // msme additions
  'stock','supplier','licence','tax','salary','rent','operations','profit','owner_draw','growth','marketing','equipment',
  'other',
]);
export const MSME_SPENDABLE_LABELS: Record<BusinessPocketCategory, string> = {
  stock: 'Stock & Inventory', supplier: 'Suppliers', licence: 'Licences', tax: 'Taxes',
  salary: 'Salaries & Wages', rent: 'Rent', operations: 'Operations',
  profit: 'Profit', owner_draw: 'Owner Draw', growth: 'Growth',
  marketing: 'Marketing', equipment: 'Equipment',
};
```

`PocketSchema` `packages/shared/src/schemas/index.ts:457` gains `segment?: Segment` (derived from plan, not stored on pocket) for client filtering.

### 6.2 MSME Onboarding (Phase 1)

```ts
export const MsmeOnboardingInputSchema = z.object({
  segment: z.literal('msme'),
  businessName: z.string().min(1).max(100),
  monthlyRevenue: z.number().positive(),         // maps to expected_income_amount
  fixedTotal: z.number().nonnegative(),         // sum of recurring obligations
  fixedExpenses: z.array(FixedExpenseInputSchema).optional(), // Rent/Electricity/Wifi/Security/Salaries...
  hasEmployees: z.boolean().optional(),
  businessStage: z.enum(['starting','stable','growing']).optional(),
  savingsGoal: SavingsGoalInputSchema.optional(), // reuses §4 savings
  // custom pocket names — max 6, validated server-side
  customPockets: z.array(z.object({
    name: z.string().min(1).max(100),
    category: PocketCategorySchema,
  })).max(6).optional(),
});
```

Rules engine `rules-engine.ts:409` gains `assignMsmePlan(input): OnboardingAssignResult` — MSME always maps to structured-style allocation (no daily caps; business cash flow is monthly, not daily). Savings floor still `MIN_SAVINGS_RATE 0.10` `rules-engine.ts:48`.

### 6.3 Project Funding (Phase 3)

```ts
export const ProjectKindSchema = z.enum(['catering','wedding','trip','tour','contract','construction','agri','other']);
export const FundingTierSchema = z.enum(['priorities','needs','wants']); // exactly 3, §12:231
export const FundingStatusSchema = z.enum(['in_progress','complete']);
export const ProjectStatusSchema = z.enum(['draft','active','completed','cancelled']);

export const ProjectCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  kind: ProjectKindSchema,
  contractValue: z.number().positive(),
  tiers: z.object({
    priorities: z.number().positive(), // target amounts
    needs: z.number().positive(),
    wants: z.number().positive(),
  }).refine(v => v.priorities + v.needs + v.wants > 0, { message: 'At least one tier target required' }),
  // optional: allow wants=0 for lean projects — service normalizes
}).refine(v => Math.abs((v.tiers.priorities + v.tiers.needs + v.tiers.wants) - v.contractValue) < 0.01,
  { message: 'Tier targets must sum to contract value', path: ['contractValue'] });

export const ProjectIncomeInputSchema = z.object({
  amount: z.number().positive(),
  source: z.string().min(1).max(100), // Deposit / Progress / Final
  label: z.string().max(200).optional(),
  date: z.string().date(),
});

export const TierSummarySchema = z.object({
  id: z.string().uuid(),
  tier: FundingTierSchema,
  sortOrder: z.number().int().min(1).max(3),
  targetAmount: z.number().positive(),
  allocatedAmount: z.number().nonnegative(),
  spentAmount: z.number().nonnegative(),
  remainingCash: z.number().nonnegative(), // allocated - spent
  fundingStatus: FundingStatusSchema,
  fundingPercent: z.number().min(0).max(100),
});

export const ProjectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: ProjectKindSchema,
  contractValue: z.number(),
  status: ProjectStatusSchema,
  isActiveCascade: z.boolean(),
  tiers: z.array(TierSummarySchema).length(3),
  nextIncomeGoesTo: FundingTierSchema.nullable(), // null if all funded
  totalAllocated: z.number(),
  totalSpent: z.number(),
  totalRemaining: z.number(),
  excessPending: z.number().nullable(),
});
```

---

## 7. API Surface

### 7.1 Existing modules touched

| Module | File | Change |
|--------|------|--------|
| `OnboardingModule` | `apps/api/src/modules/onboarding/onboarding.service.ts:89` | Add `assignMsmePreview` / `commitMsme` with `segment='msme'`; reuse `pocket-provisioning.ts:102` but MSME branch allows freeform pocket names/categories |
| `PocketsModule` | `pockets.service.ts:164` `createForUser` | Add `segment` filter to `getActivePlanByUserId`; enforce max 6 per segment; allow MSME business categories per §5.2 Check |
| `IncomeModule` | `income.service.ts:70` `createManualIncome` | Guard: segment `msme` general income never cascades to `msme_project_tiers`; project income never hits `pockets` |
| `LoansModule` | `loans.service.ts:36` | Expose as "Loan Plan" for MSME (`§10:174`) — same service, MSME-specific copy on `project-detail` |
| `SupabaseRepository` | `supabase.repository.ts:83` | `getActivePlanByUserId(userId, segment?)`, `getPlansByUserId(userId)` |

### 7.2 New modules

**`MsmeProjectsModule`** `apps/api/src/modules/msme-projects/` (Phase 3)

```
msme-projects.controller.ts
  POST   /msme/projects              — create project + 3 tiers (validates contract_value sum)
  GET    /msme/projects              — list for user (filter status)
  GET    /msme/projects/:id          — summary with tier funding/spending/remaining/nextIncomeGoesTo
  PATCH  /msme/projects/:id          — update name/status (cannot reorder tiers)
  POST   /msme/projects/:id/activate — set is_active_cascade=true (deactivates previous)
  POST   /msme/projects/:id/income   — record income, run cascade, return allocations + excess
  POST   /msme/projects/:id/income/preview — dry-run cascade without persisting
  POST   /msme/projects/:id/spend    — spend from a tier (validates remainingCash)
  GET    /msme/projects/:id/transactions — paginated allocations + spends
  POST   /msme/projects/:id/complete — mark completed, surface remaining handling
  POST   /msme/projects/:id/excess/resolve — resolve excess prompt (needs/wants/savings/keep)

funding-cascade.service.ts           — pure logic, no DB (unit tested)
  cascade(amount: number, tiers: TierState[]): { allocations: {tierId, amount}[], excess: number }
  // §15:325 steps: find highest priority where allocated<target → allocate min(remaining, need) → cascade remainder

projects.service.ts                  — orchestrates repo + cascade + excess prompts

dto/create-project.dto.ts, dto/project-income.dto.ts
```

Registered in `apps/api/src/app.module.ts:41` alongside `LoansModule`.

### 7.3 Funding Cascade Logic (the critical algorithm)

`funding-cascade.service.ts` — mirrors `income.service.ts:457` but with **no re-funding** invariant:

```ts
// Priorities → Needs → Wants, §15:308
function cascade(amount: number, tiers: TierState[]) {
  // tiers sorted by sort_order 1..3, each { id, target, allocated }
  let remaining = amount;
  const allocations: { tierId: string; amount: number }[] = [];
  for (const tier of tiers.sort((a,b)=>a.sortOrder-b.sortOrder)) {
    if (remaining <= 0) break;
    const need = Math.max(0, tier.target - tier.allocated); // §13:259, §15:325 step 1
    if (need <= 0) continue; // already complete → never refill, §15.1:335
    const give = Math.min(remaining, need);
    allocations.push({ tierId: tier.id, amount: round2(give) });
    remaining = round2(remaining - give);
  }
  return { allocations, excess: round2(remaining) }; // excess → prompt §21:515
}
// Spending is separate:
// tier.spent += spendAmount; tier.remaining = tier.allocated - tier.spent; // §14:293
// fundingStatus stays 'complete' even if remaining goes to 0 — spending never decrements allocated
```

Test oracle is `§17:385` Catering KES 500k: `Priorities 250k / Needs 150k / Wants 100k`.

---

## 8. Mobile Navigation & Screens

**Nav shape** mirrors existing `apps/mobile/app/_layout.tsx:120` Stack + `apps/mobile/app/(tabs)/_layout.tsx:8` Tabs. MSME is a **segment switch**, not a 5th tab (avoids tab overload).

Existing tabs remain: `index` (Home), `freelancer-dashboard` (conditional), `insights`, `profile`. MSME adds a **segment switcher** at top of Home (chips Individual | Business) persisted in `usePlan.segment`. When `segment==='msme'`, Home body swaps to `MsmeHomeScreen`; `pockets` and `income` screens filter by segment.

**New route groups** (all `headerShown:false`, custom headers like `apps/mobile/app/(loans)/_layout.tsx:11`):

```
apps/mobile/app/(msme)/_layout.tsx          — Stack for MSME business overview
  index.tsx                                 — MSME Home: 6 pockets grid + sub-pockets (reuse detail.tsx:1077), savings strip, suppliers/restocking cards
apps/mobile/app/(msme-projects)/_layout.tsx — Stack for project funding
  index.tsx                                 — Project list (active, draft, completed) + Create CTA
  create.tsx                                — Wizard: name → kind → targets (Priorities/Needs/Wants) → contract_value preview → create
  detail.tsx                                — Project dashboard (§18:432) — Funding vs Spending vs Remaining per tier, visual bars (§19:466), nextIncomeGoesTo, log spend / add income
  income-entry.tsx                          — Project income entry (Deposit/Progress/Final) + preview cascade + excess prompt
  log-spend.tsx                             — Spend from a tier

apps/mobile/app/(modals)/msme-pocket-create.tsx   — 6-pocket creator (business categories)
apps/mobile/app/(modals)/project-excess-sheet.tsx — Excess prompt: "KES 20k excess — direct to Needs/Wants/Savings?" (§21:515)
apps/mobile/app/(modals)/project-complete-sheet.tsx — Completed handling: "KES 70k unused — keep or move to Savings?" (§22:534)
```

**Reused components:**
- `apps/mobile/src/components/pockets/SubPocketRebalanceSheet.tsx:429` for sibling rebalancing
- `apps/mobile/app/(income)/entry.tsx:82` preview pattern for project income preview
- `apps/mobile/src/components/pockets/RunwayVisualization.tsx:212` ring pattern for funding progress (adapt: 3 rings or 3 bars per tier)
- `apps/mobile/src/components/ui/BottomSheetModal.tsx` for excess/complete sheets

**Category chips:** extend `packages/shared/src/schemas/index.ts:168` labels into `CategoryIcon.tsx` mapping for `stock|supplier|licence|tax|salary|rent|operations|profit|owner_draw|growth|marketing|equipment`.

---

## 9. Phases in Detail (build in this order)

### Phase 0 — Discovery & Foundations (3–5 days, no user-visible change)

**Goal:** lock remaining design decisions before migration.

**Spec refs:** `§28:714` 7 gaps.

**Tasks:**
- [ ] Install graphify: `npm i -g graphify` / local, run `graphify update .`, confirm `graphify query "pockets AND income"` returns subgraph with `supabase.repository.ts`, `income.service.ts`, `pockets.service.ts`
- [ ] Resolve #1 info-overload UX: decide progressive disclosure for many sub-pockets (collapsible after 3 rows like `app/(tabs)/index.tsx:224`, searchable like `app/(pockets)/detail.tsx:292`)
- [ ] Resolve #2/3 excess prompt flow: which Need/Wants/Savings suggestion rule? Phase 2 reuses savings-at-10% rule; Phase 5 makes it project-aware (prefer most underfunded tier)
- [ ] Resolve #4/5 notification timing: borrow `notification-scheduler.service.ts` pattern for "funds inactive >30d" and "project completed with remaining"
- [ ] Resolve #6 boundary: confirm §24 isolation via service guard (see §3.2)
- [ ] Resolve #7 data model: confirm §5.3 schema vs pocket-reuse alternative (decision: separate tables, see ADR below)

**Exit:** ADR `docs/ADR-001-msme-segment-and-project-tables.md` merged; `graphify-out/graph.json` present.

---

### Phase 1 — General MSME Pockets Foundation (10–12 days)

**Goal:** a user can create an MSME plan with up to 6 custom main pockets + sub-pockets (business categories), visible in mobile.

**Spec in:** `§2:43` Business Pockets + `§2.3:54` Sub-Pockets + `§3:78` Recurring + `§5:112` Restocking + `§6:124` Suppliers + `§7:136` Licences/Taxes + `§8:146` Profit/Owner + `§9:160` Growth (scaffolding)

**Out:** savings floor (Phase 2), project funding (Phase 3).

**DB:**
- `014_msme_segment.sql` (§5.1)
- `015_msme_pocket_categories.sql` (§5.2)
- `npm run db:sync` `ROADMAP.md:23` to sync `apps/api/src/database/migrations/` → `apps/api/supabase/migrations/`

**Shared:**
- `packages/shared/src/schemas/index.ts:13` extend `PocketCategorySchema` per §5.2, export `SegmentSchema`, `BusinessPocketCategorySchema`, `MsmeOnboardingInputSchema` (§6.2)
- `packages/shared/src/types/index.ts:12` re-export new types

**API:**
- `SupabaseRepository.getActivePlanByUserId(userId, segment)` — default `individual` for backward compat
- `OnboardingModule`: `rules-engine.ts:409` add `assignMsmePlan` (always structured-style, no daily caps; savings `calculateSavingsTarget` `rules-engine.ts:323` still 10% floor), `pocket-provisioning.ts:102` MSME branch `buildMsmePocketInputs` (freeform names, business categories, no student single-pocket special case `pocket-provisioning.ts:344`)
- `PocketsService.getAllForUser(userId, segment)` + `createForUser` enforces max 6 per segment `pockets.service.ts:172`
- `IncomeService.allocatePreview` / `createManualIncome` respect segment filter and business category merchant scope (`pocket-rules.ts:59` extended)

**Mobile:**
- Onboarding branch: `app/(onboarding)/income.tsx` → add "Business" toggle → MSME questions (`businessName`, `monthlyRevenue`, `fixedTotal`, `fixedExpenses` with business categories) → `result.tsx` shows MSME plan + `categoryBreakdown` via `previewSpendableBreakdown` adapted
- Segment switcher: Home header chips `Individual | Business` (persisted `AsyncStorage`, like `moneyPersonality` `009_money_personality.sql:19`)
- MSME Home: `app/(msme)/index.tsx` — 6-pocket grid (reuses `app/(tabs)/index.tsx:500` structured variant), each card shows `getPocketStatus` `index.tsx:151` + `has_sub_pockets` `pockets.service.ts:58`, sub-pockets drawer per `app/(pockets)/detail.tsx:1077`
- Pockets detail: reuse existing, category chips now show business icons

**Tests:**
- `pockets.service.spec.ts`: max 6 per segment (not global), segment isolation (individual pockets invisible in MSME), business category accepted
- `income.service.spec.ts`: proportional split still holds with new categories; fixed cap `income.service.ts:485` still applies
- `onboarding.service.spec.ts`: MSME assign returns `segment:'msme'`, savings floor `MIN_SAVINGS_RATE`

**Exit:** hand-test: create MSME plan "Duka Kool" with 6 pockets (Recurring Expenses, Savings, Stock, Suppliers, Licences, Profit) → Recurring Expenses add 4 sub-pockets (Rent/Electricity/Wifi/Salaries) → `GET /pockets?segment=msme` returns 6 + nested sub-pockets; `GET /pockets?segment=individual` unchanged.

**Risks:** constraint recreation downtime — run on staging first; rollback is re-adding old CHECK.

---

### Phase 2 — Savings, Surplus & Loan Plan for MSME (7–9 days)

**Goal:** MSME savings behaves per `§4:94` (10% savings, surplus→Savings prompt) and Loan Plan (`§10:174`) surfaces as business loans.

**Spec in:** `§4:94` Savings + `§10:174` Loan Plan + `§21:515` savings half of excess (prequel)

**DB:** no new migration (reuse `001_initial_schema.sql:96` surplus cols, `008_loans.sql:26` loans). If needed, `ADD COLUMN pockets.savings_target_rate NUMERIC` for per-business override (optional, defer).

**Shared:** no new schemas; reuse `LoanCreateInputSchema` `packages/shared/src/schemas/index.ts:640` (add MSME `loanPurpose` presets: Marketing/Equipment/Expansion/Venture/Order per `§10:182`).

**API:**
- `IncomeService.createManualIncome` `income.service.ts:157` surplus detection already `hasSurplus = amount > expectedIncome` — for MSME, `expectedIncome = plan.expected_income_amount` (monthlyRevenue) with backfill `income.service.ts:142`. Surplus stays `pending` until `allocateSurplus` `income.service.ts:590`.
- Extend `allocateSurplus` target `savings` — when `dto.target==='savings'`, write `allocation` to the user's `savings` pocket (existing campaign `income.service.ts:620` main_pocket path scaled down to one pocket). Prompt text per `§4:107` "Move excess KSh X to Savings? [Confirm]" via `PushDeliveryService` `income.service.ts:270` fire-and-forget.
- `LoansService` `loans.service.ts:36` unchanged — MSME Loan Plan UX calls same `POST /loans` with `loanPurpose` marketing/equipment etc. Repayment Pocket is the existing `Repayment` sub-pocket `loans.service.ts:395`.

**Mobile:**
- Income entry `app/(income)/entry.tsx:150` `MoneyAllocationPrompt` already handles `has_surplus` → branch to `surplus-pocket-picker.tsx` / `surplus-create-pocket.tsx` — add MSME copy "Direct excess to Savings?"
- Savings pocket card: `SavingsPocketGoalsCard.tsx` + `SavingsGoalTracker.tsx` already — show progress vs `monthly_allocation*12` `app/(pockets)/detail.tsx:1018`
- Loans `app/(loans)/index.tsx:330` list filtered `segment=msme` via plan; `create.tsx:529` step 4 purpose chips now include MSME presets; `detail.tsx:697` Repayment sub-pocket + purpose sub-pockets reused

**Tests:**
- `income.service.spec.ts`: MSME income > expected → `surplus_allocation_status:'pending'`; `allocateSurplus({target:'savings'})` moves to savings only
- `loans.service.spec.ts`: loan with purpose `Marketing` creates Repayment + purpose sub-pocket split math `loans.service.ts:219` `split_percentage` correct

**Exit:** Add Income KES 120k on plan KES 100k → surplus 20k pending → allocate to Savings → savings balance +20k, event marked `allocated`; create Loan KES 200k Marketing → Loan Plan shows Repayment locked + Marketing purpose tier.

---

### Phase 3 — Funding Cascade Engine (12–15 days) — **Critical Path**

**Goal:** the differentiator (`§27:692`) works headless and correctly, no UI yet.

**Spec in:** `§11:197` One flow + `§12:223` 3 levels + `§13:253` Target-based + `§14:270` Separation + `§15:308` Cascade + `§15.1:335` No re-funding + `§16:356` Instalments + `§23:553` rules

**DB:** `017_msme_projects.sql` (§5.3) + `graphify update .`

**Shared:** `§6.3` Project schemas

**API — new `MsmeProjectsModule`:**

- `POST /msme/projects` — body `ProjectCreateInputSchema` (§6.3). Service validates `sum(tiers)==contractValue` (±0.01), creates project + 3 `msme_project_tiers` rows in a transaction. Set `is_active_cascade=false` by default; client calls `POST :id/activate` to own the single cascade.
- `funding-cascade.service.ts` — pure `cascade(amount, tiers)` (§7.3). No DB, 100% unit tested against `§17:385` fixture. Rounding: `round2` per `income.service.ts:742`, remainder to largest need (like `income.service.ts:568`).
- `POST /msme/projects/:id/income` — creates `msme_project_income_events` row, loads tiers `WHERE project_id`, calls `cascade`, writes `msme_project_allocations` rows inside transaction, increments `tiers.allocated_amount` atomically, computes `excess`, creates `msme_project_excess_prompts` if excess>0 (pending). Returns `{ allocations: [{tier, amount}], excess, nextIncomeGoesTo }`. Entire block is idempotent via `idempotency_records` `006_idempotency_records.sql:1` scope `msme_project_income` (reuse `income.service.ts:98` pattern).
- `POST /msme/projects/:id/income/preview` — same cascade without writes (like `income.service.ts:23` `allocatePreview`).
- `POST /msme/projects/:id/spend` — validates `tier.remaining = allocated - spent >= amount`, inserts `msme_project_spends`, increments `tiers.spent_amount`. **Never** decrements `allocated_amount` (core rule).
- `GET /msme/projects/:id` — computes `TierSummary` with `fundingPercent = allocated/target*100`, `fundingStatus = allocated>=target ? complete : in_progress`, `remainingCash = allocated - spent`, `nextIncomeGoesTo = first tier where allocated<target ordered by sort_order` (null if all complete).
- Guards: reject tier reorder (`PATCH` only allows `name/status`), reject manual allocation override (`§16:379` "cannot manually change sequence"), reject second active cascade (409 if `is_active_cascade` already taken by another active project).

**Tests (must pass before mobile):**

```ts
// funding-cascade.service.spec.ts — table-driven from §17:385
describe('cascade — Catering KES 500k (Priorities 250k, Needs 150k, Wants 100k)', () => {
  it('Payment 1 250k → Priorities complete, Needs/Wants 0', () => {
    expect(cascade(250_000, tiers)).toEqual({ allocations: [{tier:'priorities', amount:250_000}], excess:0 });
  });
  it('Spend 180k keeps Priorities Funding Complete but remaining 70k', () => {
    tier('priorities').spent = 180_000;
    expect(tier('priorities').fundingStatus).toBe('complete'); // spending does not reopen
    expect(tier('priorities').remainingCash).toBe(70_000);
  });
  it('Payment 2 100k cascades to Needs (Priorities not refilled)', () => {
    expect(cascade(100_000, tiersAfterP1)).toEqual({ allocations: [{tier:'needs', amount:100_000}], excess:0 });
  });
  it('Payment 100k excess → Needs 50k complete + Wants 50k + excess 0', () => {});
  it('Payment exceeding all targets → excess pending', () => {
    expect(cascade(600_000, freshTiers)).toEqual({ allocations: [...], excess:100_000 });
  });
  it('Instalments: Deposit 100k → Progress 150k → Final 250k cascade correctly', () => {});
  it('No re-funding: after spend, cascade never allocates to completed tier', () => {});
});
```

Portfolio of property tests: `allocated` monotonic, `fundingStatus` never regresses on spend, `sum(allocations)+excess == incomeAmount`, `nextIncomeGoesTo` skips completed tiers.

**Exit:** `POST /msme/projects/:id/income` headless flow matches `§17:385` exactly; `GET :id` shows `Funding Status: Complete` even when `Cash Left: 70k`. `graphify path "msme_projects" "tiers"` resolves.

**Defer:** dashboard visuals, excess resolution UI, completion flow (Phase 4–5).

---

### Phase 4 — Project Dashboard, Visuals & Instalments (10–12 days)

**Goal:** user sees `§18:432` Funding vs Spending vs Remaining + `§19:466` bars and can log spends/instalments.

**Spec in:** `§14:270` separation + `§18:432` dashboard + `§19:466` visual + `§16:356` staged payments (UI)

**API:**
- `GET /msme/projects/:id/transactions` — paginated joins of `allocations` + `spends` (like `pockets.service.ts:640` `getTransactionsForUser`).
- `GET /msme/projects` summary list: each row shows `totalAllocated/contractValue` + `nextIncomeGoesTo` badge.

**Mobile:**
- `(msme-projects)/index.tsx` — list (Active | Draft | Completed) segmented control, search, pull-to-refresh `apps/mobile/app/(loans)/index.tsx:330` pattern, FAB Create.
- `(msme-projects)/create.tsx` — 3-step wizard (like `app/(loans)/create.tsx:529`): 1 Name+Kind, 2 Targets (Priorities/Needs/Wants) with live `contract_value = sum(targets)` + validation, 3 Review → `msmeApi.createProject`.
- `(msme-projects)/detail.tsx` — fork of `app/(pockets)/detail.tsx:684` hero but with **3 tier cards** each:
  ```
  PRIORITIES (§19:476)
  Funding  Target: 250,000 Allocated: 250,000 Progress: 100% Status: Complete
  Spending Spent: 180,000 Cash Left: 70,000
  ████████████████████ 100%  ● Next payment goes to Needs (§19:495)
  ```
  Progress bars: `Priorities ███ 100% emeraldDeep`, `Needs 70% gold`, `Wants 15% clay` (`RunwayVisualization.tsx:49` color logic). Stats row: `Today remaining` analogue is `remainingCash`.
- `(msme-projects)/income-entry.tsx` — adapts `app/(income)/entry.tsx:520` with Source chips `Deposit|Progress|Final` + amount + preview cascade card (emeraldTint like `entry.tsx` allocation preview) showing `Priorities → KES X → Complete / Needs → KES Y`.
- Spend: `log-spend.tsx` branch for project tiers — amount + merchant + note, writes to `msme_project_spends`.

**Tests:** mobile snapshot for tier cards; API `GET summary` asserts `fundingStatus` vs `spent` independence.

**Exit:** demo `§17:385` end-to-end in app without API tools: create Catering 500k → Priorities 250k → add income 250k → dashboard shows Priorities 100% → log spend 180k → still 100% with 70k left → add income 100k → Needs 100k (not Priorities).

---

### Phase 5 — Excess, Completion, Spending Controls, Notifications (7–9 days)

**Goal:** `§20:500` optional friction + `§21:515` excess prompts + `§22:534` completed handling feel native, not bolted.

**Spec in:** `§20:500` + `§21:515` + `§22:534` + `§23:553` excess/savings prompt rule

**API:**
- Excess `§21:515`: `POST :id/income` already creates `msme_project_excess_prompts` with `excess_amount`. New `POST :id/excess/resolve` — `chosen_target ∈ {needs,wants,savings,keep}`:
  - `needs|wants` → allocates excess to that tier (validates not already complete; if complete, error + suggest `savings`)
  - `savings` → prompts confirm (payload `confirmSavings:true` required per `§21:526`), then writes `allocation` to user's MSME `savings` pocket via `income.service.ts:590` path
  - `keep` → leaves excess as `resolved` with `keep` (stays as unallocated project surplus until next income or completion)
  Push via `PushDeliveryService` `income.service.ts:270` pattern: "KES 20k excess on Wedding — direct to Needs?"
- Completion `§22:534`: `POST :id/complete` — validates caller intent, sets `status='completed'`, returns `{ remainingPerTier, totalRemaining, suggestion: 'Move to Savings? [confirm]' }`. `POST :id/complete/resolve` with `target:'savings'` moves remaining via ledger `reallocation_in` (like `pockets.service.ts:523` decreasing flow) with `reason='project_completed'`. Never silent `§22:549`.
- Spending controls `§20:500`: project field `spending_controls JSONB { lockWantsUntilPrioritiesAndNeedsFunded: bool, warnOnLowPrioritySpend: bool }`. `POST :id/spend` checks: if `tier='wants'` and controls.lock and not all higher tiers complete → 422 `Wants locked until Priorities+Needs funded — unlock?` with `confirmRisky:true` override (analogue to `spend/dto/spend-check.dto.ts:42` `confirmBorrow`). Warnings are non-blocking if `warnOnly`.

**Mobile:**
- `(modals)/project-excess-sheet.tsx` — `BottomSheetModal` (`SubPocketRebalanceSheet.tsx:429` pattern): shows `Excess KES 20,000` + allotment preview + 4 buttons (Needs emerald, Wants gold, Savings plum, Keep muted). Savings requires second tap "Confirm move to Savings".
- `(modals)/project-complete-sheet.tsx` — completed banner `colors.goldTint` with `NotificationsSheet`‑style copy: "Project completed — KES 70k unused. Keep in project or move to Savings?"
- Tier spend: if control blocks, show `ConfirmModal` "Wants unavailable until Priorities+Needs funded. Continue?"
- Push: reuse `apps/mobile/src/services/push.ts` `routeFromNotificationData` for `screen: msme-project-detail` with `projectId`.

**Exit:** excess income that overfunds all tiers surfaces prompt; user can route to Savings only after explicit confirm; completed project with remaining shows banner and requires action; controls are toggleable in `detail` → Settings.

---

### Phase 6 — Polish, Isolation Guard, Insights, Rollout (7–9 days)

**Goal:** boundary proven, insights meaningful for business, offline-safe, rollout-flagged.

**Tasks:**
- [ ] Isolation guard test `§24:607`: add integration spec `msme-isolation.spec.ts` — seed MSME general pockets + project tiers, run `POST /income/manual {segment:'msme', amount:50k}` → assert `msme_project_tiers.allocated` unchanged; run `POST /msme/projects/:id/income 50k` → assert `pockets` balances unchanged.
- [ ] MSME Insights (`PRD.md:78` Insights, `ROADMAP.md:122` MSME Insights) — new `insights` tab branch when `segment==='msme'`: reuse `InsightsService` but feed `msme_projects` aggregates (funding velocity, avg days per tier, discipline around Wants). Extend `apps/mobile/app/(tabs)/insights.tsx` with segment switch.
- [ ] Info-overload UX (`§28:714` #1): `app/(pockets)/detail.tsx:500` collapsible after 3 sub-pockets already exists — extend to MSME general pockets with >4 sub-pockets (e.g., Recurring Expenses). Add search like `detail.tsx:292` `getTransactions` searchQuery.
- [ ] Offline: `app/(income)/entry.tsx:129` `enqueueWrite('/income/manual', …)` queue already exists — add `enqueueWrite('/msme/projects/:id/income', …)` for project income/spend; flush on foreground `AppState` `app/_layout.tsx:64`.
- [ ] RLS audit: confirm policies cover new tables (tool: `supabase db diff`); `one_active_plan_per_segment` respected by `getRetakeEligibility` `onboarding.service.ts:324`.
- [ ] Feature flag: `plans.segment` itself is the flag, but add `feature_flags` JSONB on `users` or Unleash-style remote config for staged rollout (pilot → 10% → GA). Mobile hides MSME entry when flag off.
- [ ] Docs: update `ROADMAP.md:119` Phase 3 checkboxes, `PRD.md:23` MSME users, `docs/FINANCIAL_HUB_SYSTEM_DOCUMENTATION.md` § new "MSME Segment".
- [ ] `graphify update .` + `pnpm --filter shared build && pnpm --filter api typecheck && pnpm --filter mobile typecheck && pnpm test` green per `package.json:13/14`.

**Exit:** `pnpm lint && typecheck && test` passes; pilot user can complete full business cycle: MSME onboarding → general pockets → project creation → instalment #1 → spend → instalment #2 → excess prompt → completion → move remaining to Savings — all offline-capable and RLS-isolated.

---

## 10. Cross-Cutting Concerns

| Concern | Approach | Files |
|---------|----------|-------|
| **RLS** | New tables all `user_id = auth.uid()` plus tier join policy; segment column needs no RLS change — existing plan policies `001_initial_schema.sql:394` already scope by `user_id` | `017_msme_projects.sql` |
| **Idempotency** | Reuse `idempotency_records` `006_idempotency_records.sql:28` with new scopes `msme_onboarding`, `msme_project_income`, `msme_spend` | `income.service.ts:98` pattern |
| **Money math** | `sumMoney/netMoney` `supabase.repository.ts:623` in cents + `round2` `income.service.ts:742` + reconciliation to largest allocation `income.service.ts:568` — copy for cascade | `common/sub-pocket-split.ts:53` reference |
| **Push/offline** | `PushDeliveryService` fire-and-forget `income.service.ts:270` + `enqueueWrite` `app/(income)/entry.tsx:129` + `AppLockGate` flush `app/_layout.tsx:64` | `apps/mobile/src/services/data-sync.ts` |
| **Discipline** | Project spend discipline mirrors `loans.service.ts:352` `loan_repayment_ontime` (+5) vs late (−3) — add `project_spend_wants_before_priorities` (−2) event + `DisciplineScoreService` | `discipline-score.service.ts` |
| **Merchant scope** | Extend `pocket-rules.ts:59` `allowedCategoriesForPocketUnguarded` with business category→merchant mapping; project tiers have no merchant scope (they're funding buckets, spends are freeform) | `common/pocket-rules.ts:33` |
| **Observability** | `behavior_events` `001_initial_schema.sql:212` log `msme_onboarding_committed`, `project_created`, `cascade_applied`, `excess_prompted`, `project_completed` — surfaced in Insights `insights.service.ts` | `supabase.repository.ts:819` |

---

## 11. Timeline & Dependencies

```
Week 1        Phase 0 Discovery + ADRs
Weeks 2-3     Phase 1 General MSME Pockets  ──┐
Weeks 4       Phase 2 Savings/Surplus/Loans   │ sequential
Weeks 5-7     Phase 3 Cascade Engine          │ critical path
Weeks 8-9     Phase 4 Dashboard & Instalments ┘
Week 10       Phase 5 Excess/Completion/Controls
Week 11       Phase 6 Polish & Rollout
```

Phases are sequential by request (1→2→3). Phases 4–5 could be partly overlapped once Phase 3 engine tests are green, but plan assumes sequential for clarity.

**Blockers:** none — Individual segment untouched (segment default `individual` keeps existing queries working with `?segment` opt-in). No migration depends on Phase 0 beyond ADR.

---

## 12. End-to-End Acceptance Criteria

A tester with a fresh account can:

1. Choose **Business** at onboarding → MSME plan with 6 custom pockets (e.g., Recurring Expenses + 4 sub-pockets) — `Phase 1`.
2. Add Income KES 120k on plan KES 100k → surplus 20k → prompt → Move to Savings → Savings +20k — `Phase 2`.
3. Create Loan Plan KES 200k (Marketing 100k + Equipment 100k) → Repayment locked — `Phase 2`.
4. Create Project "Catering" contract 500k (Priorities 250k / Needs 150k / Wants 100k) → Activate cascade — `Phase 3`.
5. Record Deposit 250k → Priorities 100% Complete, Needs/Wants 0 — `Phase 3` (`§17:395`).
6. Log spend Priorities 180k → Funding stays Complete, Cash Left 70k — `Phase 3` (`§14:302`).
7. Record Progress 100k → Needs 100k (Priorities not refilled) — `Phase 3` (`§15.1:335`).
8. Record Final 150k → Needs completes to 150k, Wants 100k, no excess — dashboard shows 3 bars 100%/100%/100% — `Phase 4`.
9. Try to spend Wants before Priorities complete → optional block/warning — `Phase 5` (`§20:500`).
10. Overpay Final by 20k → excess prompt Needs/Wants/Savings → choose Savings → confirm → Savings +20k — `Phase 5` (`§21:515`).
11. Complete project with remaining → banner "KES X unused — Move to Savings?" → confirm → project `completed`, funds moved — `Phase 5` (`§22:534`).
12. Verify isolation: project income never changes general pocket balances and vice versa — `Phase 6` (`§24:607`).

All 12 verified on staging with `pnpm test` + manual device pass over offline (airplane mode queue).

---

## 13. Open Questions — Resolution via this Plan

| Spec `§28:714` gap | Plan resolution | Where |
|--------------------|-----------------|-------|
| 1 Sub-pocket overload UX | Progressive disclosure: collapsible after 3 + search (existing `detail.tsx:500` pattern) | Phase 1, 6 |
| 2 Excess prompt flow | Bottom sheet with 4 targets, Savings requires double-confirm (§21:526) | Phase 5 |
| 3 Suggestion rules | Prefer most underfunded tier; if tie, higher priority first | Phase 5 |
| 4 Notification timing | On excess pending + on completed with remaining + inactive >30d via existing scheduler | Phase 5 |
| 5 Lifecycle/closure | `status draft/active/completed/cancelled`, `completed_at`, excess resolution on complete | Phase 3,5 |
| 6 Boundary general vs project | Separate tables + service guard + isolation spec | Phase 3,6 |
| 7 Data model allocated/spent/cash | `allocated_amount` + `spent_amount` + computed `remaining` + `fundingStatus` (spending never flips funding) | Phase 3 |

---

## 14. Next Steps — How to Start Phase 1

```bash
# 0) Baseline
pnpm --filter shared build && pnpm --filter api typecheck && pnpm test
# 1) Create migration stubs
ls apps/api/src/database/migrations/ # canonical, e.g. 014_*.sql already at 013
# 2) Implement shared schemas first (no DB needed)
#    packages/shared/src/schemas/index.ts — SegmentSchema + BusinessPocketCategorySchema
#    pnpm --filter shared test -- packages/shared/src/schemas/index.spec.ts
# 3) Add plans.segment column + pocket category CHECK
#    apps/api/supabase/migrations/014_msme_segment.sql  (then npm run db:sync)
#    apps/api/supabase/migrations/015_msme_pocket_categories.sql
# 4) Wire onboarding + pockets segment param
#    apps/api/src/modules/onboarding/*, apps/api/src/modules/pockets/pockets.service.ts
# 5) Mobile segment switcher + MSME onboarding screens
# 6) Verify: graphify update . && graphify query "msme AND segment"
```

**Do not** start Phase 3 tables before Phase 1 is merged — keep diffs reviewable per `ROADMAP.md:141` "resist the urge to build multi-tenancy/MSME before core Individual is proven" (now proven, but still keep phases isolated).

---

*End of plan. Update this file as phases land; check off exit criteria in place so the next engineer knows where to resume.*
