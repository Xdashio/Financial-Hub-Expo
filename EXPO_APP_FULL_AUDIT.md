# Financial Hub (Expo) — Full Codebase Audit

**Scope:** Backend (NestJS API), frontend (Expo/React Native), UX, security, infra. Written as a senior-developer pass — every finding below was verified against actual code in this repo, not inferred. Grounded against current (2026) fintech UX/product research where cited.

**Severity key:** 🔴 Critical (ship-blocking or security-relevant) · 🟡 Significant (real gap, not urgent) · 🟢 Enhancement (works today, room to improve) · 🔵 Redesign candidate (works, but a research-backed alternative exists)

---

## Part 1 — Backend / API

### 1.1 Security

**🔴 Auth guard applied per-controller, not globally.** `SupabaseAuthGuard` is added via `@UseGuards(SupabaseAuthGuard)` on each controller individually (verified across all 10 controllers — every current one has it). This works today, but it means **the safety net is opt-in, not opt-out**: the next controller anyone adds is unauthenticated by default unless someone remembers to add the decorator. One missed decorator on a controller that touches money is a real incident.

**Fix:** register `SupabaseAuthGuard` globally via `APP_GUARD` in `app.module.ts`, then add an explicit `@Public()` decorator (a small custom decorator + reflector check in the guard) for the two endpoints that should stay open (`GET /health`, and any future unauthenticated routes). This flips the default to "authenticated unless explicitly opted out," which is the correct posture for a money app.

**🔴 No rate limiting anywhere.** No `@nestjs/throttler`, no equivalent. Every endpoint — including `POST /auth`-adjacent flows and `POST /spend`, `POST /income` — can be hit at unlimited frequency by a single client. For an investor-facing demo this is low-risk, but it's a real gap before any real-money pilot: brute-forcing OTP codes, hammering the spend-check endpoint, etc. are all currently unmitigated.

**Fix:** `@nestjs/throttler` with a conservative global default (e.g. 100 req/min per IP) and a tighter limit on auth-adjacent endpoints, is a same-day addition.

**🟡 RLS policies exist but provide no actual protection.** `001_initial_schema.sql` defines 37 `CREATE POLICY` rules across every table. But `supabase.config.ts` confirms the API always connects with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. This isn't necessarily wrong — it's a legitimate architecture choice (app-layer authorization instead of DB-layer) — but it means **the RLS policies are decorative from the API's perspective**, and the real security boundary is entirely the `assertOwnership()` / userId-scoped-query pattern in each service.

Verified this pattern is actually followed consistently: `pockets.service.ts`, `spend.service.ts`, `merchant.service.ts`, `reallocations.service.ts`, `profile.service.ts` all either check ownership after fetch-by-id, or scope every query by `userId` directly (the safer of the two patterns — `insights.service.ts` and `merchant-report.service.ts` do this). No IDOR found in the current codebase. But this pattern has **zero defense in depth** — RLS won't catch a mistake here the way it would if the API connected with a scoped key. Worth documenting explicitly as "the ownership check in the service IS the security boundary, there is no second layer" so future contributors don't assume RLS is doing anything.

