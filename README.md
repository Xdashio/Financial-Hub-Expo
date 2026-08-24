# Financial Hub

Financial HUB is a **behavior-driven financial intelligence layer** that structures income before spending, automates purpose-based allocations, protects savings, and helps individuals build long-term financial resilience across the financial institutions they already use.

It is currently being built as a **standalone MVP showcase** — Individual segment, manual income entry, no wallet or PSP integration — to demonstrate the core concept cleanly to potential SACCO and bank partners.

The long-term destination, **once funded**, is an **embeddable layer** (SDK/API) that partner institutions integrate into their own apps — bank apps, SACCO apps, telco super-apps (mini-app style, similar to how Zidii lives inside M-Pesa) — with its own billing system for those partner institutions. That work has not started. This repo is building the demo-ready standalone product first; see `ROADMAP.md` for the phased plan.

## Tech stack

**Mobile:** React Native (Expo ~57) · TypeScript · Expo Router · Zustand · TanStack Query · Supabase JS  
**API:** NestJS · TypeScript · PostgreSQL via Supabase · `@nestjs/schedule` for cron jobs  
**Shared:** `packages/shared` — Zod schemas, domain types, and money utilities shared between mobile and API  
**Monorepo:** pnpm workspaces · Node 20 · pnpm 9  
**Hosting:** Railway (API, Docker build from monorepo root) · EAS/Expo (mobile builds — iOS + Android + web)  
**Observability:** Sentry (API + mobile)  
**CI:** GitHub Actions — lint, typecheck, test, build (all four packages checked per push/PR)

## Core idea

Most budgeting tools ask users to configure their own categories and percentages. Financial Hub does the opposite: a short onboarding sequence learns how a person actually behaves with money — how income arrives, how they respond as funds run low, what's fixed vs flexible — and assigns **one money plan per user** from it. The user doesn't build their budget; the system infers it, shows its reasoning, and lets them adjust.

## Core behaviors

- **Income allocation** — income is split into pockets by percentage rules, or (for Daily Budget plans) divided across the days of the month after fixed costs are removed. For the MVP, income is entered manually — there is no wallet and no PSP/bank integration. **Future versions will detect incoming funds from connected financial institutions and suggest or execute pre-authorized allocations into the user's financial pockets.**
- **Protected savings** — minimum 10% of income, with an optional time-lock and deliberate friction on early access. Savings is never divided away silently.
- **Pocket-scoped spending** — money can only be spent from spendable pockets; fixed-cost pockets settle automatically.
- **Deliberate reallocation** — moving money between pockets requires review, a stated reason, a warning if reallocations are unusually frequent, secure confirmation mechanisms (including device biometrics where supported), and a cooling-off timer for essential-to-non-essential moves.
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

## Repo structure

