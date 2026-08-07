# Product Requirements Document — Financial Hub

Status: **Draft v0.4** — updated to clarify Financial HUB as a behavior-driven financial intelligence layer, add income detection capabilities, expand daily spending engine documentation, include financial outcomes framework, and refine MVP limitations around merchant-aware spending and biometric confirmation.

## 1. Problem statement

People manage money as a single lump-sum balance, which makes it easy to lose track of what's actually spendable versus already spoken for (rent, savings, upcoming bills). Financial Hub reframes money into **pockets** and removes the burden of manual budget-building by inferring a plan from behavior.

## 1.1 Strategic positioning

Financial HUB is a **behavior-driven financial intelligence layer** that:
- Structures income before it is spent through automated allocation
- Detects income patterns and triggers purpose-based allocation decisions
- Controls spending behavior through pocket-scoped discipline mechanisms
- Automates allocations across existing financial accounts users already trust
- Generates financial intelligence across accounts and institutions

**Key differentiator:** Financial HUB does not become another bank or mobile-money provider; it becomes the intelligence layer that organizes and optimizes money across the financial institutions users already trust. This positions it as infrastructure, not competition.

## 2. Users

- **Individual (MVP focus)** — a person receiving income (salaried or freelance) who wants clarity on what's safe to spend without manually building a budget.
- **MSME (post-MVP, deferred)** — a small business owner needing similar pocket logic but with business-relevant categories (e.g. stock, wages, tax set-aside) and multi-user visibility. Includes more specialized cases surfaced in earlier discovery (e.g. event planners/ticketing needing vendor-escrow-style pockets) — these are MSME-phase ideas, not part of the current Individual-only build, and need their own discovery pass before design. Not detailed in this version.

## 3. Core flows

### 3.1 Onboarding → Plan assignment

1. **Income** — how income arrives (amount, regularity, source count). Future versions will detect incoming funds from connected financial institutions and classify them as salary, business income, transfer, or irregular income to trigger automatic allocation options.
2. **Spending habits** — behavioral questions (e.g. "when money runs low near month-end, what usually happens?") — short, non-judgmental, multiple choice.
3. **Fixed expenses** — system attempts detection (from linked account/statement where available) and always lets the user confirm or edit.
4. **Plan assignment** — system determines income pattern (salaried vs freelancer) and allocation style (daily vs structured) from the above, and assigns exactly one of the four fixed plan types.
5. **Onboarding result** — shows the assigned plan name, a plain-language "why this plan" explanation (2–3 reasons max), and a preview of the actual split (fixed costs / savings / spendable) before the user commits. User can proceed or request adjustment.

**Rule:** the user never picks a plan type from a menu. It's inferred, shown transparently, and can be revisited (not casually changed) from Profile.

### 3.2 Home

Single shared shell (brand header, Safe to Spend hero, total balance secondary, savings-protected strip), body adapts by plan style:

- **Structured plans** — pocket cards (progress bar, amount, status) for each pocket including a locked Savings pocket.
- **Daily Budget plans** — **behavior-aware daily spending packets** (settled decision). Daily Budget plans do not simply divide money evenly across days. They create behavior-aware spending packets that vary based on real-life patterns:
  - **Student**: KES 300/day for consistent, low-variable spending patterns
  - **Salaried**: structured daily packets for fuel, breakfast, lunch, dinner, and weekend family pocket
  - **Freelancer**: adaptive daily budget based on available runway and income timing

Each spendable pocket shows its own daily cap and remaining amount (e.g. Groceries & food 180 left / cap 250, Transport 120 left / cap 200, Personal & leisure 160 left / cap 200). These roll up into a single "Safe to spend today" hero (the hero is literally the sum of the daily caps — 460 = 180 + 120 + 160). Savings is shown separately under "Protected", fed by the daily rollover (unspent daily amounts roll to Savings). Fixed costs sit under "Fixed, already handled". This per-pocket design avoids the "mental accounting confusion" of a single global figure — spending Food money can't secretly eat into Transport.

**Rule (UX):** Home leads with **safe-to-spend**, not raw total balance — raw balance includes earmarked money and undermines the pocket-based mental model this product exists to teach. Total balance is shown, but secondary.

### 3.3 Pocket detail

Per-pocket screen: available amount, allocation context, quick actions (Add money, Reallocate), a friction note if this pocket has been reallocated from unusually often, and a ledger-style transaction/activity list.

### 3.4 Reallocation

