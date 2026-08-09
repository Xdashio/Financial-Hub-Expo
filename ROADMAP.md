# Roadmap — Financial Hub

Phased from empty repo → MVP showcase → embeddable product with billing. Timeframes are intentionally left as relative (not calendar dates) since this is a slow, clean build with an unfunded team — sequence matters more than deadlines here.

> **2026-08-09 update:** the codebase was audited against this roadmap (see `BACKEND_FRONTEND_AUDIT.md` for full findings). Short version: Phase 0/1 progress is real but the "Phase 1 in progress" checklist below undersold how much of what looked done is actually blocked by database schema drift discovered during the audit — several backend modules that read as "built" will throw errors against a real database. A new **Phase A (Stabilize)** is inserted below, before any further Phase 1 screen-wiring work, to fix that drift and close a test-coverage gap in the most consequential business logic in the app. Do this first — building new features on top of a drifted schema means re-doing them once the schema is fixed. The old `IMPLEMENTATION_PLAN.md`, `API_IMPLEMENTATION_PLAN.md`, and `FRONTEND_UI_IMPLEMENTATION_PLAN.md` are kept for historical detail (some of their task breakdowns and code sketches are still useful reference) but are **superseded by this roadmap** as the source of truth for sequencing — they were written from a docs-level read of the repo, not a code-level audit, and their "5 real / 2 stub" backend framing undercounted the actual blockers.

**Strategic context:** Financial HUB is a behavior-driven financial intelligence layer that structures income before spending, automates purpose-based allocations, protects savings, and helps individuals build long-term financial resilience across the financial institutions they already use. The roadmap reflects this positioning as infrastructure, not competition to existing financial institutions.

## Phase 0 — Foundation (current)
- [x] Core concept defined (pockets, protected savings, 4 plan types, reallocation friction)
- [x] Core screens designed (Onboarding → Result → Home ×2 → Detail → Reallocate → Insights → Profile)
- [x] Product docs written (this doc set)
- [x] Confirmed: standalone MVP showcase first, Individual segment only, no wallet/PSP (manual income entry), clean new tech stack — existing Flutter/Supabase wallet codebase left untouched, not extended
- [] Confirmed: company registration is on hold, blocked on funding — not started
- [x] Repo scaffolded (frontend + backend skeletons, empty but structured)
- [] Decide the open questions in `PRD.md` §8 before writing business logic — several are still genuinely open, not defaults to assume:
  - Daily Budget mode (global vs per-pocket)
  - Reallocation cooling-off timer design
  - Merchant categorization / MCC blocking UX
  - Revenue model (explicitly not agreed — do not build against it)

## Phase A — Stabilize (do this before any further Phase 1 work)
Goal: close the gap between what the code assumes and what the database actually enforces, so every module that already "works" keeps working once real data flows through it. Nothing in Phase 1 below should be picked up until this phase is done — several Phase 1 items depend on modules this phase fixes.

- [x] **Resolve the two diverged schema migrations** (`apps/api/src/database/migrations/` vs `apps/api/supabase/migrations/`) — `apps/api/src/database/migrations/` is canonical; `apps/api/supabase/migrations/` is now a generated copy (`npm run db:sync`) with a do-not-edit README
- [x] **Fix `merchant_classifications` schema drift** — `user_id` column added, unique constraint is `(user_id, recipient_key)`, and `PocketsService.getMerchantScope` drops the `pocket_id` filter and keys off `pocket.kind` instead
- [x] **Fix `discipline_scores` schema + onConflict drift** — composite `UNIQUE (user_id, period)` constraint added; repository's `upsertDisciplineScore` targets `onConflict: 'user_id,period'`
- [x] **Register `MerchantReportModule`** in `app.module.ts`, paired with a real `merchant_reports` table
- [x] **Create `notification_preferences` table** and replace the notifications stub with real persistence (update-then-insert in `SupabaseRepository.upsertNotificationPreferences`, preserving untouched fields)
- [x] **Fix manual income entry not moving pocket balances** — decided `monthly_allocation` is the ceiling; `IncomeService.createManualIncome` now updates it directly on allocation, consistent with `ReallocationsService.complete()`
- [x] **Write real tests for `OnboardingService`** — `onboarding.service.spec.ts` now mocks the repository and asserts on `assign()` behavior across plan-type/spending-habit combinations, not a duplicate of the implementation
- [x] **Unify the two disconnected discipline-score mechanisms** — both `PocketsService` and `ReallocationsService` now go through a shared `DisciplineScoreService`, backed by the `discipline_scores` table, which `InsightsService` reads
- [x] **Fix the `fixed_expenses` status-update hack** — real `status` column (`active`/`inactive`) added; `ProfileService.updateFixedExpenseStatus` writes to it instead of mangling `name`
- [x] Remove dead `transactionsApi.create()` client code — `apps/mobile/src/services/api.ts`'s `transactionsApi` now only has `getByPocketId`

**Exit criteria:** `npx jest` passes (133 api tests + 25 shared tests, including real `OnboardingService` tests) and `pnpm typecheck` is clean across mobile/api/shared. Verified at the code level against `BACKEND_FRONTEND_AUDIT.md`'s "Critical: Schema Drift & Runtime-Breaking Bugs" section on 2026-08-09. **Caveat:** the "exercised against an actual local Supabase/Postgres instance" portion of this exit criterion was not independently re-verified in this pass (no local Postgres/Supabase CLI available) — confirm that leg separately before treating Phase A as fully closed in a strict CI sense.

## Phase 1 — MVP showcase (Individual segment only)
Goal: a clickable, real (not fake-static) app that demonstrates the core thesis to potential SACCO/bank partners.