```
Financial-Hub-Expo/
├── apps/
│   ├── api/                  NestJS backend
│   │   ├── src/
│   │   │   ├── auth/         Supabase JWT guard + @Public() decorator
│   │   │   ├── common/       Shared utilities (case-transform, pocket-rules, personality modifiers)
│   │   │   ├── config/       Supabase client config
│   │   │   ├── database/
│   │   │   │   ├── migrations/   Canonical SQL migrations (000–013)
│   │   │   │   └── supabase/     Generated copy (do not edit — run `pnpm db:sync`)
│   │   │   └── modules/      Feature modules (see Backend Architecture below)
│   │   └── supabase/         Supabase CLI config
│   └── mobile/               Expo / React Native app
│       ├── app/              Expo Router file-based routes
│       │   ├── (auth)/       Sign-in, sign-up, OTP, biometric enable
│       │   ├── (blocked)/    Blocked-spend screen
│       │   ├── (classification)/  Merchant classify + history
│       │   ├── (income)/     Manual income entry + success
│       │   ├── (loans)/      Loans list, create, detail
│       │   ├── (merchant)/   Merchant history + report
│       │   ├── (modals)/     All bottom-sheet modal screens
│       │   ├── (onboarding)/ Onboarding flow screens
│       │   ├── (pockets)/    Pocket detail + log-spend
│       │   ├── (profile)/    Plan, fixed expenses, personal info, retake check-in
│       │   ├── (security)/   Time-lock screen
│       │   ├── (settings)/   Notification settings
│       │   └── (tabs)/       Home, Runway (freelancer), Insights, Profile tabs
│       └── src/
│           ├── components/   Shared UI + domain components
│           ├── config/       API base URL + Supabase client
│           ├── hooks/        useAlertModal, useFreelancer
│           ├── services/     API client, Zustand stores, auth, offline queue
│           ├── theme/        Design tokens, palettes, ThemeContext
│           └── utils/        Money formatting, date helpers, navigation, etc.
├── packages/
│   └── shared/               Zod schemas, domain types, money utils (used by both api and mobile)
├── marketing/                Vite landing page (English/Kiswahili toggle)
├── docs/                     System documentation, innovation document, KECOBO certificate
├── assets/                   App logo
├── pnpm-workspace.yaml
├── package.json              Root scripts: dev, build, lint, typecheck, test
├── railway.toml              Railway deployment config (Dockerfile build, monorepo root context)
└── .github/workflows/ci.yml  CI: lint + typecheck + test + build (all packages)
```

## Docs in this folder

- `PRD.md` — product requirements: user flows, screens, rules, open questions
- `ROADMAP.md` — phased plan from MVP showcase to embeddable + billing
- `docs/FINANCIAL_HUB_SYSTEM_DOCUMENTATION.md` — full university-format system documentation (architecture, database schema, module reference, implementation detail)
- `docs/FINANCIAL_HUB_INNOVATION_DOCUMENT.md` — innovation/IP documentation: problem statement, behavioral-finance rationale, copyright registration (RZ94373), budget and methodology
- `docs/Financial HUB document.docx`, `docs/FINANCIAL HUB INNOVATION DOCUMENT.pdf` — original source submissions the two docs above were built from
- `docs/9f19c5a3-c954-40a7-93e9-3c4b3d46d630.pdf` — Kenya Copyright Board certificate of registration

## Current implementation status

**Phase A (Stabilize):** ✅ Complete — All schema drift issues resolved, test coverage gaps closed, runtime-breaking bugs fixed.

**Phase 1 (MVP Showcase):** 🟡 Nearly Complete — Core screens wired to real backend API, with advanced features implemented.

