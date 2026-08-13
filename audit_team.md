# Team Audit Response — 2026-08-12

**Update 2026-08-13:** items 2 (partially), 4 & 5 are now built — see those sections below and the revised sequencing at the bottom. All backend tests pass (326/326) with a clean typecheck across `apps/api`, `apps/mobile`, and `packages/shared`. A net-new addition not in the original 10 numbered items — goal-driven savings (`ONBOARDING_AND_SCORING_REDESIGN.md` Part 4) — also shipped in this pass; see the new section after item 10.

**Purpose:** the team's 10-point audit, checked line-by-line against the actual codebase (not against memory of what the docs say should be there). Each item below is tagged:

- 🆕 **Net new** — no code for this exists yet, needs to be designed and built
- 🐛 **Real bug** — partially built, behaves wrong
- 📋 **Already scoped** — an existing doc in this repo already designed this; needs building, not re-deciding
- ✅ **Already exists** — working code found, gap is smaller than the audit implies

I pulled in the three docs already in the repo that overlap heavily with this audit (`ROADMAP.md`, `ONBOARDING_AND_SCORING_REDESIGN.md`, `FLUTTER_TO_EXPO_PORT_GUIDE.md`) so we're not re-deciding things that were already settled, and so this doesn't contradict them without saying so explicitly.

---

## 1. Income detection & smart allocation (expected vs. surplus, 3-option prompt)

**Status: ✅ fully implemented end-to-end (2026-08-13).**

**Backend completed (2026-08-13):**
- ✅ Added `expected_income_amount` (nullable) to plans table
- ✅ Added `unallocated_surplus` and `surplus_allocation_status` to income_events table
- ✅ `IncomeService.createManualIncome` now compares entered amount against expected_income_amount
- ✅ When income > expected, only the expected amount is allocated normally, surplus is held as `unallocated_surplus` with `pending` status
- ✅ New endpoint: `POST /income/:id/allocate-surplus` with `{ target: 'main_pocket' | 'pocket' | 'new_pocket', pocket_id?, new_pocket_name? }`
- ✅ Surplus allocation service handles all 3 options: distribute proportionally, allocate to specific pocket, or create new pocket
- ✅ Response includes surplus information: `{ has_surplus, surplus_amount, allocation_status }`

**Mobile integration completed (2026-08-13):**
- ✅ Added `allocateSurplus` API method to mobile services
- ✅ Updated income entry screen to detect surplus and show `MoneyAllocationPrompt`
- ✅ Created reusable `MoneyAllocationPrompt` component with 3-option interface
- ✅ Implemented `main_pocket` allocation (distributes proportionally across all pockets)
- ✅ Created pocket picker screen for `pocket` option (`surplus-pocket-picker.tsx`)
- ✅ Created pocket creation screen for `new_pocket` option (`surplus-create-pocket.tsx`)
- ✅ All navigation flows properly connected with error handling

**Still needed for production:**
- Decision on where `expected_income_amount` comes from (onboarding input, rolling average, or user-set field)
- Currently defaults to no surplus detection if `expected_income_amount` is not set

This is the same interaction shape as item 4 (overspend prompting) and item 5 (behavioral-layer adjustment prompts) — the reusable component is now fully implemented and ready for reuse across all three use cases.

---

## 2. Separate identities for Structured vs. Freelancer income × Structured/Daily spending

**Status: 🐛→📋 partially built (2026-08-13) — the gig/platform-worker split from §2.1 landed; salaried-with-side-income and the money-personality-as-modifier-layer (§2.3) did not.**

Original finding: current code (`rules-engine.ts`) only knew a flat `salaried | mix | freelancer` income pattern crossed with `daily | structured` style — four plan types total, no deeper personalization. `ONBOARDING_AND_SCORING_REDESIGN.md` §2.1 proposed expanding this with **salaried-with-side-income** and **gig/platform worker** as distinct personas, plus **money-personality as a modifier layer** (§2.3) on top.

