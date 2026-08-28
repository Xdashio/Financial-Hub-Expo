# ADR-001: MSME Segment & Project Funding Tables

> **Status:** Accepted
> **Date:** 2026-08-28
> **Context docs:** `docs/Financial_HUB_MSME_Feature_Requirements.md`, `docs/MSME_PHASED_BUILD_PLAN.md`
> **Phase:** 0 (Discovery & Foundations)
> **Supersedes:** none

---

## 1. Decision Summary

| # | Decision | Choice |
|---|----------|--------|
| D1 | Segment discriminator | `plans.segment TEXT CHECK ('individual','msme') DEFAULT 'individual'`, one active plan **per segment** per user |
| D2 | Pocket categories | Extend `PocketCategorySchema` with 12 business values; keep Individual set untouched |
| D3 | Build order | Sequential: Phase 1 → 2 → 3 (critical path) → 4 → 5 → 6, no parallel tracks until the cascade engine is proven |
| D4 | General pockets vs. project funding | Two isolated functional areas, separate tables, no automatic cross-flow (spec `§24`) |
| D5 | Funding-status source of truth | Derived (`allocated_amount >= target_amount`), never stored as a column spending can flip |
| D6 | Sub-pocket information overload | Progressive disclosure (collapse after 3, searchable) — reuse existing pattern, no new component |
| D7 | Excess-fund suggestion rule | Prefer the most underfunded tier; tie-break to the higher-priority tier |

Each is expanded below against the 7 open gaps in spec `§28`.

---

## 2. Verified Against Current Codebase

Before accepting this ADR, the following claims from `MSME_PHASED_BUILD_PLAN.md` were checked directly against the cloned repo (not assumed from the plan doc alone):

- `plans` table (`001_initial_schema.sql:27-42`): confirmed columns `type`, `income_pattern`, `status`, `expected_income_amount`, and `one_active_plan_per_user` unique index on `(user_id) WHERE status='active'`. No `segment` column exists yet — greenfield, matches D1.
- `pockets` table (`001_initial_schema.sql:44-61`): confirmed base `kind IN ('savings','fixed','spendable')` and `category` CHECK constraint. `loan` kind added later in `008_loans.sql:25-31` via drop/recreate CHECK — this is the exact pattern the plan reuses for D2's category extension, confirmed correct.
- Category-widening precedent (`003_pocket_categories_housing_family.sql`): confirms drop/recreate CHECK is the established migration pattern for both `pockets` and `fixed_expenses` in this codebase — D2's migration follows this precedent exactly.
- Pocket limit: `pockets.service.ts:172` hard-codes `existingPockets.length >= 6` with message "Maximum of 6 pockets allowed" — confirms the 6-pocket cap is real and currently global (not segment-scoped), which is the change D1/Phase 1 must make.
- Savings floor: `rules-engine.ts:48` — `MIN_SAVINGS_RATE = 0.10` — confirms the 10% floor cited in spec `§4` is already a live constant, reusable as-is for MSME (no new constant needed).
- Surplus flow: `income.service.ts:157-159` (`hasSurplus`/`surplusAmount` derived from `dto.amount > expectedIncome`) and `income.service.ts:590` (`allocateSurplus`) confirm the surplus-detection and surplus-allocation pattern the plan proposes to extend for MSME's savings-prompt (spec `§4`, `§21`) already exists and works generically off `plan.expected_income_amount` — no MSME-specific surplus math is needed, only a `segment`-aware prompt/copy branch.
- Module list (`apps/api/src/modules/`): confirmed 18 existing modules (pockets, income, loans, onboarding, planning-cycle, daily-allocation, etc.) and **no** `msme` or `msme-projects` module — confirms greenfield status claimed in plan §4.
- Migrations: highest existing file is `013_reserve_and_daily_allocations.sql` — confirms `014_msme_segment.sql` is the correct next migration number.

No contradictions were found. The plan's file:line citations are accurate as of this commit. `graphify` (the internal knowledge-graph tool referenced in `AGENTS.md`) is not available in this environment — the public `graphify` npm package is an unrelated "Random Graph Generator" library — so graph verification was done by direct source inspection instead. This should be re-run with the real tool wherever this ADR is picked up next, before Phase 1 migrations land.

---

## 3. Resolution of the 7 Open Design Gaps (spec `§28`)

### Gap 1 — Sub-pocket UX at scale (`§28` #1)
**Decision:** No new component. `app/(pockets)/detail.tsx` already collapses sub-pocket lists after the first 3 rows and supports search over transactions (`detail.tsx:292` `getTransactions` searchQuery pattern). Phase 1 extends the same collapse threshold to MSME's business sub-pockets (e.g. a 6-item "Recurring Expenses" breakdown of Rent/Electricity/Wifi/Security/Utilities/Salaries). Phase 6 revisits this once real MSME sub-pocket counts are observed in pilot usage — if businesses commonly need >8 sub-pockets under one main pocket, a grouped/collapsed-by-category view may be needed, but that's a Phase 6 polish decision, not a Phase 1 blocker.

