# Team Audit Response — 2026-08-12

**Purpose:** the team's 10-point audit, checked line-by-line against the actual codebase (not against memory of what the docs say should be there). Each item below is tagged:

- 🆕 **Net new** — no code for this exists yet, needs to be designed and built
- 🐛 **Real bug** — partially built, behaves wrong
- 📋 **Already scoped** — an existing doc in this repo already designed this; needs building, not re-deciding
- ✅ **Already exists** — working code found, gap is smaller than the audit implies

I pulled in the three docs already in the repo that overlap heavily with this audit (`ROADMAP.md`, `ONBOARDING_AND_SCORING_REDESIGN.md`, `FLUTTER_TO_EXPO_PORT_GUIDE.md`) so we're not re-deciding things that were already settled, and so this doesn't contradict them without saying so explicitly.

---

## 1. Income detection & smart allocation (expected vs. surplus, 3-option prompt)

**Status: 🆕 net new, with a real building block already in place.**

Manual income entry is real (`IncomeService.createManualIncome`, wired end-to-end). What's missing is the *detection + surplus branching* layer described in the audit:

- No concept of "expected income" to compare an incoming amount against.
- No surplus-handling prompt at all. Every income event currently allocates in full against the plan's existing pocket percentages — there's no "this is more than expected, want to save KES 2,000 separately?" branch.
- The 3-option response (main pocket / pick a pocket / create new pocket) doesn't exist anywhere in the API or the mobile app.

**What needs to be decided before building:** where "expected income" comes from. Options: (a) derived from the amount entered during onboarding, (b) a rolling average of the user's last N income events, (c) explicit "expected amount" field the user sets and edits. PRD §3.1 step 1 gestures at future *detection* from linked accounts but is explicit that MVP is manual entry — so for now "expected" has to be self-reported or inferred from history, not detected from a bank feed.