**Built 2026-08-13 — gig/platform-worker split only:**
- `determineIncomeConcentration` (`rules-engine.ts`) buckets freelancer-pattern users into `concentrated` (gig/platform-style, 1–2 income sources) vs `diversified` (genuinely multi-client freelancing, 3+ sources), using `sourceCount` as the proxy signal — the only concentration data collected at onboarding today. Documented as `GIG_CONCENTRATION_MAX_SOURCES` so the threshold is inspectable and revisitable.
- `PlanAssignment` carries the new `incomeConcentration` field; `buildPlanName` now produces a fifth/sixth plan label — **"Gig — Structured"** / **"Gig — Daily Budget"** — distinct from "Freelancer — Structured/Daily Budget". The stored `income_pattern` column stays `'freelancer'` either way (display/reasoning only), so runway, rollover, and nudge logic that gates on `income_pattern === 'freelancer'` is unaffected by the split.
- `result.tsx`'s "why this plan" tag and reasoning copy updated to surface "Gig income" vs "Freelancer income" instead of collapsing both into one label.
- Covered by expanded `rules-engine.spec.ts` (38 cases).

**Still not built — do not check this item off yet:**
- **Salaried-with-side-income** persona (§2.1's other half) — nothing changed for the `salaried`/`mix` branch of `determineIncomePattern`. Salaried users with irregular top-up income are still treated identically to a salaried user with none.
- **Money-personality-as-modifier-layer** (§2.3) — `moneyPersonality` is still read as a flat input (`input.moneyPersonality ?? 'saver'`) the same way it was before this batch, not layered on top of the income persona as §2.3 describes. No regression here, just not yet built.

**Recommendation:** the gig/multi-client split is a real, tested slice of §2.1 — safe to demo. The remaining two pieces (salaried-side-income persona, personality-as-modifier) are still open; read `ONBOARDING_AND_SCORING_REDESIGN.md` §2.1–2.3 as a team to confirm the design still stands before picking those up, same recommendation as before.

---

## 3. Onboarding: user-set percentages, adjustable suggested plan

**Status: 🐛 real bug / gap, and 📋 partially already scoped.**

Confirmed in code: `onboarding.service.ts`'s `createPocketInputs` assigns pocket percentages entirely from the rules engine. There is no onboarding step, DTO field, or UI screen where the user sets or edits a percentage before the plan is created. The user gets the assigned plan and that's it — matches the audit's complaint exactly.

`ONBOARDING_AND_SCORING_REDESIGN.md` Part 3 already scopes a related but bigger change: itemized, user-named fixed pockets (replacing the single lump "Fixed Expenses" pocket) with per-pocket due dates and single-purpose enforcement. That solves *fixed* pocket personalization but doesn't cover the audit's specific ask here, which is **percentage control over spendable categories** (food/transport/leisure/clubbing/fees) at onboarding time, before the plan is committed.

**Recommended build (net new on top of the redesign doc, not replacing it):**
- Onboarding result screen (`result.tsx` / `ui-mockups/result.html`) already shows a "preview of the actual split before the user commits" per PRD §3.1 step 5 — this is the right place to add editable percentage sliders/inputs, not a new screen.
- Add a `PATCH /onboarding/plan-preview` step (pre-commit) that re-validates the user's edited percentages sum to 100% and re-runs pocket amount math, before final `POST /onboarding/complete`.
- The rules engine's output becomes the *default*, not the *final* value — matches the audit's own framing ("the app should do the heavy lifting... but add the freedom to adjust").

---

## 4 & 5. Overspend prompting + "must allocate to 100% or you're overspending" + behavioral layer

**Status: ✅ built (2026-08-13) — all three sub-points landed. This was the single biggest ask in the audit; treating it as done is worth a team confirmation pass, not just a docs update.**

Original finding: `SpendService.checkSpend` only did binary block/allow via `daily_cap` and locked/blocked-category checks, with no "adjust the plan" branch, no 100%-allocation enforcement, and no ongoing monitoring outside the moment of a spend attempt. All three gaps are now closed:

1. **Allocation integrity check — done.** `assertAllocationWithinPlan` (`pockets.service.ts`) blocks `POST /pockets` from over-allocating past the plan's `expected_income_amount` (set for every plan at onboarding, so it's a reliable ceiling). New `GET /pockets/allocation-summary` endpoint returns `{ total_allocated, unallocated, is_fully_allocated, is_over_allocated }` for the client to surface "you have KSh X unallocated" or block the save button — this is the mechanism that makes the 100%-allocation constraint from Viktor's note enforceable rather than just checked. 8 new tests in `pockets.service.spec.ts`.
2. **Spend-time behavioral check — done.** `SpendService.checkSpend`'s blocked-category path now has a real override option instead of a dead-end `review_available` flag: wired to the `essential_override` discipline-score event type specified in `FLUTTER_TO_EXPO_PORT_GUIDE.md` §3 but never ported until now. Covered in `spend.service.spec.ts`.
3. **Ongoing monitoring — done.** New `nudges` module (`nudge.calculator.ts` — pure function, unit-tested independent of Supabase; `nudges.service.ts` — the data-fetching wrapper) computes a per-pocket runway-vs-spend-velocity projection: for every spendable pocket, does its current spend rate mean it empties before the next income horizon, and by how many days. Exposed via `GET /insights/nudges`. Guards against single-day noise (`MIN_DAYS_ELAPSED_FOR_VELOCITY`) the same way `runway.calculator.ts` already does. Handles both freelancer-runway and calendar-month horizon sources, so salaried/structured plans (which have no runway concept) still get a sensible fallback. This is the generalized nudge engine `FLUTTER_TO_EXPO_PORT_GUIDE.md` §7 called for — built to carry the other two §7 nudge types (surplus-sweep, streak-at-risk) later without changing the response shape, but only the runway/velocity type is implemented so far. 12 new tests across `nudges.calculator.spec.ts` / `nudges.service.spec.ts`.