Two-step, deliberately frictioned:

1. **Pick pockets** — choose source and destination. Locked/time-locked pockets (e.g. Savings under time-lock) are visibly disabled as a source.
2. **Review & confirm** — shows the from/to/amount, requires a stated reason (chip selection), surfaces a warning if this is an unusually frequent reallocation for that pocket, and requires secure confirmation to complete. For the MVP, this is a standard confirmation dialog; future versions will support device biometrics where available.

> **Cooling-off timer (settled decision).** A cooling-off delay applies to **essential → discretionary-leisure** reallocations only (Rent/Food → Entertainment/Leisure). Duration is **1–2 hours** (configurable; default 1h). It is **skippable at a discipline-score cost** (5 points). Framing is supportive, never punitive — "This move can wait an hour", not a countdown threat. This is **not** a re-adoption of the old blanket "24-hour cooling-off on all essential pockets" rule. See `PROMPT_PACKS.md` Pack 5 for the exact implementation rules.

### 3.5 Merchant categorization & spend blocking (future capability)

Spendable pockets are restricted by merchant/recipient category, not just by pocket balance. For the MVP, this is conceptually demonstrated but not technically enforced due to the lack of wallet/PSP integration. Future partner-integrated versions may support merchant-category-aware spending controls where permitted by the underlying payment infrastructure:

- Essential pockets (Food, Rent) can only pay out to matching merchant categories (grocery, landlord, utility) where the recipient is identifiable (Till/Paybill).
- Blacklisted categories (gambling, betting) are blocked outright from essential pockets, and shown a warning if attempted from a discretionary pocket.
- For unclassified recipients (P2P, unregistered Pochi), the user is prompted to self-classify once; the classification is remembered.

The UX approach is **settled**: a **soft block** with a **one-time self-classify prompt** for unclassified recipients (P2P, unregistered till), remembered going forward. Blacklisted categories (gambling/betting) are blocked outright from essential pockets and shown a warning from discretionary pockets. The frame is "sort, don't block" — with a subtle "this looks wrong — report it" path that creates a review/flag record, not a support ticket. See `PROMPT_PACKS.md` Pack 6 for the exact implementation rules.

### 3.6 Insights

Discipline score (0–100, with recent delta), key behavioral metrics (e.g. days savings stayed untouched, reallocation count), a simple usage trend, and a plain-language feed of behavioral events (positive and cautionary) — the same signals that drive the reallocation friction rules, made visible to the user rather than only used silently.

**Open question:** does a numeric "score" risk feeling gamified/judgmental? Flagged for review — may need reframing (e.g. qualitative bands instead of a raw number) once tested with real users.

### 3.7 Profile

Identity, current plan (with a path to retake the behavior check-in as habits change through continuous learning and optional reassessment), fixed expenses management, security settings (secure confirmation mechanism toggle, savings time-lock status), notification and account settings.

### 3.8 Manual income entry

Income is entered manually for all users in the MVP — there is no wallet, PSP, or bank/statement integration. Manual entry logs a new income event: amount, source/label, date, and whether it should trigger a fresh allocation pass or be added to the existing plan period.

## 4. Rules that must hold across all screens

- Savings is **never** the default reallocation source; if time-locked, it cannot be a source at all from the picker.
- Minimum 10% of income to savings is enforced at allocation time, not just displayed.
- Friction on money movement is primarily procedural (review, reason, warning, biometric); a cooling-off timer applies to essential→discretionary-leisure moves only (Rent/Food → Entertainment/Leisure), 1–2 hours, skippable at a 5-point discipline cost — see §3.4.
- Fixed-cost pockets settle automatically and are visually distinct from spendable pockets (status "Settled" vs a usage bar).
- Every reallocation is attributed to a reason and feeds insight reporting.
- No wallet, no PSP integration, no real money movement in the MVP — income and spend are recorded, not moved.

## 5. Financial outcomes framework

Financial HUB is designed to drive measurable financial health outcomes beyond just spending control. The system targets specific financial resilience indicators:

### 5.1 Emergency resilience
- Build and maintain emergency funds through protected savings pockets
- Time-lock mechanisms prevent premature access to emergency reserves
- Emergency fund targets are personalized based on income stability and fixed expenses

### 5.2 Goal-based savings
- Allocate toward specific goals (education, housing, business) with time-locked protection
- Progress tracking for each goal with visual milestone indicators
- Goal prioritization integrated into allocation rules

