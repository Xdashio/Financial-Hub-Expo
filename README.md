# Financial Hub

Financial HUB is a **behavior-driven financial intelligence layer** that structures income before spending, automates purpose-based allocations, protects savings, and helps individuals build long-term financial resilience across the financial institutions they already use.

It is currently being built as a **standalone MVP showcase** — Individual segment, manual income entry, no wallet or PSP integration — to demonstrate the core concept cleanly to potential SACCO and bank partners.

The long-term destination, **once funded**, is an **embeddable layer** (SDK/API) that partner institutions integrate into their own apps — bank apps, SACCO apps, telco super-apps (mini-app style, similar to how Zidii lives inside M-Pesa) — with its own billing system for those partner institutions. That work has not started. This repo is building the demo-ready standalone product first; see `ROADMAP.md` for the phased plan.

> **Note on the existing codebase**: an earlier Flutter + Supabase implementation (regulated PSP wallet, real M-Pesa/Paystack money movement) exists from a prior architecture direction. It is **not being deleted and not being built on** — it stays untouched as reference. This repo starts fresh on a clean tech stack chosen specifically for the MVP showcase. See `TECH_STACK.md`.

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
| Freelancer — Structured | Irregular, lumpy | Divided into pockets |
| Freelancer — Daily Budget | Irregular, lumpy | Adaptive daily packets |

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

See `PRD.md` for detailed requirements and open items, `TECH_STACK.md` for the recommended stack and why, and `ROADMAP.md` for phased delivery.

## Docs in this folder

- `PRD.md` — product requirements: user flows, screens, rules, open questions
- `TECH_STACK.md` — recommended stack for MVP → embeddable product, with rationale
- `ROADMAP.md` — phased plan from MVP showcase to embeddable + billing