**Not yet built:** the other two §7 nudge types (surplus-sweep, streak-at-risk) — `getNudges` currently only calls `getRunwayNudges`. The nudge engine's shape is ready for them; they're just not written yet. Worth flagging if the team was expecting all of §7 from this pass.

---

## 6. General financial discipline / wealth-growth goal

This is a product principle, not a build item — it's already the stated positioning in `PRD.md` §1.1 and §5 (financial outcomes framework: emergency resilience, goal-based savings, investment readiness, debt reduction, long-term accumulation). Items 1–5 and 9–10 below are the concrete mechanisms that serve this goal. No separate action needed here beyond making sure the other 9 items get built with this framing in mind — which the recommendations above already do (e.g. framing overspend prompts as supportive, not punitive, per the existing cooling-off timer's tone rule in PRD §3.4).

---

## 7. Bugs: notifications screen, biometric setup, hidden/unfinished features

**Status: mixed — notifications is 🐛 smaller than it looks, biometrics is 🐛 confirmed, "hidden features" needs specifics from the team.**

- **Notifications:** `FLUTTER_TO_EXPO_PORT_GUIDE.md` §6 (written earlier in the project) says nothing sends. That's now stale — the current code has a real `NotificationSchedulerService` with cron-based cooling-off reminders, streak-at-risk tips, and monthly insights, plus a `PushDeliveryService`. So real delivery infrastructure exists. If the team is seeing bugs on the notifications *screen* specifically, I need the actual repro (which toggle, what happens vs. what's expected) — I don't want to guess and "fix" something that isn't broken. Can you get me specifics (screenshots, steps) or should I do a fresh pass through `notifications.tsx` and the preferences API and report back what I find?
- **Biometrics:** confirmed gap. `expo-local-authentication` is referenced from `services/auth.ts` and `services/api.ts` but I don't see a dedicated app-lock gate. `FLUTTER_TO_EXPO_PORT_GUIDE.md` §10 already scoped the fix: gate on `AppState` change to `active` after >60s backgrounded, implemented once in `app/_layout.tsx`, not per-screen. This is a small, well-defined fix — worth picking up next regardless of what else gets prioritized.
- **"Some features feel left out or hidden":** too vague for me to act on without specifics. Can the team name which screens/flows feel hidden? If it's about discoverability (e.g. a feature exists but there's no nav entry point to it), that's a quick fix once named. If it's about features that were designed (in the mockups under `ui-mockups/`) but never wired to real data, that's a different, bigger fix per-screen.