### 5.3 Investment readiness
- Create surplus capacity through consistent savings discipline
- Structured accumulation pathways for future investment opportunities
- Liquidity management to balance accessibility with growth potential

### 5.4 Debt reduction
- Integrate debt repayment into allocation priorities
- Track debt reduction progress alongside savings goals
- Reallocation friction protects debt repayment allocations from spending erosion

### 5.5 Long-term capital accumulation
- Transform daily discipline into sustainable wealth-building habits
- Compound effect demonstration through insight reporting
- Behavioral scoring reinforces capital-preserving actions

## 6. Revenue model (not agreed — reference only)

No revenue model is agreed for the MVP or beyond. Earlier exploration produced a two-stream model (a per-outward-transaction "convenience fee," and a referral commission on partner-lender loan offers to high-discipline-score users), plus separate later-stage ideas (per-active-user SaaS pricing, a scoring API for lenders, usage-based partner licensing). None of this is decided, none of it should be treated as planned, and none of it is relevant to the MVP showcase, which doesn't move real money. It's noted here only so it isn't lost, and needs a dedicated decision pass before it enters any build plan — see §8.

## 7. Market sizing (reference figures — need revalidation)

Earlier discovery produced the following Kenya market sizing. These numbers have not been rechecked recently and should be treated as directional reference for pitch conversations, not as verified current figures:

| Tier | Target count | Definition | Estimated annual value |
|---|---|---|---|
| TAM | ~18.5M | Smartphone-owning adults in Kenya using mobile money | ~KES 15.5B (~$120M) |
| SAM | ~8.2M | Gen Z/Millennial earners (18–38) and active informal MSMEs seeking budgeting/cashflow tools | ~KES 5.5B (~$42M) |
| SOM (3-yr target) | ~250,000 | 150k individual + 100k MSME accounts | ~KES 220.8M (~$1.7M), under the old convenience-fee model |

Since the revenue model itself is unresolved (§5), the SOM revenue figure specifically should be treated as illustrative only, not a target — it inherits the same "not agreed" status as the pricing model it's based on.

## 7. MVP scope (showcase, not production)

**In scope:** Individual segment only. Both allocation styles (Daily Budget, Structured) for at least one income pattern (salaried), manual income entry, the core screens already designed (Onboarding, Onboarding Result, Home ×2 variants, Pocket Detail, Reallocate pick + review + cooling-off, Merchant classify/blocked/report, Insights, Profile). Built on a clean, new tech stack (see `TECH_STACK.md`) — not on the existing Flutter/Supabase wallet codebase, which is left untouched.

**Out of scope for MVP:** MSME segment (including event planner/ticketing use cases), partner-embedding shell/SDK behavior, billing system UI, freelancer-specific onboarding tuning, live bank/statement integration (detection can be mocked/simulated for the showcase), any real wallet/PSP money movement, company registration (blocked on funding).

## 8. Open questions to resolve before build

**Resolved (settled) — no longer open:**
1. **Daily Budget mode** — **per-pocket daily caps** with a rollup hero (settled). Each spendable pocket has its own daily cap; the hero is the sum of the caps. Savings shown separately, fed by daily rollover. (§3.2)
2. **Reallocation cooling-off timer** — **essential → discretionary-leisure pairs only** (Rent/Food → Entertainment/Leisure), **1–2 hours** (default 1h), **skippable at a 5-point discipline cost**, supportive framing. (§3.4)
3. **Merchant categorization UX** — **soft block + one-time self-classify prompt**, remembered going forward; blacklisted categories blocked outright from essential pockets, warning from discretionary; "report it" path creates a review record. (§3.5)

**Still open:**
4. **Revenue model** — not agreed; needs a dedicated decision pass before it's referenced in any build plan. (§6)
5. How is fixed-expense **detection** actually sourced for MVP — mocked data, a statement upload, or a real account-linking integration? This affects both scope and which tech-stack pieces are needed early.
6. What exactly triggers a **re-run of plan assignment** — manual retake only, or also automatic drift detection (e.g. income pattern changes)?
7. MSME segment — same core screens with different categories, or a meaningfully different flow (event planner/ticketing suggests "meaningfully different" for at least some sub-segments)? Needs its own short discovery pass before design.
8. Billing system — usage-based (per active end-user) or flat per-partner licensing? Relevant only once Phase 4 (embeddable layer) is real; not needed for MVP.
9. Company registration — on hold pending funding; no timeline yet.