- [x] Auth (Supabase, phone-OTP based per the settled `auth-otp.html` mockup) — real, guard applied consistently across controllers
- [x] Onboarding flow wired to real state — income, spending habits, fixed expenses; rules-engine plan assignment is deterministic and inspectable, matches PRD; **only remaining gap is Phase A's test-coverage item**
- [x] Daily Budget mode — implemented as per-pocket daily caps with a rollup hero, matching the settled PRD §8 decision
- [x] Home (both Daily and Structured variants) — wired to real pocket data via `pocketsApi`
- [ ] Pocket detail — **backend summary/merchant-scope endpoints exist but merchant-scope is blocked on Phase A's C2 fix; screen itself is still mock data, not yet wired**
- [ ] Manual income entry screen — **no backend module gap (income API is real), but needs Phase A's C5 fix before the numbers it shows would be trustworthy, and the screen isn't built yet**
- [ ] Merchant categorization / MCC-style spend restriction — **blocked on Phase A (C2); screen (`classify.tsx`) is mock, spend-check API itself is solid**
- [x] Reallocation flow — pick/review/cooldown/success screens wired to a real API; **skip-cooldown discipline-cost path is blocked on Phase A's C3 fix**
- [x] Insights screen — wired to real behavioral event log and discipline score; **will show inconsistent numbers vs. the time-lock screen until Phase A's discipline-score unification lands**
- [x] Profile + fixed expenses — plan/profile CRUD is real and wired; **fixed-expenses screen itself (`fixed-expenses.tsx`) is still mock despite the backend being ready — pure frontend-wiring task, no backend blocker**
- [ ] Notifications settings — blocked on Phase A (needs the new table + real service)
- [ ] Report merchant — blocked on Phase A (needs the module registered + new table)
- [ ] Time-lock screen — backend is solid and ready; screen itself (`time-lock.tsx`) is still mock, pure frontend-wiring task
- [ ] Blocked-spend screen — backend is solid and ready; screen itself is still mock, pure frontend-wiring task
- [ ] One cohesive demo script/dataset (e.g. two seeded users — one Daily, one Structured — so the adaptive-shell story is demoable live)

**Exit criteria:** you can hand a phone to a partner, walk through onboarding → plan → a week of simulated activity → a reallocation → insights, and every number on screen is real, not hardcoded.

### Phase 1 sequencing (screens ready to wire the moment Phase A lands)
Once Phase A is done, these are pure frontend-wiring tasks with no backend blocker — safe to parallelize across however many people are available, roughly in this order (dependency-free ones first):
1. Fixed expenses screen (`fixed-expenses.tsx`) — backend already solid today, doesn't even need to wait for Phase A
2. Time-lock screen (`time-lock.tsx`) — backend already solid today, doesn't even need to wait for Phase A
3. Blocked-spend screen (`blocked-spend.tsx`) — backend already solid today, doesn't even need to wait for Phase A
4. Pocket detail screen — needs Phase A's C2 (merchant scope) fix first
5. Merchant classification screen (`classify.tsx`) — needs Phase A's C2 fix first
6. Notifications screen — needs Phase A's new table + real service
7. Report-merchant screen — needs Phase A's module registration + new table
8. Manual income entry screen (new build, no mockup-to-screen gap listed above but referenced in PRD §3.8/§3.1) — needs Phase A's C5 fix first so the numbers are trustworthy

## Phase 2 — Depth on Individual segment
- [ ] Freelancer income pattern support (irregular income handling, not just salaried)
- [ ] Retake/adjust plan flow from Profile
- [ ] Real fixed-expense detection (statement upload or account-link integration — pick based on Phase 0 decision)
- [ ] Discipline score refinement — validate with real/test users whether the numeric score framing lands well or needs to change (flagged as open question in PRD)

## Phase 3 — MSME segment
- [ ] Discovery pass specifically for MSME needs (categories, multi-user visibility, tax/stock-style pockets) — do not assume it's "Individual with different labels" without checking
- [ ] MSME onboarding + plan variant
- [ ] MSME-specific Insights (cash flow patterns differ significantly from personal spending patterns)
- [ ] Event planner / ticketing money-management sub-case (vendor-escrow-style pockets, ticket revenue allocation) — evaluate as one MSME vertical among others, not a default template; needs its own scoping, not carried over unchanged from earlier exploration

## Phase 4 — Embeddable layer (post-funding)
- [ ] Define the SDK/embedding contract (what a host app calls, what gets rendered, theming hooks for partner branding)
- [ ] Multi-tenant data model (partner-scoped)
- [ ] Versioned public API + docs
- [ ] Pilot integration with one real host (even a sandboxed/test integration with a bank or SACCO app) before opening to more partners
- [ ] Company registration (Ltd) — required before this phase for contracts/merchant accounts; blocked on funding until then

## Phase 5 — Billing system
- [ ] Decide pricing model (usage/per-active-end-user vs flat per-partner — flagged as open question; note the revenue-model figures in `PRD.md` §5–6 are explicitly not agreed and are reference only)
- [ ] Metering event pipeline (reuse the behavioral event log infrastructure already built for Insights)
- [ ] Stripe Billing integration + partner-facing invoicing/usage dashboard

## Sequencing notes

- Phases 1–2 deliberately stay single-tenant and Individual-only — resist the urge to build multi-tenancy or MSME support before the core Individual experience is proven, since both would roughly double complexity for something not yet validated.
- Phase 4 (embeddable layer) is intentionally *after* Phase 2/3 product depth, not before — a partner integrating early would be integrating against a product that's still changing shape, which costs more trust than it's worth to gain a head start. It's also gated on funding in practice, since company registration and any real money movement can't start until then.
- Phase 5 (billing) only needs to exist once Phase 4 has a real pilot partner — don't build a billing system for hypothetical partners, and don't let the unresolved revenue model (PRD §5) leak into Phase 1–3 build decisions.