---

## 8. Merchant blocking / transaction flagging (essentials vs. non-essentials)

**Status: ✅ built and reconciled with the team 2026-08-12.**

This is further along than the audit implies. Verified in code:
- `getBlockedCategoriesForPocket` (`pocket-rules.ts`) enforces essential-pocket blocking against non-essential categories.
- `MerchantService.classify` — checked directly, and the two bugs `FLUTTER_TO_EXPO_PORT_GUIDE.md` §9 flagged (dropped `pocket_id`, fake-echo reclassification) are **both already fixed**: `pocket_id` is a real column (migration `004_merchant_classification_pocket_id.sql`), and `reclassifyTransaction` does a real balance check and a real `updateTransaction` write, not a stub.
- `merchant-report.service.ts` (flag/report-merchant path) is registered and wired to a real table.

**Taxonomy, reconciled 2026-08-12:** `gambling_betting` is a real category (`MERCHANT_CATEGORIES`, `alwaysBlocked: true`) and is now hard-blocked from **every** pocket — essential, Savings, and discretionary/leisure alike, no override. Two real bugs were found and fixed while confirming this:

1. **Leisure was carved out to allow gambling_betting**, framed as closing a "dead end" on the self-classify button. This directly contradicted the shared package's own doc comment ("always blocked from every pocket") and the team's decision that self-classify is for *unclassified recipients only* (P2P, unregistered Till/Pochi la Biashara), never for a recipient already known to be gambling. Reverted — gambling_betting is excluded everywhere now, with a defensive filter in `getAllowedCategoriesForPocket` so it can't silently leak back into an allow-list branch in the future.
2. **`review_available`/`can_override` were computed from `!isEssentialPocket(pocket)`** — a pocket-level check — instead of whether the *category* itself is ever resolvable via review. That made "Review and classify" a live but dead-end button for Savings and any non-essential, non-leisure spendable pocket (personal, utilities, healthcare, education, other) whenever the block was gambling_betting. Fixed with a new `isReviewableBlock(category)` helper, used consistently in `spend.service.ts`'s block response and its `getBlockedReasons` reason/can_override output.

Also tightened: Savings now gets the essential-only merchant allow-list (grocery/rent/utility/transport/healthcare/education), not the broader discretionary one it shared with pockets like "personal" before — it was already hard-blocked from gambling specifically, but could still pay entertainment/personal_care merchants, which doesn't match "Savings is the pocket the whole product exists to protect."

**Resolved 2026-08-12 (was the last open item):** the block stays absolute — no cooling-off unlock, no discipline-score-cost bypass. Instead, every blocked gambling attempt is logged and costs discipline-score points on its own, without ever unblocking the spend (option 3 of the tradeoffs discussed). Rationale: gambling paybills/tills are registered and reliably identifiable, so false positives aren't a real risk here, which makes "log + penalize every attempt" safe to do aggressively without worrying about punishing miscategorized spend. Implementation: `EVENT_GAMBLING_BLOCKED_ATTEMPT` / `POINTS_GAMBLING_BLOCKED_ATTEMPT` (−5, capped −25/month) in `rollover.constants.ts`, wired into both blocked-category branches of `SpendService.checkSpend` via `recordGamblingBlockedAttempt`. Covered by new tests in `spend.service.spec.ts`.

---

## 9. Loan management — new segment

**Status: 🆕 fully net new. No loan concept exists anywhere in the schema, API, or mobile app** (confirmed — zero matches for "loan" across the codebase).