### Gap 2 — Excess-fund prompt flow (`§28` #2)
**Decision:** Bottom sheet with exactly 4 targets — Needs, Wants, Savings, Keep — mirroring `SubPocketRebalanceSheet.tsx` interaction pattern. Savings requires a second explicit confirmation tap (spec `§21` requires "inform the user of the proposed allocation" before moving to Savings — a single tap doesn't satisfy that bar for money leaving the project entirely). Needs/Wants are single-tap since they stay within the same project. Built in Phase 5, not Phase 1 — the prompt has nothing to attach to until the cascade engine (Phase 3) exists.

### Gap 3 — Suggestion rule for Needs/Wants/Savings (`§28` #3)
**Decision:** When excess exists, default-highlight the **most underfunded tier by percentage** (lowest `allocated/target`), tie-break to the higher-priority tier (Needs before Wants). Savings is never the default suggestion — it's always an explicit user choice, since spec `§21` frames Savings as something the user is prompted toward, not something the system pre-selects. Rationale: this keeps the system's default bias toward finishing the project's own funding plan before diverting cash elsewhere, consistent with the "priorities first" philosophy running through the whole spec.

### Gap 4 — Notification timing for inactive/unused funds (`§28` #4)
**Decision:** Reuse whatever scheduler pattern backs existing push notifications (`PushDeliveryService`, `income.service.ts:270`) rather than building a new scheduler. Three triggers: (a) immediately when an excess prompt is created and left unresolved, (b) at project completion if remaining cash > 0, (c) after 30 days of no activity (no income event, no spend) on an `active` project. 30 days is a starting default, not a spec requirement — flag as tunable, revisit after pilot data rather than treating it as fixed.

### Gap 5 — Lifecycle and closure of completed/cancelled projects (`§28` #5)
**Decision:** `status` enum `draft | active | completed | cancelled`. `draft` = created but cascade not yet activated (tiers can still be edited). `active` = cascade live, exactly one project per user can be `active` with `is_active_cascade=true` at a time (spec `§11.1`). `completed`/`cancelled` are terminal — no further income or spend events accepted once reached. Completion always surfaces the remaining-funds decision to the user first (spec `§22`: "must not silently transfer or remove remaining funds") — the system never auto-resolves this, even to a sensible-seeming default.

### Gap 6 — Boundary between general MSME pockets and project funding (`§28` #6)
**Decision:** Fully separate tables (`msme_projects`, `msme_project_tiers`, `msme_project_income_events`, `msme_project_allocations`, `msme_project_spends`, `msme_project_excess_prompts`) with no foreign keys into `pockets`. Enforced at the service layer, not just by table separation: `POST /income/manual` with `segment=msme` must never write to `msme_project_tiers`, and `POST /msme/projects/:id/income` must never write to `pockets`. This isolation is explicitly spec'd (`§24`: "the event/project Funding Cascade should not automatically interact with or distribute funds across general MSME pockets") and is treated as a hard invariant with a dedicated isolation integration test (`msme-isolation.spec.ts`, Phase 6) rather than something enforced only by convention.

### Gap 7 — Data model for allocated/spent/remaining separation (`§28` #7)
**Decision:** Three explicit numeric columns per tier — `target_amount`, `allocated_amount`, `spent_amount` — with `remaining_cash` and `funding_status` **computed at read time**, never stored:
- `remaining_cash = allocated_amount - spent_amount`
- `funding_status = 'complete' if allocated_amount >= target_amount else 'in_progress'`

This is the mechanism that satisfies the spec's core rule (`§15.1`, `§14`): spending can drive `remaining_cash` to zero or negative without ever reopening a completed funding target, because `funding_status` only ever looks at `allocated_amount` vs `target_amount` — it has no dependency on `spent_amount` at all. This was considered against the alternative of reusing the existing pocket-ledger model (`getPocketSummary`, `supabase.repository.ts:566`, which nets `allocation - spend` into a single balance) and rejected for project tiers specifically, because that ledger model conflates funding and spending into one number — which is exactly what spec `§14` says must be kept apart. General MSME pockets keep using the existing ledger model unchanged; only project tiers get the new three-column model.

---

## 4. Consequences

- **Two data models coexist by design.** General MSME pockets ride the existing ledger (`allocation`/`spend`/`reallocation` rows summed by `getPocketSummary`); project tiers use the new allocated/spent/target model. This is intentional, not incidental — see Gap 7 above. Anyone touching MSME code later should not try to unify these into one model; the spec requires them to behave differently.
- **A user can hold two active plans simultaneously** (one `individual`, one `msme`), which is new — until now `one_active_plan_per_user` guaranteed exactly one. The replacement `one_active_plan_per_segment_per_user` index is the only schema change to existing `plans` behavior; all other Individual-segment code paths are unaffected since they don't pass or filter by `segment`.
- **The 6-pocket cap becomes per-segment**, not global. An existing Individual user hitting 6 pockets today will, post-migration, be able to create 6 *more* pockets once they opt into an MSME plan — this is intended (spec `§2.2` caps MSME at 6 independently), but worth flagging as a visible behavior change for existing users with pockets maxed out.
- **No migration risk to Individual segment.** `segment` defaults to `'individual'`, existing queries with no `segment` param keep working unchanged. The pocket-category CHECK widening is additive (old categories stay valid).
- **Phase 3 (cascade engine) is the load-bearing phase.** Every other phase is comparatively low-risk reuse of existing patterns; Phase 3 is genuinely new logic and is correctly flagged in the build plan as critical path with the heaviest test requirement (property tests + the `§17` Catering KES 500k fixture as the test oracle).

---

## 5. Follow-ups Before Phase 1 Merges

- [ ] Re-run real `graphify update .` / `graphify query` once the internal tool is available in whatever environment actually ships this, to catch any file:line drift between this ADR/plan and the current `main` branch.
- [ ] Confirm with product whether the 30-day inactivity window (Gap 4) is the right default before wiring the scheduler in Phase 5.
- [ ] Confirm the tie-break rule in Gap 3 (Needs before Wants on equal underfunding %) matches actual user expectation — this is an assumption, not something stated explicitly in the spec.

---

*This ADR resolves Phase 0 per `MSME_PHASED_BUILD_PLAN.md` §9 "Phase 0 — Discovery & Foundations". Phase 1 (General MSME Pockets Foundation) may begin once this is merged.*
