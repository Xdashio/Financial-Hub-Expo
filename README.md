# Financial Hub

Financial HUB is a **behavior-driven financial intelligence layer** that structures income before spending, automates purpose-based allocations, protects savings, and helps individuals build long-term financial resilience across the financial institutions they already use.

It is currently being built as a **standalone MVP showcase** — Individual segment, manual income entry, no wallet or PSP integration — to demonstrate the core concept cleanly to potential SACCO and bank partners.

The long-term destination, **once funded**, is an **embeddable layer** (SDK/API) that partner institutions integrate into their own apps — bank apps, SACCO apps, telco super-apps (mini-app style, similar to how Zidii lives inside M-Pesa) — with its own billing system for those partner institutions. That work has not started. This repo is building the demo-ready standalone product first; see `ROADMAP.md` for the phased plan.

> **Note on prior architecture**: an earlier Flutter + Supabase prototype (regulated PSP wallet, real M-Pesa/Paystack money movement) was built under a prior architecture direction — it is **not part of this repository**; only screenshots and source excerpts of it survive, in the original innovation submission (`docs/FINANCIAL HUB INNOVATION DOCUMENT.pdf`). This repo starts fresh on a clean tech stack chosen specifically for the MVP showcase: **NestJS (API) + PostgreSQL/Supabase + React Native (Expo)**. See `docs/FINANCIAL_HUB_SYSTEM_DOCUMENTATION.md` §3–4 for the full architecture and rationale.

## Core idea

Most budgeting tools ask users to configure their own categories and percentages. Financial Hub does the opposite: a short onboarding sequence learns how a person actually behaves with money — how income arrives, how they respond as funds run low, what's fixed vs flexible — and assigns **one money plan per user** from it. The user doesn't build their budget; the system infers it, shows its reasoning, and lets them adjust.

## Core behaviors

- **Income allocation** — income is split into pockets by percentage rules, or (for Daily Budget plans) divided across the days of the month after fixed costs are removed. For the MVP, income is entered manually — there is no wallet and no PSP/bank integration. **Future versions will detect incoming funds from connected financial institutions and suggest or execute pre-authorized allocations into the user's financial pockets.**
- **Protected savings** — minimum 10% of income, with an optional time-lock and deliberate friction on early access. Savings is never divided away silently.
- **Pocket-scoped spending** — money can only be spent from spendable pockets; fixed-cost pockets settle automatically.
- **Deliberate reallocation** — moving money between pockets requires review, a stated reason, a warning if reallocations are unusually frequent, secure confirmation mechanisms (including device biometrics where supported), and (pending refined design — see `PRD.md` §7) a cooling-off timer for essential-to-non-essential moves.
- **Merchant-aware spend control** — future partner-integrated versions may support merchant-category-aware spending controls where permitted by the underlying payment infrastructure. For the MVP, this is conceptually demonstrated but not technically enforced.
- **Behavioral scoring** — spending and reallocation events feed a discipline score and plain-language insight reporting, surfaced back to the user (not just logged silently).

## Daily spending engine

Daily Budget plans do not simply divide money evenly across days. They create behavior-aware spending packets that can vary between workdays, weekends, family periods, and irregular-income cycles:

- **Student**: KES 300/day for consistent, low-variable spending
- **Salaried**: structured daily packets for fuel, breakfast, lunch, dinner, and weekend family pocket
- **Freelancer**: adaptive daily budget based on available runway and income timing

This adaptive approach aligns spending behavior with real-life income patterns rather than applying rigid arithmetic rules.

## Money plans (four fixed types)

| Plan | Income pattern | Allocation style |
|---|---|---|
| Salaried — Structured | Regular, predictable | Divided into pockets |
| Salaried — Daily Budget | Regular, predictable | Behavior-aware daily packets |
| Freelancer — Daily Budget | Irregular, lumpy | Adaptive daily packets with runway calculation |
| Gig — Daily Budget | Concentrated gig/platform income | Adaptive daily packets with runway calculation |

An initial plan is assigned during onboarding and can be refined over time as behavior and income patterns change through continuous learning and optional reassessment.

## Financial outcomes

Financial HUB is designed to drive measurable financial health outcomes beyond just spending control:

- **Emergency resilience** — build and maintain emergency funds through protected savings pockets
- **Goal-based savings** — allocate toward specific goals (education, housing, business) with time-locked protection
- **Investment readiness** — create surplus capacity and structured accumulation pathways for investment
- **Debt reduction** — integrate debt repayment into allocation priorities and track progress
- **Long-term capital accumulation** — transform daily discipline into sustainable wealth-building habits

## Strategic positioning

Financial HUB does not become another bank or mobile-money provider; it becomes the **intelligence layer** that organizes and optimizes money across the financial institutions users already trust. This positions it as:

- **Infrastructure, not competition** — partner institutions maintain their customer relationships while adding Financial HUB's behavioral intelligence
- **Platform-agnostic integration** — works across banks, SACCOs, telcos, and existing financial services
- **Behavior-driven automation** — reduces the cognitive load of financial discipline through intelligent, automated allocation

## Segments