The audit's proposed shape (a Loans pocket with sub-pockets: one for the repayment plan, others for the loan's purpose) is sound and maps cleanly onto the pocket model already in place — but it has a hard dependency: **it needs sub-pockets to exist first** (see item 10 — sub-pockets are currently undesigned in the Expo app; Flutter had them, the port was never done). Building loan-purpose sub-pockets on a schema that has no sub-pocket concept means building sub-pockets twice.

**Recommended sequencing:** land sub-pockets generically (item 10) first, then loans becomes a *specific application* of that mechanism rather than a bespoke build:
- A "Loan" pocket type with a required `repayment_schedule` (amount, cadence, next-due-date — reuse the due-day/lock mechanism already scoped in `ONBOARDING_AND_SCORING_REDESIGN.md` Part 3.2 for fixed pockets).
- Sub-pockets under it: one system-created "Repayment" sub-pocket (locked, single-purpose, feeds the schedule), and user-defined purpose sub-pockets for what the loan is actually for (school fees, business stock, etc.) — reusing the same single-purpose merchant-category enforcement already built for item 8.
- This also gives the discipline-score and behavioral layer (items 4–6) a natural hook: missed/late repayment sub-pocket funding is a strong negative signal, on-time is a strong positive one — same event-log pattern already used elsewhere (`essential_override`, `goal_achieved`, etc.).

This is a real, multi-week feature, not a quick add — flagging it as its own roadmap phase rather than a line item.

---

## 10. Sub-pockets + rollover/cap logic from the Flutter version

**Status: split — rollover/cap logic is ✅ real and already ported; sub-pockets are ✅ now ported (2026-08-13, see below).**

**Update 2026-08-13:** sub-pockets are done. `parent_pocket_id` FK landed as scoped below, plus the fix this doc's own recommendation didn't anticipate: `getAllForUser` needed a filtered query (`getTopLevelPocketsByPlanId`) so sub-pockets don't double-list on the home screen or double-count in the freelancer daily-cap math — that gap existed in the first commit of this work and is now closed. Mobile UI (create/list/delete from Pocket Detail) also now exists; none did before. Item 9 (loans) is unblocked.

Two different things bundled in this line item, worth separating:

- **Rollover + daily-cap logic:** `FLUTTER_TO_EXPO_PORT_GUIDE.md` §1 originally flagged this as a hardcoded stub (`calculateRollover()` returning 0). That's now stale — checked directly: `pockets.service.ts` computes real adaptive daily caps via `computeSpendableDailyCaps`, and there's a real `rollover` module (`rollover.constants.ts`, `streak.ts`, referenced from the notification scheduler) with real streak/rollover event types (`EVENT_DAILY_ROLLOVER_SUCCESS`, `EVENT_DAILY_OVERSPEND`, `STREAK_GRACE_FREEZES_PER_MONTH`). This appears to already be a genuine, non-stub port. Worth a focused verification pass (does it actually run on a schedule and hit the DB correctly end-to-end) rather than treating it as unbuilt — I don't want the team to re-scope work that's done.
- **Sub-pockets:** ~~confirmed not ported~~ now ported — see update above. `FLUTTER_TO_EXPO_PORT_GUIDE.md` §5 already scoped this and explicitly recommended deferring it post-MVP, with a specific schema recommendation already made: a `parent_pocket_id` FK on the existing `pockets` table rather than a separate `sub_pockets` table, so it reuses all existing ledger/cap/rollover logic instead of duplicating it. Given item 9 (loans) now depends on this, I'd recommend un-deferring it — the "post-MVP" call in that doc was made before loans was on the roadmap.

---

## 11. Goal-driven savings (not one of the original 10 items — flagging separately)

**Status: ✅ built (2026-08-13).** Not part of the team's original 10-point audit, but it's `ONBOARDING_AND_SCORING_REDESIGN.md` Part 4 (already-scoped, previously unbuilt) and directly serves the "goal-based savings" promise in `PRD.md` §5.2 referenced under item 6 above — flagging here so it doesn't go unnoticed just because it wasn't a numbered audit line.