### Implemented features

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
- ✅ Home screen nudges (behavioral prompts, client-derived from Home data)
- ✅ Emergency unlock (`pockets/emergency-unlock.service.ts`, unit + integration test coverage)
- ✅ Sub-pocket percentage splits (parent/child pockets with `splitPercentage`, sibling-total validation, bulk adjustment)
- ✅ Loans module (income/repayment endpoints, purpose sub-pockets, fund-repayment flow)
- ✅ Behavioral recommendations (allocation suggestions from spending history, with accept/apply flow)
- ✅ Daily allocation engine (midnight cron; releases the day's variable-spending budget from the reserve pool)
- ✅ Monthly planning cycle (recurring re-plan of fixed obligations, carry-forward of shortfalls, and recommendation generation)
- ✅ Freelancer runway dashboard (tab shown only for Freelancer/Gig Daily Budget plans)
- ✅ Offline queue (queues mutations when network is unavailable, replays on reconnect)

### Backend architecture

The backend is a **NestJS** monolith backed by **PostgreSQL** (via Supabase), organized into 19 feature modules. All controllers are authenticated by default via `SupabaseAuthGuard`; routes opt out with `@Public()`. Rate limiting: 100 req/min per IP (global default via `ThrottlerModule`).

**Core modules:**
- `onboarding` — rules-engine plan assignment, pocket provisioning, income and fixed-expense ingestion
- `pockets` — pocket CRUD, allocations, emergency unlock, sub-pocket split management
- `income` — income event processing and manual entry
- `reallocations` — money movement between pockets with cooling-off enforcement
- `spend` — transaction logging and spend control (including gambling block + behavior event)
- `merchant` — merchant categorization and MCC-style block enforcement
- `insights` — behavioral event feed and discipline score surfacing
- `discipline-score` — unified scoring system shared by pockets, reallocations, and insights
- `notifications` — push token registration, preference management, scheduled delivery
- `profile` — user profile and fixed expenses CRUD
- `runway` — financial runway calculation for Daily Budget plans
- `health` — `/api/health` endpoint (used by Railway healthcheck)
- `nudges` — nudge calculation service (client-side nudges currently drive the Home UI)
- `loans` — loan creation, purpose sub-pockets, repayment tracking
- `merchant-report` — merchant misclassification report flow
- `rollover` — daily rollover processing (unspent daily budgets roll to savings)
- `behavioral-recommendations` — turns spending history into allocation suggestions the user can review and apply
- `daily-allocation` — midnight cron releasing each day's spending packet for Daily Budget plans
- `planning-cycle` — monthly re-plan of fixed obligations, shortfall carry-forward, recommendation generation

See `docs/FINANCIAL_HUB_SYSTEM_DOCUMENTATION.md` for the full module-by-module reference, including endpoints and responsibilities.

### Mobile app

Built with **React Native (Expo ~57)** using **Expo Router** (file-based routing):

- iOS + Android + web support (portrait-locked; web via Metro bundler)
- Supabase integration for auth and realtime data
- Design token system via `ThemeContext` (light/dark palette support via `userInterfaceStyle: automatic`)
- Offline queue (`src/services/offline-queue.ts`) — mutations queued when offline, replayed on reconnect
- Biometric authentication (`expo-local-authentication`) for sensitive operations
- Bottom sheet modal system (`@gorhom/bottom-sheet` via `BottomSheetModal` wrapper)
- Zustand stores for client state; TanStack Query for server state
- `packages/shared` consumed directly for Zod schemas, types, and money utilities

### Database schema

Canonical migrations live in `apps/api/src/database/migrations/` (numbered 001–013). `apps/api/supabase/migrations/` is a generated copy — run `pnpm --filter api db:sync` to update it; do not edit it directly.

Key tables: `users`, `plans`, `pockets`, `income_events`, `fixed_expenses`, `transactions`, `reallocations`, `merchant_classifications`, `behavior_events`, `discipline_scores`, `merchant_reports`, `notification_preferences`, `push_tokens`, `notification_deliveries`, `idempotency_records`, `emergency_unlocks`, `loans`, `daily_allocations`.

## Getting started

**Prerequisites:** Node 20, pnpm 9, a Supabase project (URL + service role key).

```bash
# Install dependencies
pnpm install

# Build shared package first (mobile and API depend on it)
pnpm --filter shared build

# API — set env vars in apps/api/.env.local:
#   SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
pnpm dev:api

# Mobile — set EXPO_PUBLIC_API_URL in apps/mobile/.env.local
pnpm dev:mobile
```

**Run all checks:**
```bash
pnpm lint
pnpm typecheck
pnpm test
```

**EAS mobile builds** — see `apps/mobile/eas.json` for build profiles (`development`, `preview`, `preview-arm64`, `preview-universal`, `production`). API URL for all profiles is `https://api-production-8db1.up.railway.app/api`.

**Railway deployment** — configured in `railway.toml`. Dockerfile at `apps/api/Dockerfile`; build context is the monorepo root so `packages/shared` is available. Healthcheck: `GET /api/health`.

## Swagger / API docs

Available at `/docs` in development (and in production if `ENABLE_SWAGGER=true`). All controllers are documented via `@nestjs/swagger` decorators.