- **Individual** — personal money plans. This is the entire current build focus; MSME is explicitly out of scope until Individual is proven.
- **MSME** — post-MVP, deferred. Same pocket/discipline mechanics in principle, but different categories and reporting needs — including specialized cases like event-planner/ticketing money management explored in earlier discovery. Needs its own discovery pass before design; not assumed to be "Individual with different labels."

## What this repo is (and isn't) building toward

This repo is building the **MVP showcase**: a clean, functional demonstration of the core user experience, used to pitch SACCOs/banks and validate the concept — not a production wallet. Company registration and any real money movement are **on hold pending funding**. Once funded, the eventual product becomes:

- An **embeddable layer** (SDK/API) partner institutions integrate into their own apps.
- A **billing system** for those partner institutions (pricing model not yet agreed — see `PRD.md`).

See `PRD.md` for detailed requirements and open items, and `ROADMAP.md` for phased delivery.

## Docs in this folder

- `PRD.md` — product requirements: user flows, screens, rules, open questions
- `ROADMAP.md` — phased plan from MVP showcase to embeddable + billing
- `docs/FINANCIAL_HUB_SYSTEM_DOCUMENTATION.md` — full university-format system documentation (architecture, database schema, module reference, implementation detail)
- `docs/FINANCIAL_HUB_INNOVATION_DOCUMENT.md` — innovation/IP documentation: problem statement, behavioral-finance rationale, copyright registration (RZ94373), budget and methodology
- `docs/Financial HUB document.docx`, `docs/FINANCIAL HUB INNOVATION DOCUMENT.pdf` — original source submissions the two docs above were built from
- `docs/9f19c5a3-c954-40a7-93e9-3c4b3d46d630.pdf` — Kenya Copyright Board certificate of registration

## Current Implementation Status

**Phase A (Stabilize)**: ✅ Complete — All schema drift issues resolved, test coverage gaps closed, runtime-breaking bugs fixed.

**Phase 1 (MVP Showcase)**: 🟡 Nearly Complete — Core screens wired to real backend API, with advanced features implemented:

### Implemented Features
- ✅ Auth (Supabase phone-OTP)
- ✅ Onboarding flow with rules-engine plan assignment
- ✅ Daily Budget & Structured plan variants
- ✅ Home screen with real pocket data
- ✅ Pocket detail with transactions
- ✅ Manual income entry
- ✅ Merchant categorization and spend blocking
- ✅ Reallocation flow with cooling-off timer
- ✅ Insights screen with behavioral scoring
- ✅ Profile management and fixed expenses
- ✅ Notifications settings
- ✅ Time-lock with biometric confirmation
- ✅ Home screen nudges (behavioral prompts)
- ✅ Emergency unlock (implemented — `pockets/emergency-unlock.service.ts`, with unit + integration test coverage)
- ✅ Sub-pocket percentage splits (implemented — parent/child pockets with `splitPercentage`, sibling-total validation, bulk adjustment)
- ✅ Loans module (income/repayment endpoints, purpose sub-pockets, fund-repayment flow)
- ✅ Behavioral recommendations (allocation suggestions from spending history, with accept/apply flow)
- ✅ Daily allocation engine (midnight cron; releases the day's variable-spending budget from the reserve pool)
- ✅ Monthly planning cycle (recurring re-plan of fixed obligations, carry-forward of shortfalls, and recommendation generation)

### Backend Architecture
The backend is built with **NestJS** and **PostgreSQL** (via Supabase), organized into 19 feature modules:

**Core Modules:**
- `onboarding` — Plan assignment and user onboarding
- `pockets` — Pocket management, allocations, emergency unlock, and sub-pockets
- `income` — Income event processing
- `reallocations` — Money movement between pockets
- `spend` — Transaction logging and spend control
- `merchant` — Merchant categorization and blocking
- `insights` — Behavioral scoring and analytics
- `discipline-score` — Unified discipline scoring system
- `notifications` — Push notification management
- `profile` — User profile and fixed expenses
- `runway` — Financial runway calculations
- `health` — System health monitoring
- `nudges` — Behavioral nudges system
- `loans` — Loans and lending functionality
- `merchant-report` — Merchant reporting system
- `rollover` — Daily rollover processing
- `behavioral-recommendations` — Turns spending history into allocation suggestions the user can review and apply
- `daily-allocation` — Generates each day's spending packet for Daily Budget plans (cron-driven)
- `planning-cycle` — Recurring monthly re-plan of fixed obligations, reserve, and daily budget

See `docs/FINANCIAL_HUB_SYSTEM_DOCUMENTATION.md` for the full module-by-module reference, including endpoints and responsibilities for each.

### Mobile App
Built with **React Native (Expo)**, featuring:
- Cross-platform iOS/Android support
- Supabase integration for auth and data
- Theme system with design tokens
- Offline queue for data synchronization
- Biometric authentication support
- Bottom sheet components for complex interactions

### Tech Stack Reality
**Implemented:** React Native (Expo) + NestJS + PostgreSQL (Supabase) + TypeScript
**Hosting:** Vercel (web) + EAS/Expo (mobile builds)
**State Management:** Zustand for client state, Supabase for server state