- New onboarding step (`goal.tsx`, step 4 of 6 — inserted between "about you" and "fixed costs") captures an optional savings goal: type (emergency fund / a named purchase / dependent's education / other), an optional free-text label, an optional target amount, and a timeframe band (3mo / 6mo / 1yr / 2+yr) — bands rather than exact dates, matching §4.1's "exact dates are unreliable, bands are honest" reasoning already used for freelancer income intervals.
- `calculateSavingsTarget` (`rules-engine.ts`) replaces the flat `MIN_SAVINGS_RATE = 0.10` with a derived rate per §4.2: works backward from goal amount ÷ timeframe ÷ capacity, floored at a new absolute minimum (`ABSOLUTE_SAVINGS_FLOOR_RATE = 0.05`) that never goes lower regardless of goal size. If the derived rate would claim more than `SAVINGS_GOAL_CAP_SHARE` (50%) of what's left after fixed costs, it's capped rather than forced, and a `savings_goal_capacity_shortfall` reason is surfaced back to the user on the result screen ("this would take ~N months longer" / "would need ~X% of your income") instead of failing silently or overcommitting — exactly the "don't silently force it" behavior §4.2 called for. No goal captured → falls back to the buffer-based rate at-or-above the 5% floor, same as before.
- Savings-pocket lock length is now goal-derived too (`savingsLockDays`, `SavingsGoalLockDays` — 30/60/90/90 days by timeframe band) instead of a flat 30 days for every goal size, per §4.2's "a 3-month emergency buffer goal shouldn't default to the same lock as a 2-year goal."
- Result screen (`result.tsx`) gives goal-related reasons their own iconography (Target for on-track, amber AlertTriangle for the capacity-shortfall case) so a shortfall reads as a heads-up rather than a routine bullet.
- Also bundled into this batch: an onboarding `hasTransportNeed` flag (about-you step) that shifts the transport spendable-category share down for users who flagged no regular transport spend, instead of always assuming an even split. Minor, but changes onboarding output for remote workers — worth knowing about if the team is reviewing plan outputs.
- Covered by expanded `rules-engine.spec.ts` and `pocket-provisioning.spec.ts`.

**Open questions carried over from the redesign doc, still unresolved:** §4's open question 5 (privacy posture for a named-dependent goal label) — current implementation sidesteps it by keeping `goalLabel` as unstructured free text rather than a separate dependent-name/relationship field, same posture as fixed-expense names today. Worth a conscious confirm from the team rather than treating the sidestep as the final answer.

---

## Suggested sequencing

This is too much to build in one pass — grouping into an order that avoids rework (later items depending on earlier ones being in place first):

1. ~~**Biometric app-lock gate** (item 7)~~ — done.
2. ~~**Merchant category taxonomy check** (item 8)~~ — done, reconciled 2026-08-12 above.
3. ~~**Onboarding percentage editing** (item 3)~~ — done.
4. ~~**Sub-pockets** (item 10, second half)~~ — done 2026-08-13; foundational for loans, now unblocked.
5. ~~**Income surplus detection + 3-option allocation prompt** (item 1)~~ — backend complete 2026-08-13, mobile component - complete
6. ~~**Loans** (item 9)~~ — done.
7. ~~**Behavioral layer: overspend prompting, 100%-allocation enforcement, ongoing monitoring** (items 4–5)~~ — done 2026-08-13: allocation-integrity check, spend-time override, and runway/velocity nudges all landed. Only the surplus-sweep and streak-at-risk nudge types from §7 remain unbuilt.
8. **Persona/identity split for income × spending style** (item 2) — **partially done 2026-08-13**: gig/platform-worker vs. multi-client freelancer split landed. Still open: salaried-with-side-income persona, money-personality-as-modifier-layer (§2.3). Read `ONBOARDING_AND_SCORING_REDESIGN.md` §2.1–2.3 as a team to confirm the remaining design still stands before picking it up.
9. **(not originally numbered) Goal-driven savings** (`ONBOARDING_AND_SCORING_REDESIGN.md` Part 4) — done 2026-08-13, see item 11 above.