**Recommended build:**
- Add `expected_income_amount` (nullable) to the plan or a new `income_expectations` row.
- `IncomeService.createManualIncome` compares the entered amount against it. If ≤ expected (or no expectation set), allocate as today. If > expected, split: `min(amount, expected)` goes through the normal allocation pass, the remainder returns to the client as an `unallocated_surplus` amount with a `pending` transaction state.
- New endpoint: `POST /income/:id/allocate-surplus` with `{ target: 'main_pocket' | 'pocket' | 'new_pocket', pocket_id?, new_pocket_name? }`.
- Mobile: a new bottom-sheet screen (there's a mockup precedent in `ui-mockups/realloc-pick.html`'s pocket-picker pattern — reuse that UI, don't design a new one) triggered right after income entry when `unallocated_surplus > 0`.

This is the same interaction shape as item 4 (overspend prompting) and item 5 (behavioral-layer adjustment prompts) — worth building the "prompt user to confirm/adjust/redirect money" component **once**, generically, and reusing it for income surplus, overspend, and plan drift. Flagging that now so we don't build three near-identical modals.

---

## 2. Separate identities for Structured vs. Freelancer income × Structured/Daily spending

**Status: 📋 already scoped — `ONBOARDING_AND_SCORING_REDESIGN.md` Part 2.1 already redesigns this, and it's a bigger, better version of what's being asked here.**

Current code (`rules-engine.ts`) only knows a flat `salaried | mix | freelancer` income pattern crossed with `daily | structured` style — four plan types total, no deeper personalization. The audit's ask (separate identities per income-type × spending-style combo) is real, but the redesign doc already went further: it expands income personas from 2 to include **salaried-with-side-income** and **gig/platform worker** as distinct categories (research-grounded — side income and irregular top-ups are common even for salaried earners in this market, not just freelancers), and separately proposes **money-personality as a modifier layer** (§2.3) on top of the income persona, rather than folding personality into the plan-type decision itself.

This is genuinely aligned with "personalization of a person and their spending habits according to money psychology" from the audit — it's just already designed in more depth than the audit note describes. Roadmap Phase 2 has "Freelancer income pattern support (irregular income handling, not just salaried)" as an open item — this is the same work.

**Recommendation:** don't re-scope this from scratch. Read `ONBOARDING_AND_SCORING_REDESIGN.md` §2.1–2.3 as a team, confirm it still matches current thinking, then build it. If the team wants something narrower/faster than the full persona-plus-modifier model, say so explicitly and I'll cut it down — but building a second, competing design in parallel is how these docs drift out of sync with each other.

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

**Status: 🆕 mostly net new. One real piece already exists (daily-cap blocking); the "adjust the plan" branch and the general behavioral-monitoring layer don't.**

What exists today: `SpendService.checkSpend` blocks a spend outright when it would exceed a pocket's `daily_cap` or when it hits a locked/blocked category (`pocket_time_locked`, `blocked_category` responses, wired through to `blocked-spend.tsx`). That's binary block/allow — there's no "you're about to overspend, want to adjust the plan or pocket allocation instead?" branching, and no ongoing monitoring outside the moment of a spend attempt.

The 100%-allocation constraint (Viktor's note) is not enforced anywhere — nothing currently checks that percentages assigned to pockets sum to 100%, at onboarding or after a reallocation.

**This is the single biggest ask in the whole audit** — Viktor's own framing ("we need a lot of investment... a fully functional BEHAVIOURAL LAYER") is accurate; this isn't a bug fix, it's a new subsystem. Recommend scoping it as its own phase, not a line item alongside the others. Concretely it needs:

1. **Allocation integrity check** — a validator (shared between onboarding-plan-preview and reallocation) that rejects any state where a plan's pocket percentages don't sum to 100%, surfaced as "you're overspending" per Viktor's framing rather than a generic validation error.
2. **Spend-time behavioral check** — extend `SpendService.checkSpend` so that "would exceed cap" doesn't just block, it returns enough context (current balance vs. plan, pattern of recent similar spends) for the client to show three choices: adjust this pocket's allocation now, cancel the transaction, or (if truly justified) proceed and log it as an override event — reusing the `essential_override` event type already defined in `FLUTTER_TO_EXPO_PORT_GUIDE.md` §3's discipline-score rule set, which exists in Flutter's design but was never ported.
3. **Ongoing monitoring, not just point-in-time** — this is the part that's genuinely new work, not a port of anything: a background comparison of spend velocity vs. remaining runway per pocket, independent of any single spend attempt, that can proactively flag "you're on track to run out of Transport 6 days before your next income" before the user even tries to overspend. This is close in spirit to the "smart nudges" feature already scoped in `FLUTTER_TO_EXPO_PORT_GUIDE.md` §7 (surplus-sweep / streak-at-risk / runway-low nudges) — recommend building the nudge engine generically enough to carry this too, rather than as a separate system.

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

**Status: ✅ mostly already built, 🐛 one gap worth flagging.**

This is further along than the audit implies. Verified in code:
- `getBlockedCategoriesForPocket` (`pocket-rules.ts`) enforces essential-pocket blocking against non-essential categories.
- `MerchantService.classify` — checked directly, and the two bugs `FLUTTER_TO_EXPO_PORT_GUIDE.md` §9 flagged (dropped `pocket_id`, fake-echo reclassification) are **both already fixed**: `pocket_id` is a real column (migration `004_merchant_classification_pocket_id.sql`), and `reclassifyTransaction` does a real balance check and a real `updateTransaction` write, not a stub.
- `merchant-report.service.ts` (flag/report-merchant path) is registered and wired to a real table.

**What's still genuinely open:** the audit's specific example — rent/food/fees (essential) vs. gambling (non-essential) — the *category taxonomy* itself. Worth the team confirming: is "gambling" already in the blocked-category list today, or does it need adding? I'd want to check `pocket-rules.ts`'s category enum against the team's exact essential/non-essential list before calling this closed, since a missing category is a silent gap, not an error. If the team gives me the exact category list they expect blocked, I can verify or fix this in one pass.

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

**Status: split — rollover/cap logic is ✅ real and already ported; sub-pockets are 🆕 confirmed not ported, exactly as the audit says.**

Two different things bundled in this line item, worth separating:

- **Rollover + daily-cap logic:** `FLUTTER_TO_EXPO_PORT_GUIDE.md` §1 originally flagged this as a hardcoded stub (`calculateRollover()` returning 0). That's now stale — checked directly: `pockets.service.ts` computes real adaptive daily caps via `computeSpendableDailyCaps`, and there's a real `rollover` module (`rollover.constants.ts`, `streak.ts`, referenced from the notification scheduler) with real streak/rollover event types (`EVENT_DAILY_ROLLOVER_SUCCESS`, `EVENT_DAILY_OVERSPEND`, `STREAK_GRACE_FREEZES_PER_MONTH`). This appears to already be a genuine, non-stub port. Worth a focused verification pass (does it actually run on a schedule and hit the DB correctly end-to-end) rather than treating it as unbuilt — I don't want the team to re-scope work that's done.
- **Sub-pockets:** confirmed not ported. `FLUTTER_TO_EXPO_PORT_GUIDE.md` §5 already scoped this and explicitly recommended deferring it post-MVP, with a specific schema recommendation already made: a `parent_pocket_id` FK on the existing `pockets` table rather than a separate `sub_pockets` table, so it reuses all existing ledger/cap/rollover logic instead of duplicating it. Given item 9 (loans) now depends on this, I'd recommend un-deferring it — the "post-MVP" call in that doc was made before loans was on the roadmap.

---

## Suggested sequencing

This is too much to build in one pass — grouping into an order that avoids rework (later items depending on earlier ones being in place first):

1. **Biometric app-lock gate** (item 7) — small, well-scoped, no dependencies.
2. **Merchant category taxonomy check** (item 8) — needs one input from the team (the exact essential/non-essential category list) before I can call it done or fix it.
3. **Onboarding percentage editing** (item 3) — the smaller, well-bounded piece of the two onboarding asks.
4. **Sub-pockets** (item 10, second half) — foundational for loans; land the `parent_pocket_id` model.
5. **Income surplus detection + 3-option allocation prompt** (item 1) — build the reusable "confirm/adjust/redirect" prompt component here.
6. **Loans** (item 9) — now unblocked by sub-pockets.
7. **Behavioral layer: overspend prompting, 100%-allocation enforcement, ongoing monitoring** (items 4–5) — reuses the item-1 prompt component; this is the largest single item in the audit and deserves its own dedicated pass rather than being squeezed in alongside others.
8. **Persona/identity split for income × spending style** (item 2) — build from `ONBOARDING_AND_SCORING_REDESIGN.md` §2.1–2.3 once the team confirms that design still stands.

I need two things from the team before starting: confirmation on the sequencing above (or a different priority order if something's more urgent), and the specifics requested in item 7 (notifications repro) and item 8 (category list). Want me to start on #1–2 now while those specifics come in, or do you want to reorder first?