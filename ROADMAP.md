# Roadmap — Financial Hub

Phased from empty repo → MVP showcase → embeddable product with billing. Timeframes are intentionally left as relative (not calendar dates) since this is a slow, clean build with an unfunded team — sequence matters more than deadlines here.

**Strategic context:** Financial HUB is a behavior-driven financial intelligence layer that structures income before spending, automates purpose-based allocations, protects savings, and helps individuals build long-term financial resilience across the financial institutions they already use. The roadmap reflects this positioning as infrastructure, not competition to existing financial institutions.

## Phase 0 — Foundation (current)
- [x] Core concept defined (pockets, protected savings, 4 plan types, reallocation friction)
- [x] Core screens designed (Onboarding → Result → Home ×2 → Detail → Reallocate → Insights → Profile)
- [x] Product docs written (this doc set)
- [x] Confirmed: standalone MVP showcase first, Individual segment only, no wallet/PSP (manual income entry), clean new tech stack — existing Flutter/Supabase wallet codebase left untouched, not extended
- [x] Confirmed: company registration is on hold, blocked on funding — not started
- [ ] Repo scaffolded (frontend + backend skeletons, empty but structured)
- [ ] Decide the open questions in `PRD.md` §8 before writing business logic — several are still genuinely open, not defaults to assume:
  - Daily Budget mode (global vs per-pocket)
  - Reallocation cooling-off timer design
  - Merchant categorization / MCC blocking UX
  - Revenue model (explicitly not agreed — do not build against it)

## Phase 1 — MVP showcase (Individual segment only)
Goal: a clickable, real (not fake-static) app that demonstrates the core thesis to potential SACCO/bank partners.

- [ ] Auth (basic — Supabase/Clerk)
- [ ] Onboarding flow wired to real state (not just mockup) — income, spending habits, fixed expenses (mocked detection is fine)
- [ ] Rules-engine plan assignment (deterministic, inspectable — powers the "why this plan" screen honestly)
- [ ] Daily Budget mode design decision made and implemented (global vs per-pocket — see PRD §7 open item)
- [ ] Home (both Daily and Structured variants) wired to real pocket data
- [ ] Pocket detail + manual income entry
- [ ] Merchant categorization / MCC-style spend restriction, with a clean, non-punitive UX for classification prompts and blocks
- [ ] Reallocation flow end-to-end, including recent-count warning logic, cooling-off timer (once designed), and biometric confirm
- [ ] Insights screen wired to real behavioral event log
- [ ] Profile + basic settings
- [ ] One cohesive demo script/dataset (e.g. two seeded users — one Daily, one Structured — so the adaptive-shell story is demoable live)

**Exit criteria:** you can hand a phone to a partner, walk through onboarding → plan → a week of simulated activity → a reallocation → insights, and every number on screen is real, not hardcoded.

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
