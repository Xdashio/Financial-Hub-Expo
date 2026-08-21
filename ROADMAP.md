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
- [x] Decide the open questions in `PRD.md` §8 before writing business logic — 3 of 4 original questions are now resolved (Daily Budget mode: per-pocket daily caps; cooling-off timer: 1–2h, skippable at 5-point cost; merchant categorization: soft block + self-classify). Still genuinely open, deferred to their respective later phases (not blockers for Phase 1): revenue model (Phase 5), fixed-expense detection sourcing and plan-reassignment trigger (both Phase 2), MSME segment shape (Phase 3), company registration (Phase 4, blocked on funding)

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

**Exit criteria:** `npx jest` passes (137 api tests + 25 shared tests, including real `OnboardingService` tests) and `pnpm typecheck` is clean across mobile/api/shared. Verified at the code level against `BACKEND_FRONTEND_AUDIT.md`'s "Critical: Schema Drift & Runtime-Breaking Bugs" section on 2026-08-09. **Caveat:** the "exercised against an actual local Supabase/Postgres instance" portion of this exit criterion was not independently re-verified in this pass (no local Postgres/Supabase CLI available) — confirm that leg separately before treating Phase A as fully closed in a strict CI sense.

> **2026-08-09 addendum (later same day):** two more runtime-breaking bugs were found and fixed via real device logs, neither caught by the original C1–C7 audit since both only surface against a live Postgres/PostgREST instance (the exact gap the caveat above flags):
> - **`income_events.label` was `NOT NULL`** in the schema despite being documented and coded as optional (`API_SPECIFICATION.md` §1.2, `CreateIncomeDto`) — crashed every manual income entry submitted without a label. Fixed: column is now nullable.
> - **`getReallocationsByUserId` used an unsupported two-level embedded-resource path in `.or()`** (`from_pocket.plan.user_id.eq...`) — PostgREST only supports one level, so the reallocations list endpoint threw `failed to parse logic tree` on every call. Fixed: resolves the user's pocket ids via their plan first, then filters `from_pocket_id`/`to_pocket_id` directly.
>
> Also fixed in the same pass: `@react-native-async-storage/async-storage` was pinned to `^3.1.1` in `apps/mobile/package.json`, a major version ahead of the `2.2.0` Expo SDK 57 actually bundles/expects (per `expo/bundledNativeModules.json`) — caused `Native module is null` crashes on physical devices. Pinned to the exact expected version. **Worth checking separately, not yet touched:** `react-native-gesture-handler` (`^3.1.0` installed vs `~2.32.0` expected) and `react-native-get-random-values` (`^2.0.0` vs `~1.11.0` expected) show the same kind of major-version drift.
>
> Separately (not a Phase A item, but same session): swept `Alert.alert()`-backed `showAlert`/`showConfirm` calls (device-native dialogs, ignore the app's theme) in favor of the existing `useAlertModal()` hook across the OTP/auth flow (`verify-otp.tsx`, `signup.tsx`, `signin.tsx`) and the reallocation/onboarding flows (`realloc-review.tsx`, `realloc-cooloff.tsx`, `result.tsx`, `fixed.tsx`). `app/(tabs)/profile.tsx`'s sign-out message intentionally still uses the native path — it fires after `router.replace()` unmounts the screen, so a hook-backed modal tied to that screen's own state would never render.

**Phase A Status (2026-08-16):** ✅ **COMPLETE** — All schema drift issues resolved, test coverage gaps closed, runtime-breaking bugs fixed. The backend foundation is now stable and ready for Phase 1 completion.

## Phase 1 — MVP showcase (Individual segment only)
Goal: a clickable, real (not fake-static) app that demonstrates the core thesis to potential SACCO/bank partners.

- [x] Auth (Supabase, phone-OTP based per the settled `auth-otp.html` mockup) — real, guard applied consistently across controllers
- [x] Onboarding flow wired to real state — income, spending habits, fixed expenses; rules-engine plan assignment is deterministic and inspectable, matches PRD; **only remaining gap is Phase A's test-coverage item**
- [x] Daily Budget mode — implemented as per-pocket daily caps with a rollup hero, matching the settled PRD §8 decision
- [x] Home (both Daily and Structured variants) — wired to real pocket data via `pocketsApi`
- [x] Pocket detail — wired to `pocketsApi.getSummary`/`getTransactions`, including paginated "load more" and pull-to-refresh
- [x] Manual income entry screen — `app/(income)/entry.tsx` built and wired to `incomeApi.createManual`; trustworthy now that Phase A's C5 fix landed
- [x] Merchant categorization / MCC-style spend restriction — `classify.tsx` wired to `merchantApi.classify` and `pocketsApi.getAll` (real pocket list replacing the hardcoded 4-pocket array)
- [x] Reallocation flow — pick/review/cooldown/success screens wired to a real API; **skip-cooldown discipline-cost path is blocked on Phase A's C3 fix**
- [x] Insights screen — wired to real behavioral event log and discipline score; **will show inconsistent numbers vs. the time-lock screen until Phase A's discipline-score unification lands**
- [x] Profile + fixed expenses — plan/profile CRUD is real and wired, including `fixed-expenses.tsx` (wired to `profileApi` — was mock, now real)
- [x] Notifications settings — `notifications.tsx` wired to `notificationsApi.getSettings`/`updateSettings`, backed by the real `notification_preferences` table
- [x] Report merchant — `report.tsx` wired to `merchantReportApi.createReport`, backed by the registered `MerchantReportModule` + real `merchant_reports` table
- [x] Time-lock screen — wired to `pocketsApi.getLockStatus/unlock/extendLock`, with biometric confirmation via `expo-local-authentication` before unlock and real discipline-score numbers in the result message
- [x] Blocked-spend screen — full chain wired: `detail.tsx` → `log-spend.tsx` (`spendApi.commit`) → on `blocked_category`, navigates here with real block data; `review_available` now passed through so the "Review and classify" option only shows when the backend says it applies
- [x] **Home screen nudges (2026-08-13)** — real gap closed: the header's avatar button (which just duplicated the Profile tab) is now a bell icon opening a `NudgesSheet` bottom sheet. Nudges (`src/services/nudges.ts`) are derived client-side from data Home already fetches — runway running low, a daily pocket near/over its cap, a time-locked pocket unlocking within 7 days, a discipline-score dip, a streak, or a rollover credit — not from a dedicated backend endpoint. **Not yet verified to compile/run**: no `node_modules` in the sandbox this was built in, so only a partial `tsc` pass (scoped to the new/changed files) succeeded; run `pnpm install && npx tsc --noEmit` and a device/simulator smoke test before treating this as done. Also worth a product decision: whether nudges eventually need server-side persistence (dismissal state, push delivery) or client-derived is the intended long-term shape.

**Exit criteria:** you can hand a phone to a partner, walk through onboarding → plan → a week of simulated activity → a reallocation → insights, and every number on screen is real, not hardcoded.

**Phase 1 Status (2026-08-16):** 🟡 **NEARLY COMPLETE** — All core screens are wired to real backend APIs. The main remaining work includes:
- Final verification and testing of all implemented features
- Performance optimization and polish
- User testing and feedback integration
- Documentation updates for partner demonstrations

## Phase 1.5 — Advanced Features (Spec Complete, Implementation Pending)

These features have detailed specifications complete but implementation has not yet started. They represent the next logical enhancements to the MVP showcase.

### 1.5.1 Emergency Unlock Feature
**Status:** ✅ **SPEC COMPLETE** — See `emergency-unlock-feature-spec.md`
**Implementation:** 🔄 **PENDING**

When all non-savings pockets are depleted, users can unlock funds from their savings pocket as an emergency measure. The feature analyzes their 30-day spending patterns to suggest a safe amount range, limits usage to once per month, and allocates the unlocked amount proportionally to non-savings pockets.

**Implementation Phases:**
1. Backend foundation (database, services, API endpoints)
2. Backend integration (pockets, transactions, limits)
3. Testing (unit, integration, edge cases)
4. Mobile UI (bottom sheet, amount selector, allocation preview)
5. Polish (analytics, A/B testing, user feedback)

### 1.5.2 Sub-Pocket Percentage Splits
**Status:** ✅ **SPEC COMPLETE** — See `subpocket-feature-spec.md`
**Implementation:** 🔄 **PENDING**

Replaces flat-amount sub-pocket model with percentage-of-parent allocation. When income is allocated, it automatically splits into sub-pockets based on defined percentages, with an overflow/borrow mechanic from parent reserved balance.

**Implementation Phases:**
1. Data model + core allocation logic
2. Overflow/borrow mechanics
3. Mobile UI (rebalance bottom sheet, amount selector)
4. Testing and validation

### 1.5.3 Enhanced Nudges System
**Status:** 🟡 **PARTIALLY IMPLEMENTED** — Client-side nudges in Home screen
**Backend Module:** ✅ **EXISTS** — `apps/api/src/modules/nudges/`
**Implementation:** 🔄 **PENDING** — Server-side persistence and push delivery

Current implementation uses client-side nudges derived from Home screen data. Future enhancement will include server-side nudges with persistence, dismissal state, and push notification delivery.

**Planned Enhancements:**
- Server-side nudges database
- Dismissal state tracking
- Push notification integration
- A/B testing framework for nudge effectiveness

### Phase 1 sequencing (screens ready to wire the moment Phase A lands)
All screens in the original sequencing list are now wired — kept below as a historical record only.
1. ~~Fixed expenses screen (`fixed-expenses.tsx`)~~ — done, wired to `profileApi`
2. ~~Time-lock screen (`time-lock.tsx`)~~ — done, wired to `pocketsApi` with biometric confirmation
3. ~~Blocked-spend screen (`blocked-spend.tsx`)~~ — done, full trigger chain wired via `log-spend.tsx`
4. ~~Pocket detail screen~~ — done, wired to `pocketsApi`
5. ~~Merchant classification screen (`classify.tsx`)~~ — done, wired to `merchantApi` + real pocket list
6. ~~Notifications screen~~ — done, wired to `notificationsApi`
7. ~~Report-merchant screen~~ — done, wired to `merchantReportApi`
8. ~~Manual income entry screen~~ — done, `app/(income)/entry.tsx` wired to `incomeApi`

## Phase 2 — Depth on Individual segment
- [ ] Freelancer income pattern support (irregular income handling, not just salaried) — **partially done 2026-08-13**: gig/platform-worker vs. multi-client freelancer split landed (see `audit_team.md` item 2). Remaining: salaried-with-side-income persona, money-personality-as-modifier-layer (`ONBOARDING_AND_SCORING_REDESIGN.md` §2.3).
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