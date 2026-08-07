# Tech Stack — Financial Hub

> **Note**: an earlier Flutter + Supabase implementation (regulated PSP wallet architecture, real M-Pesa/Paystack money movement) exists but is not part of this stack decision — it's left untouched, not extended, and not migrated from. Everything below is a clean start for the MVP showcase, which has no wallet and no PSP integration.

Two horizons matter here, and they pull toward different choices, so this doc splits them:

- **Horizon 1 — MVP showcase**: fast to build, cheap (ideally free-tier), good enough to demo the flows convincingly to partners.
- **Horizon 2 — Embeddable layer + billing**: what the stack needs to become once this is an SDK/API partners embed, with real money movement and per-partner billing. Post-funding only — see `ROADMAP.md`.

Recommendations below are chosen so Horizon 1 choices don't have to be thrown away for Horizon 2 — they extend, rather than get replaced.

## Horizon 1 — MVP showcase

| Layer | Recommendation | Why |
|---|---|---|
| Frontend (mobile) | **React Native (Expo)** | One codebase for iOS + Android, fastest path to a demoable mobile app, huge ecosystem, easy to later extract screens/components for an embedded SDK since it's still React under the hood. |
| Backend | **Node.js (NestJS) or Supabase Edge Functions** | NestJS if you want a real backend you control and can later expose as the SDK's API surface (structured, testable, good for a small team). Supabase is the faster/cheaper path if the team is small and wants auth+DB+functions bundled — trade-off is less control later. |
| Database | **PostgreSQL** (via Supabase or hosted separately, e.g. Neon/Railway free tiers) | Relational fits this domain well — users, plans, pockets, transactions, reallocation events all have clear relationships and need transactional integrity (money movement must be atomic, even when it's simulated rather than real). |
| Auth | **Supabase Auth** or **Clerk** (free tiers) | Don't build auth yourselves for MVP. Both support biometric-adjacent flows (device-level biometric + session token) cheaply. |
| Biometric confirmation | **Native biometric APIs via Expo (`expo-local-authentication`)** | Free, native Face ID/fingerprint on-device — no third-party cost, matches the "confirm with Face ID" flow already designed. |
| Behavioral scoring / plan assignment logic | **Rules engine in your own backend code first, not ML** | The plan-assignment logic described (income pattern × allocation style → 1 of 4 plans) is a decision tree from onboarding answers, not something that needs a trained model yet. Keep it deterministic and inspectable for MVP — this also makes the "why this plan" explanation screen trivial to generate honestly, since you can literally show which rule fired. |
| Hosting | **Vercel (web) + EAS/Expo (mobile builds)**, free tiers | No cost to demo, fast to iterate. |
| Design → code | Keep using coded HTML/React mockups (already underway) rather than Figma-first, given no design budget — code mockups double as a head start on real components. |

**Cost for Horizon 1: effectively $0** using free tiers across the board, which matches "we don't have money to pay for anything."

## Horizon 2 — Embeddable layer + billing

Once this needs to be an SDK/API partners embed (bank apps, SACCO apps, telco mini-apps), a few things change:

| Layer | Recommendation | Why |
|---|---|---|
| API surface | **Versioned REST or GraphQL API** (NestJS continues to work here) exposed as the actual product partners integrate against | This is now the product, not an implementation detail — needs API keys, rate limiting, versioning, docs (e.g. auto-generated via OpenAPI). |
| Embeddable UI | **A lightweight SDK** (React Native module for mobile hosts, or a Web Component / iframe-based widget for web hosts) that renders Financial Hub's screens inside a partner's own shell, themeable to match partner branding | Matches the "mini-app inside M-Pesa" model — partners need to embed UI, not just call an API and build their own UI from scratch (which would be a much bigger ask of them). |
| Multi-tenancy | **Postgres with partner-scoped rows (tenant_id) or schema-per-partner for larger partners** | Needed the moment more than one partner is live — plan this early even if MVP only has one tenant, so it isn't a rewrite later. |
| Billing | **Stripe Billing (usage-based) or a metering table you own + Stripe for invoicing** | Stripe supports usage-based billing well if pricing ends up being per-active-end-user or per-transaction; keep your own metering event log regardless so you're not solely dependent on a third party for the source of truth. Pricing model itself is not agreed yet — see `PRD.md` §5. |
| Security/compliance | Move toward **PCI-adjacent practices even if you don't hold funds directly** (encryption at rest/in transit, audit logging on every pocket/reallocation event, SOC2 groundwork) | Because you're handling real financial behavior data and partners will ask about this before integrating, regardless of whether Financial Hub itself moves money or just orchestrates categorization. |
| Observability | **Structured event logging from day one** (the same events already feeding Insights/discipline score) | Reuse the behavioral event log as both a product feature (Insights) and an operational asset (debugging, billing metering, compliance audit trail) — don't build two separate event systems. |

## Why not X

- **No Flutter for Horizon 1**: React Native was chosen because it shares a mental model (and possibly component logic) with the web mockups already built, keeping one smaller team productive across both. This is a deliberate break from the earlier Flutter/Supabase wallet codebase, not a continuation of it.
- **No ML/AI model for plan assignment yet**: a rules engine is faster to build, fully explainable (critical for the "why this plan" UX you already committed to), and can be replaced by a learned model later once there's real behavioral data to train on — premature ML here would slow the MVP down for no real gain yet.
- **No NoSQL as primary store**: money/pocket/reallocation data is inherently relational and needs transactional guarantees (a reallocation must debit one pocket and credit another atomically, even when simulated) — Postgres is the right default here, not Mongo/Firebase-as-primary-store.
- **No PSP/wallet for Horizon 1**: the MVP showcase uses manual income entry only; PSP integration is a Horizon 2 concern, gated on funding and company registration.