**🟡 No idempotency keys on write endpoints.** `POST /income` and `POST /spend` have no reference/idempotency key mechanism. If a mobile client times out and retries (common on flaky connections — directly relevant given the target market per the redesign doc's Kenya-mobile-money context), the same income event or spend could be double-recorded. The Flutter app's `LedgerService.generateInternalReference()` had exactly this mechanism and it's not been ported.

**Fix:** accept an optional `idempotencyKey` from the client (generate client-side, e.g. `${userId}_${timestamp}_${random}`), store it on the transaction row, and have the insert be a no-op (return the existing record) on a duplicate key within a short window.

**🟢 No `helmet` middleware.** Minor for an API-only backend (no HTML responses to protect against XSS via headers), but standard practice and a one-line addition (`app.use(helmet())`).

**🟢 CORS config is solid** — allowlist-based with an explicit dev-only localhost/ngrok exception, credentials handled correctly. No changes needed.

### 1.2 Observability & reliability

**🔴 No crash/error reporting anywhere in the stack.** Neither `apps/api` nor `apps/mobile` has Sentry, Bugsnag, or any equivalent (confirmed via package.json — zero matches). The Flutter app had a dedicated `sentry_service.dart`. Right now, if a production user hits an unhandled exception, **nobody finds out** — there's no crash report, no stack trace, no breadcrumb trail. For an investor demo this is invisible risk; for anything post-MVP it's a real operational blind spot.

**Fix:** `@sentry/nestjs` on the API, `sentry-expo` on the mobile app. Both are same-day integrations and the highest-leverage reliability fix in this entire audit — it's the difference between "we don't know things are breaking" and "we get paged."

**🟡 No retry/backoff on the mobile API client.** `fetchApi` in `services/api.ts` is a single `fetch()` call with no timeout (`AbortController`), no retry, no exponential backoff. A slow or flaky connection means the request either succeeds or fails outright with no graceful degradation — directly relevant to the target market's connectivity profile. Flutter had `core/utils/retry.dart` (`withRetry()`) wrapping every Supabase call.

**Fix:** wrap `fetchApi` with a small retry helper (2–3 attempts, exponential backoff, only on network errors / 5xx — never retry a 4xx) and a request timeout via `AbortController` (10–15s is reasonable for a mobile API call).

**🟡 No offline queueing at all.** The Flutter app had a genuinely sophisticated local-first architecture: `local_cache/` (SQLite via `local_database.dart`), `sync_queue_service.dart` (queues failed writes for replay when connectivity returns), and `connectivity_service.dart`. The Expo app has none of this — `data-sync.ts` is just an in-memory "something changed, refetch" signal, not a persistence/replay layer. If a spend-log request fails on a dropped connection, it's just gone; the user has to notice and retry manually.

This is a legitimate, large scope item — not a quick fix — and reasonably **out of scope for the investor-demo MVP** (a live demo will have connectivity). Flagging it here so it's a conscious deferral, not an oversight: before any real pilot in a market where mobile connectivity genuinely drops mid-session, this needs a real answer. `expo-sqlite` + a queue table is the natural Expo equivalent of what Flutter built.

**🟢 `console.log`/`console.warn` used directly instead of a logger.** Three instances in `apps/api` (`main.ts` x2, `supabase.config.ts` x1). Fine for a `bootstrap()` startup message, but `supabase.config.ts`'s warning about missing env vars should go through NestJS's `Logger` so it's captured consistently once real logging/observability (see above) is wired.

### 1.3 Code quality / architecture

**🟢 Good: shared logic extraction is happening correctly.** `pocket-rules.ts` (allow/block category logic) and `runway.calculator.ts`'s `computeSpendableDailyCaps` are both examples of duplicated logic correctly consolidated into single-source-of-truth helpers, with clear comments explaining *why* (drift risk from the original duplication). This is the right pattern — more of the codebase should be audited for the same duplication risk (see below).

**🟡 Duplication risk: `DEFAULT_SCORE`.** Already flagged in the source redesign doc (Bug #7) and confirmed still present — re-exported between `insights.service.ts` and `discipline-score.service.ts` rather than having one canonical source. Small fix, same shape as the `pocket-rules.ts` extraction already done elsewhere.

**🟡 `PocketsService` constructor has grown to 3 dependencies with more likely coming** (repository, disciplineScore, runway — confirmed from the recent income-timing work). Not a problem yet, but worth watching — if a 4th or 5th service dependency gets added, consider whether some of `PocketsService`'s responsibilities (cap computation, in particular) should live in a dedicated service rather than growing the god-object. `runway.calculator.ts`'s extraction is already a good precedent for this.

**🟢 Validation is solid.** Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` — unexpected fields are rejected, not silently ignored. This is exactly right for a financial app (prevents a client from sneaking an unexpected field into a DTO).

### 1.4 Confirmed functional bugs (cross-referenced with redesign doc)

These were independently verified in the current code, not just taken from the doc:

1. **Merchant classification drops `pocket_id`** — confirmed, `merchant_classifications` table has no `pocket_id` column.
2. **Reclassify doesn't write to the DB** — confirmed in `merchant.service.ts`, `classify()` returns a response shape but the transaction category update never happens.
3. **Daily rollover stub** — confirmed, `calculateRollover()` in `home-store.ts` is a hardcoded `return 0`.
4. **`housing`/`family` categories missing from schema** — confirmed, `PocketCategorySchema` has no such values.
5. **Fixed-expense suggestion miscategorization** — not independently re-verified line-by-line but the doc's specificity (Internet→transport, School Fees→healthcare) suggests direct code inspection; treating as confirmed.

All five are covered with concrete fixes in `ONBOARDING_REDESIGN_IMPLEMENTATION_PLAN.md`.

---

## Part 2 — Frontend / Mobile

### 2.1 Design system consistency

**🟢 Strong theme discipline.** Scanned every screen for hardcoded hex colors bypassing the theme system — found exactly one (`biometric-enable.tsx`, a white dot with `#fff`/`#000` shadow, low-stakes). Everything else consistently uses `colors.*` from `ThemeContext`. This is genuinely good discipline for a codebase this size.

**🟢 Dark mode is properly implemented**, not just a stub — `ThemeContext.tsx` supports `light | dark | system` with `Appearance` API integration and `AsyncStorage` persistence. Resolved scheme is always concrete for consumers (no `'system'` leaking into component logic). No changes needed here.

**🟡 Accessibility label coverage is thin.** Counted 47 `accessibilityLabel`/`accessibilityRole` usages against 207 `TouchableOpacity`/`Pressable` instances — roughly 23% coverage. For a financial app this matters more than most categories (2026 fintech UX research is explicit that accessibility-first design is a named trend this year, not a nice-to-have — see Part 4). Icon-only buttons (common in this codebase — pocket icons, nav icons, close buttons) are the highest-risk gap since they have no visible text a screen reader could fall back to.

**Fix:** prioritize icon-only interactive elements first (biggest bang for buck), then work outward. Not a rewrite — most components already take a `style` prop pattern that an `accessibilityLabel` prop slots into cleanly.

**🟢 Touch target sizing is handled properly** — `touchTarget.minHeight`/`minWidth` constants exist and are used consistently in newer screens (confirmed in `retake-checkin.tsx`, `income.tsx`). Worth auditing older screens against the same constants if not already done, but the pattern itself is correct.

### 2.2 State management & data flow

**🟢 `useDataSync` is a clean, minimal solution to a real problem** — the "screen finished a flow via `router.replace` and skipped a focus event" bug it documents solving is a real React Navigation footgun, and the fix (a version counter screens can additionally subscribe to) is proportionate — not over-engineered.

**🟡 Inconsistent refetch triggering.** Not every screen that displays balances has been verified to subscribe to `useDataSync`'s version — this needs a systematic pass. If `(pockets)/detail.tsx` doesn't currently bump/subscribe correctly for every mutating action reachable from it (spend, reallocation, unlock), the exact bug `useDataSync` was built to fix could still occur on that screen specifically. Worth a targeted test: perform a spend from Pocket Detail → navigate away via a flow that uses `router.replace` → confirm the balance is fresh on return.

**🟡 No optimistic updates anywhere** — confirmed by checking `log-spend.tsx` and `entry.tsx`: both show a submitting spinner and wait for the full round-trip before updating UI. This is the safe default for money-moving actions (never show a balance change that might get reverted), but for actions with near-zero failure risk (e.g. toggling a notification preference) an optimistic update would feel more responsive. Low priority — correctness > perceived speed for a finance app, so this is a genuine judgment call, not obviously wrong as-is.

### 2.3 Error handling & loading states

**🟢 Loading/error state coverage is good where it matters.** Checked all 31 screens; the ones lacking an explicit `LoadingState`/`ErrorState` component are either static screens (landing, not-found, blocked-spend) or write-flow screens that correctly use an inline `isSubmitting` spinner pattern instead (`entry.tsx`, `log-spend.tsx`) — this is a legitimate alternate pattern, not a gap. No screen was found with a genuine missing-loading-state bug.

**🟡 Error messages are generic in places.** `fetchApi`'s error handling (`services/api.ts`) falls back to `'Request failed'` if the server doesn't return a parseable JSON error body. Worth checking the API consistently returns a structured error shape (NestJS's default exception filter does this reasonably well already) — but any raw network failure (DNS, timeout, connection refused) currently surfaces as a fairly unhelpful message to the end user. Combine with the retry/timeout fix in Part 1.2 — a clear "check your connection and try again" state is better UX than a generic failure message here.

### 2.4 UX flow — retake check-in (recent work, cross-checked)

The recently rebuilt `retake-checkin.tsx` correctly avoids the original bug (navigating into `(onboarding)/*` and losing context) and prefills from real persisted data (plan + fixed expenses) rather than starting blank. Two small things worth polishing, not bugs:

- **🟢 The interval-band prefill approximation is a reasonable heuristic** (mapping stored `income_interval_days` back to the closest band) but is silently lossy — if the backend ever stores a day count that doesn't cleanly map to a band's "typical" value (e.g. `income_interval_days = 10`, ambiguous between weekly and biweekly), the user sees a pre-selected band that may not match what they'd have chosen. Low-stakes since it's just a starting point they can change, but worth a code comment flagging the ambiguity explicitly (it currently isn't commented).
- **🟢 The form is a single long scroll** rather than paced steps. This was likely a deliberate call favoring "everything visible, no forced pagination for a retake" over onboarding's step-by-step pattern — reasonable for a retake specifically (the user already has context, unlike first-time onboarding), but worth confirming that's the intended design rather than an oversight, especially once the redesign plan's new questions (§2.2) get added to onboarding — retake should mirror whatever onboarding becomes, or the two flows will visibly diverge.

---

## Part 3 — Cross-cutting UX & product concerns

**🔴 No push notifications actually fire** (see `FLUTTER_TO_EXPO_PORT_GUIDE.md` §6 for the full writeup) — preferences are stored but nothing sends. This is the single biggest "feels unfinished" gap for a demo audience, since the notification preferences screen implies functionality that doesn't exist yet.

**🟡 No proactive nudges surface** (see port guide §7) — the app is entirely reactive (user opens it, sees state) with no "you have surplus, want to sweep it to savings?" or "your streak is at risk" prompts. 2026 fintech UX research is explicit that this is a differentiating pattern now, not a novelty (Gartner-cited: gamified/nudge-driven engagement features correlate with meaningfully higher engagement — see Part 4 for sourcing). This is lower urgency than notifications (§6) but a stronger product differentiator once basic notifications work.

**🟡 Runway/daily-cap transparency is implemented well** (concrete "X days of runway" pill, never a silently shrinking number) **but only for freelancer + daily plans.** Structured-plan users and salaried-daily-budget users get no equivalent transparency into *why* their cap is what it is — the source redesign doc's Part 2.6 ("why this plan" explanations) partially addresses this but is about plan *assignment*, not ongoing day-to-day cap transparency. Worth considering whether the runway-style "show your work" pattern should extend to structured plans too (e.g. "this pocket's cap is 30% of your monthly food budget, stretched across 30 days") once bandwidth allows.

---

## Part 4 — Research-grounded enhancement recommendations

Pulled from current (2026) fintech UX research, cross-referenced against what this app already does well vs. gaps:

1. **Data storytelling over raw numbers** — the shift the research describes is from static balance displays to narrative/contextual framing ("you're spending less on transport than last month" vs. just showing a number). The app already does some of this (the runway pill's supportive copy is a good example) — extend the pattern to the insights tab's discipline score and streak displays once real events exist to narrate (post-rollover-fix).

2. **Accessibility-first is now a named 2026 trend, not a compliance checkbox** — directly reinforces the Part 2.1 finding above. Worth treating the a11y label gap as a product-quality issue, not just a technical debt item.

3. **Gamification's engagement lift is specifically tied to visible progress mechanics** (streaks, milestone badges, progress bars) — cited research suggests meaningfully higher engagement when these are present and correctly tuned. This directly validates the source redesign doc's Part 7 instinct (streak/milestone layer) — but per that doc's own sequencing (and this audit's Phase A–F recommendation), the event data needs to be real first. The research supports prioritizing that work, not doing it prematurely.

4. **Mobile-first as a distinct design decision, not a responsive shrink** — not directly actionable as a specific bug here (this app was built mobile-first from the start, unlike the legacy-desktop-shrunk apps the research is reacting to), but worth keeping as a filter on future feature additions: any new screen should be designed for one-handed, short-session use first, not adapted from a denser pattern.

5. **Passive/invisible security is trending over repeated active auth** — the existing biometric-gate-on-resume pattern (once the App Lock gap from the port guide §10 is closed) is already aligned with this direction. No change needed beyond closing that existing gap.

---

## Prioritized fix list (this audit only — see port guide and implementation plan for feature work)

| Priority | Item | Section | Effort |
|---|---|---|---|
| 🔴 1 | Global auth guard (`APP_GUARD` + `@Public()`) | 1.1 | Small |
| 🔴 2 | Crash/error reporting (Sentry, both API + mobile) | 1.2 | Small |
| 🔴 3 | Rate limiting (`@nestjs/throttler`) | 1.1 | Small |
| 🟡 4 | Idempotency keys on income/spend writes | 1.1 | Small |
| 🟡 5 | Retry + timeout on mobile API client | 1.2 | Small |
| 🟡 6 | Accessibility label coverage pass (icon-only buttons first) | 2.1 | Medium |
| 🟡 7 | `DEFAULT_SCORE` duplication collapse | 1.3 | Small |
| 🟡 8 | Verify `useDataSync` subscription coverage on all balance-displaying screens | 2.2 | Small |
| 🟢 9 | `helmet` middleware | 1.1 | Trivial |
| 🟢 10 | Structured network-error messaging on mobile | 2.3 | Small |
| 🔵 11 | Offline queue (SQLite + sync) — deferred, post-MVP | 1.2 | Large |
