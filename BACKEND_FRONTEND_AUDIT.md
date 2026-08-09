# Financial Hub - Backend & Frontend Audit

## Executive Summary

**Update (2026-08-09):** This audit was re-verified against the actual codebase — not just re-read — by installing dependencies, running `tsc --noEmit`, running the Jest suite, and reading the SQL migrations and repository/service code line by line. The original version of this document (below, mostly preserved) was directionally correct about which *screens* are mock, but it significantly understated backend risk: it reported 5 "fully functional" API modules based on the fact that service-layer code exists and compiles, without checking those services against the actual SQL schema they run against. Several of the "✅ FULLY FUNCTIONAL" APIs will throw at runtime against a real Supabase database because the code and the schema have drifted apart. TypeScript compiles cleanly and all Jest tests pass in isolation, which is *why* this wasn't caught — every test mocks `SupabaseRepository`, so nothing exercises the real schema.

**Corrected status:**
- **Backend APIs:** 3 genuinely solid (Onboarding, Pockets core CRUD/time-lock logic, Reallocations, Spend-check, Profile/Fixed-Expenses), 2 real-but-will-crash-at-runtime due to schema drift (Merchant Classification, parts of Insights/discipline-score persistence), 2 confirmed stubs (Notifications, Merchant Reports) — one of which (Merchant Reports) isn't even wired into the app at all.
- **Frontend Screens:** 7 screens confirmed still mock (matches original audit) — this part of the original document held up under re-verification.
- **Schema:** Two diverged copies of the "initial schema" migration exist in the repo, and neither one alone matches what the service/repository code assumes.

See **"Critical: Schema Drift & Runtime-Breaking Bugs"** below for the new findings, then the original per-module breakdown (retained, with status corrections inline).

---

## Critical: Schema Drift & Runtime-Breaking Bugs (new findings)

### C1. Two diverged copies of the initial schema migration
- `apps/api/src/database/migrations/001_initial_schema.sql` (canonical — has matching `.spec.sql`/`.test.sql` files, referenced by its own `README.md`, includes the `handle_new_user()` trigger and `atomic_reallocation()` function)
- `apps/api/supabase/migrations/001_initial_schema.sql` (orphaned duplicate, structurally different: different column types, different RLS policy wording, and critically **missing the `handle_new_user()` trigger**)

If anyone runs `supabase db push` from `apps/api/supabase/` (the conventional Supabase CLI project location) instead of applying `apps/api/src/database/migrations/001_initial_schema.sql` by hand, **new signups will never get a `public.users` row**, and every other table's FK to `public.users` will fail. This is a live footgun, not a historical artifact — nothing in the repo marks either file as deprecated.

**Fix:** delete `apps/api/supabase/migrations/001_initial_schema.sql` (or clearly mark it deprecated), and make `apps/api/src/database/migrations/` the single source of truth. Add a `supabase/config.toml` pointing at it, or a script that copies it in, so `supabase db push` can't silently diverge again.

### C2. `merchant_classifications` table is missing `user_id` in the canonical schema
The canonical migration defines:
```sql
CREATE TABLE IF NOT EXISTS public.merchant_classifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK (...),
  remember BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_recipient UNIQUE (recipient_key)  -- global, not per-user
);
```
But `database.types.ts`, `merchant.service.ts`, and `supabase.repository.ts` all read/write a `user_id` column that doesn't exist here (it *does* exist in the orphaned duplicate migration — another symptom of C1). Concretely:
- `SupabaseRepository.getMerchantClassificationsByUserId()` filters `.eq('user_id', userId)` → **column does not exist, Postgres error at runtime.**
- `SupabaseRepository.upsertMerchantClassification()` calls `.upsert(classification, { onConflict: 'user_id,recipient_key' })` → **no such constraint exists (the real constraint is `UNIQUE(recipient_key)` alone), Postgres error 42P10 at runtime.**
- The global (non-per-user) unique constraint on `recipient_key` alone means, even if `user_id` is added, two different users classifying the same till/paybill number would collide.
- `SupabaseRepository.getMerchantClassificationsByPocketId()` filters `.eq('pocket_id', pocketId)` → **`pocket_id` doesn't exist in *either* copy of the schema.** This is called from `PocketsService.getMerchantScope()`, which powers the pocket-detail merchant-scope endpoint.

**Fix:** align the canonical schema to `CREATE TABLE merchant_classifications (..., user_id UUID NOT NULL REFERENCES users(id), ..., UNIQUE(user_id, recipient_key))`, matching the orphaned duplicate's (correct) version, and drop the `pocket_id` filter or add the column — decide which based on whether classification should really be pocket-scoped (PRD implies merchant scope is evaluated per-pocket-kind, not stored per-pocket, so the simpler fix is likely to remove the `pocket_id` filter and use `pocket.kind` instead, as `getMerchantScope` already partially does).

### C3. `discipline_scores` upsert targets a non-existent composite constraint
`ReallocationsService.applyDisciplineCost()` calls `repo.upsertDisciplineScore({ user_id, score, delta, period, ... })`, and the repository does `.upsert(score, { onConflict: 'user_id,period' })`. But the schema defines `user_id UUID PRIMARY KEY` — a single-column key, one row per user, full stop. There is no `(user_id, period)` composite constraint to conflict on.
- At runtime this **throws** (no matching unique/exclusion constraint), meaning **any reallocation where the user skips the cooling-off timer will fail** the moment it tries to apply the 5-point discipline cost — a core, settled PRD feature (§3.4).
- Even after fixing the `onConflict` mismatch, the current `PRIMARY KEY (user_id)` design can only ever hold *one* discipline-score row per user, contradicting the evident intent (tracking scores across periods/months for the Insights trend view in PRD §3.6).

**Fix:** change `discipline_scores` to `PRIMARY KEY (user_id, period)` (or a surrogate `id` with `UNIQUE(user_id, period)`), and update the `onConflict` target to match exactly.

### C4. `MerchantReportModule` is not registered — the endpoints are unreachable, not just stubbed
`apps/api/src/modules/merchant-report/` has a controller and service, but there is no `merchant-report.module.ts` file, and `app.module.ts` never imports one. This means `POST /merchant/report` and `GET /merchant/reports` **don't exist as routes at all** — worse than the "stub implementation" the original audit describes, which implied the routes work but return placeholder data. Confirmed: no `MerchantReportModule` symbol exists anywhere in the codebase.

**Fix:** create `merchant-report.module.ts` and register it in `app.module.ts` as part of the same work that builds the real `merchant_reports` table (§ Phase in the plan below) — no point wiring the module before the table exists, so this is naturally sequenced together.

### C5. Manual income entry doesn't change what the user sees as their pocket balance
`IncomeService.createManualIncome()` creates `income_events` rows and `'allocation'`-type `transactions` rows, but never updates `pockets.monthly_allocation`. Every pocket-balance read (`PocketsService.getPocketSummary`, `SpendService.checkSpend`, `PocketsService.getLockStatus`) computes `available = pocket.monthly_allocation - sum(spend transactions)`. Since `monthly_allocation` is only set once at onboarding and manual income never touches it, **logging a second or third income event has no visible effect on any pocket's available balance** — the transaction row is created but nothing downstream reads it as a balance-increasing event. This directly undercuts PRD §3.8 ("Manual entry logs a new income event... trigger a fresh allocation pass").

**Fix:** either (a) have `createManualIncome` also increment each affected pocket's `monthly_allocation` by its allocated share, or (b) change balance calculations everywhere to net *all* transaction types (`allocation`, `reallocation_in/out`, `spend`) against a pocket rather than treating `monthly_allocation` as a static ceiling. (b) is more consistent with the ledger design already in place (`transactions` table is described as "the ledger") and would also make `reallocations.service.ts`'s direct writes to `monthly_allocation` redundant/inconsistent with the ledger — worth deciding as one design pass rather than patching both call sites independently.

### C6. `OnboardingService` has no test coverage — the spec file contains a duplicate of the implementation, not tests
`apps/api/src/modules/onboarding/onboarding.service.spec.ts` is not a test file — it's a second copy of `onboarding.service.ts`'s source code (confirmed via `npx jest`: *"Your test suite must contain at least one test"*). `rules-engine.spec.ts` covers the pure plan-assignment function, but the service class that actually deactivates old plans, creates pockets/fixed-expenses/transactions, and logs the `plan_created` behavior event — the most consequential single piece of business logic in the app — has zero test coverage.

**Fix:** replace the file with real tests against a mocked `SupabaseRepository`, covering: deactivation of prior plans, correct pocket set for both plan types (structured vs daily), fixed-expense creation, allocation-transaction creation, and the behavior event payload.

### C7. Minor: dead client-side API call
`apps/mobile/src/services/api.ts` exports `transactionsApi.create()` which `POST`s to `/transactions` — there is no `TransactionsModule`/controller in the API at all, and nothing in the mobile app currently calls `transactionsApi.create()`. Harmless today (unused), but will 404 the moment something starts calling it. Either build the endpoint or delete the dead client code.

---

## Original Audit (per-module detail, statuses corrected in place)

## Backend API Audit

### ✅ REAL IMPLEMENTATIONS (Fully Functional)

#### 1. Income API
**File:** `apps/api/src/modules/income/income.service.ts`
**Status:** ✅ FULLY FUNCTIONAL
**Endpoints:**
- `POST /income/preview` - Calculate allocation preview
- `POST /income/create` - Create manual income entry

**Database Operations:**
- ✅ Creates income_events records
- ✅ Creates allocation transactions
- ✅ Reads plans and pockets
- ✅ Calculates allocations based on proportions

**Schema Used:**
- `income_events` table (existing)
- `transactions` table (existing)
- `plans` table (existing)
- `pockets` table (existing)

---

#### 2. Merchant Classification API
**File:** `apps/api/src/modules/merchant/merchant.service.ts`
**Status:** ⛔ CODE COMPLETE BUT WILL CRASH AT RUNTIME (see C2 above) — corrected from "✅ FULLY FUNCTIONAL"
**Endpoints:**
- `POST /merchant/classify` - Classify merchant
- `GET /merchant/classifications` - Get user classifications
- `DELETE /merchant/classifications/:id` - Remove classification

**Database Operations:**
- ❌ `getMerchantClassificationsByUserId` filters on `user_id`, a column that doesn't exist in the canonical `merchant_classifications` schema — throws at runtime
- ❌ `upsertMerchantClassification`'s `onConflict: 'user_id,recipient_key'` doesn't match the actual `UNIQUE(recipient_key)` constraint — throws at runtime
- ❌ `getMerchantClassificationsByPocketId` filters on `pocket_id`, which exists in neither schema copy — throws at runtime, breaks `PocketsService.getMerchantScope()`
- ✅ Deletes merchant_classifications (by `id`, no column drift)
- ✅ Reads pockets for ownership verification

**Schema Used:**
- `merchant_classifications` table (existing, but missing `user_id`/`pocket_id` columns the code assumes — see C2)
- `pockets` table (existing)
- `plans` table (existing)

**Limitations:**
- Transaction category update is stubbed (line 34-40) — original finding, still accurate
- Schema drift (C2) must be fixed before this module can be exercised end-to-end against a real database; unit tests pass today only because they mock the repository

---

#### 3. Spend Check API
**File:** `apps/api/src/modules/spend/spend.service.ts`
**Status:** ✅ FULLY FUNCTIONAL
**Endpoints:**
- `POST /spend/check` - Check if spend is allowed
- `GET /spend/blocked-reasons` - Get blocked reasons for pocket

**Database Operations:**
- ✅ Reads pockets
- ✅ Reads transactions
- ✅ Reads merchant_classifications
- ✅ Calculates available balance
- ✅ Validates merchant categories against pocket types

**Schema Used:**
- `pockets` table (existing)
- `transactions` table (existing)
- `merchant_classifications` table (existing)
- `plans` table (existing)

---

#### 4. Time-Lock Unlock API
**File:** `apps/api/src/modules/pockets/pockets.service.ts`
**Status:** ✅ FULLY FUNCTIONAL — verified, this one holds up. Its own local discipline-score calculation (`calculateDisciplineScore`, summing `behavior_events`) doesn't touch the `discipline_scores` table at all, so it's unaffected by the C3 bug that breaks reallocation skip-cooldown.
**Endpoints:**
- `POST /pockets/:id/unlock` - Unlock time-locked pocket
- `GET /pockets/:id/lock-status` - Get lock status
- `POST /pockets/:id/extend-lock` - Extend lock period

**Database Operations:**
- ✅ Reads pockets
- ✅ Updates pockets (is_time_locked, lock_until)
- ✅ Creates behavior_events
- ✅ Creates transactions (using 'rollover' type as placeholder)
- ✅ Reads behavior_events for discipline score calculation

**Schema Used:**
- `pockets` table (existing)
- `behavior_events` table (existing)
- `transactions` table (existing)
- `plans` table (existing)

**Limitations:**
- Transaction type 'early_unlock' not in schema, using 'rollover' as placeholder (line 287)
- locked_at not tracked in current schema (line 354)
- Note: this module computes its own discipline score independently from `InsightsService`/`ReallocationsService`, which read/write the `discipline_scores` table instead. There are now **two separate, disconnected discipline-score mechanisms** in the codebase (see new Action Item below) — worth unifying, not just fixing C3 in isolation.

---

#### 5. Fixed Expenses API (Enhanced)
**File:** `apps/api/src/modules/profile/profile.service.ts`
**Status:** ✅ FULLY FUNCTIONAL
**Endpoints:**
- `GET /profile/fixed-expenses` - Get fixed expenses (existing)
- `POST /profile/fixed-expenses` - Create fixed expense (existing)
- `PUT /profile/fixed-expenses/:id` - Update fixed expense (existing)
- `DELETE /profile/fixed-expenses/:id` - Delete fixed expense (existing)
- `GET /profile/fixed-expenses/suggestions` - Get suggestions (NEW)
- `POST /profile/fixed-expenses/bulk` - Bulk create (NEW)
- `PUT /profile/fixed-expenses/:id/status` - Update status (NEW)

**Database Operations:**
- ✅ All CRUD operations on fixed_expenses
- ✅ Suggestions return hardcoded Kenyan expense data
- ✅ Bulk create with error handling
- ✅ Status update (simulated via name field)

**Schema Used:**
- `fixed_expenses` table (existing)

**Limitations:**
- Status field doesn't exist in schema, simulated via name field (line 234)
- Suggestions are hardcoded, not based on user data (lines 114-171)

---

### ⚠️ STUB IMPLEMENTATIONS (Require Database Tables)

#### 6. Notifications API
**File:** `apps/api/src/modules/notifications/notifications.service.ts`
**Status:** ⚠️ STUB IMPLEMENTATION
**Endpoints:**
- `GET /notifications/settings` - Get notification preferences
- `PUT /notifications/settings` - Update notification preferences

**Current Behavior:**
- Returns hardcoded default preferences
- Logs to console instead of persisting
- No database operations

**Required Database Table:**
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  reallocation_confirms BOOLEAN DEFAULT true,
  cooling_off_reminders BOOLEAN DEFAULT true,
  savings_milestones BOOLEAN DEFAULT true,
  monthly_insights BOOLEAN DEFAULT false,
  tips_nudges BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

#### 7. Merchant Report API
**File:** `apps/api/src/modules/merchant-report/merchant-report.service.ts`
**Status:** ⛔ NOT REACHABLE AT ALL — corrected from "⚠️ STUB IMPLEMENTATION". See C4 above: there is no `MerchantReportModule`, and `app.module.ts` never registers one, so these routes 404 regardless of the stubbed service logic. Fixing the stub logic alone would not be enough to make this work.
**Endpoints (defined in code, not currently routable):**
- `POST /merchant/report` - Submit merchant report
- `GET /merchant/reports` - Get user reports

**Current Behavior:**
- Returns empty array for reports
- Logs to console instead of persisting
- Repository methods are stubs (supabase.repository.ts lines 447-450)
- **Module is not imported anywhere, so none of the above is reachable via HTTP today**

**Required Database Table:**
```sql
CREATE TABLE merchant_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  recipient_key TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('wrong_category', 'not_gambling', 'wrong_amount', 'unknown_payee')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  suggested_category TEXT
);
```

---

## Frontend Screen Audit

### 🎨 SCREENS WITH MOCK DATA (All Require API Integration)

#### 1. Pocket Detail Screen
**File:** `apps/mobile/app/(pockets)/detail.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 77-122

**Required API Integration:**
```typescript
// TODO: Replace with actual API calls
const summary = await fetchPocketSummary(id);
const txs = await fetchTransactions(id, page);
```

**Backend Endpoints Needed:**
- `GET /pockets/:id/summary` (needs enhancement)
- `GET /pockets/:id/transactions?page=1`

**Current Mock Data:**
- Pocket summary with allocations, spend, remaining
- Transaction history (2 sample transactions)

---

#### 2. Merchant Classification Screen
**File:** `apps/mobile/app/(classification)/classify.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 40-45 (pockets array), Lines 55-63 (API call)

**Required API Integration:**
```typescript
// TODO: Replace with actual API call
await merchantApi.classify({
  recipient_key: recipientKey,
  category: selectedCategory,
  pocket_id: selectedPocket,
  remember,
  transaction_id: transactionId,
  amount: amount ? parseFloat(amount) : undefined,
});
```

**Backend Endpoints Needed:**
- `POST /merchant/classify` ✅ (EXISTS)
- `GET /pockets` to fetch user pockets for selection

**Current Mock Data:**
- Hardcoded pockets array (4 pockets)
- Alert success message

---

#### 3. Blocked Spend Screen
**File:** `apps/mobile/app/(blocked)/blocked-spend.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 37-47 (navigation only)

**Required API Integration:**
- No API calls currently, only navigation
- Should integrate with spend check API for validation

**Backend Endpoints Needed:**
- `POST /spend/check` ✅ (EXISTS)

**Current Mock Data:**
- None (screen is informational only)

---

#### 4. Report Merchant Screen
**File:** `apps/mobile/app/(merchant)/report.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 55-63 (API call)

**Required API Integration:**
```typescript
// TODO: Replace with actual API call
await merchantReportApi.createReport({
  recipient_key: recipientKey,
  report_type: selectedReportType,
  description,
  transaction_id: transactionId,
  suggested_category: suggestedCategory || undefined,
});
```

**Backend Endpoints Needed:**
- `POST /merchant/report` ⚠️ (STUB - needs database table)

**Current Mock Data:**
- Alert success message

---

#### 5. Time-Lock Screen
**File:** `apps/mobile/app/(security)/time-lock.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 40-55 (lock status), Lines 80-81 (unlock API), Lines 107-108 (extend API)

**Required API Integration:**
```typescript
// TODO: Replace with actual API call and biometric confirmation
await pocketsApi.unlock(pocketId, { reason, biometric_confirmed: true });
await pocketsApi.extendLock(pocketId, { additional_days: 30, reason: 'Building emergency fund' });
```

**Backend Endpoints Needed:**
- `GET /pockets/:id/lock-status` ✅ (EXISTS)
- `POST /pockets/:id/unlock` ✅ (EXISTS)
- `POST /pockets/:id/extend-lock` ✅ (EXISTS)

**Current Mock Data:**
- Hardcoded lock status with 43 days remaining
- Alert success messages

---

#### 6. Notifications Settings Screen
**File:** `apps/mobile/app/(settings)/notifications.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 36-46 (load preferences), Lines 62-63 (update preferences)

**Required API Integration:**
```typescript
// TODO: Replace with actual API call
const prefs = await notificationsApi.getSettings();
await notificationsApi.updateSettings(updatedPreferences);
```

**Backend Endpoints Needed:**
- `GET /notifications/settings` ⚠️ (STUB - needs database table)
- `PUT /notifications/settings` ⚠️ (STUB - needs database table)

**Current Mock Data:**
- Hardcoded notification preferences
- Local state updates only

---

#### 7. Fixed Expenses Screen
**File:** `apps/mobile/app/(profile)/fixed-expenses.tsx`
**Status:** 🎨 MOCK DATA
**Mock Data Location:** Lines 68-91 (load expenses), Lines 106-112 (add), Lines 141-147 (update), Lines 183-184 (delete)

**Required API Integration:**
```typescript
// TODO: Replace with actual API calls
const data = await profileApi.getFixedExpenses();
await profileApi.createFixedExpense({ name, amount, dueDay, category });
await profileApi.updateFixedExpense(editingExpense.id, { name, amount, dueDay, category });
await profileApi.deleteFixedExpense(expense.id);
```

**Backend Endpoints Needed:**
- `GET /profile/fixed-expenses` ✅ (EXISTS)
- `POST /profile/fixed-expenses` ✅ (EXISTS)
- `PUT /profile/fixed-expenses/:id` ✅ (EXISTS)
- `DELETE /profile/fixed-expenses/:id` ✅ (EXISTS)

**Current Mock Data:**
- Hardcoded 2 fixed expenses (Rent, Electricity)
- Local state updates only

---

## Summary Table (corrected 2026-08-09)

| Component | Status | Schema Matches Code | API Functional | UI Functional |
|-----------|--------|----------------|----------------|---------------|
| Onboarding API | ✅ Real | ✅ Yes | ✅ Yes | ✅ Yes |
| Income API | ⚠️ Real but incomplete (C5) | ✅ Yes | ⚠️ Doesn't move balances | ❌ No |
| Merchant Classification API | ⛔ Will crash at runtime (C2) | ❌ No | ❌ No | ❌ No |
| Spend Check API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Merchant Report API | ⛔ Not routable at all (C4) | ❌ No | ❌ No | ❌ No |
| Time-Lock API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Reallocations API | ⚠️ Real but skip-cooldown path will crash (C3) | ⚠️ Partial | ⚠️ Partial | ✅ Yes |
| Notifications API | ⚠️ Stub | ❌ No | ❌ No | ❌ No |
| Fixed Expenses API | ✅ Real (status-update hack aside) | ✅ Yes | ✅ Yes | ❌ No |
| Pocket Detail Screen | 🎨 Mock | ✅ Yes | ⚠️ Partial | ❌ No |
| Classification Screen | 🎨 Mock | ❌ No (blocked on C2) | ❌ No | ❌ No |
| Blocked Spend Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |
| Report Merchant Screen | 🎨 Mock | ❌ No | ❌ No | ❌ No |
| Time-Lock Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |
| Notifications Screen | 🎨 Mock | ❌ No | ❌ No | ❌ No |
| Fixed Expenses Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |

---

## Action Items Priority (corrected 2026-08-09 — supersedes the original list below)

### Blocker (nothing else should be built on top of these)
1. **Resolve the two-migration split (C1)** — delete or clearly deprecate the orphaned `apps/api/supabase/migrations/` copy; make `apps/api/src/database/migrations/` the single source of truth with a real Supabase CLI project config pointed at it.
2. **Fix `merchant_classifications` schema drift (C2)** — add `user_id`, fix the unique constraint to be per-user, resolve the `pocket_id` filter (likely: remove it, use `pocket.kind` instead, since no schema copy has this column).
3. **Fix `discipline_scores` schema + onConflict drift (C3)** — composite key on `(user_id, period)`, matching `onConflict` target. This currently breaks the settled PRD §3.4 skip-cooldown feature.
4. **Register `MerchantReportModule` (C4)** — do this alongside building the real `merchant_reports` table, not before, since the stub logic needs replacing anyway.

### High Priority (Core Functionality)
5. **Create notification_preferences table** and replace the stub — required for notifications feature
6. **Create merchant_reports table** and replace the stub (paired with C4 above)
7. **Fix manual income entry not updating pocket balances (C5)** — decide ledger-vs-static-ceiling design once, apply consistently
8. **Write real tests for `OnboardingService` (C6)** — currently zero coverage on the most consequential business logic in the app
9. **Unify the two disconnected discipline-score mechanisms** — `PocketsService.calculateDisciplineScore()` (local, from `behavior_events`) and `ReallocationsService`/`InsightsService` (via the `discipline_scores` table) currently compute and store scores independently and will show inconsistent numbers to the user

### Medium Priority (Enhancements)
10. **Add transaction type 'early_unlock' to schema** — proper transaction tracking (still open from original audit)
11. **Add locked_at to pockets schema** — track when lock was initiated (still open)
12. **Add status field to fixed_expenses schema** — replace the current hack that appends `" (inactive)"` to the expense `name` field, which corrupts user data
13. **Remove dead `transactionsApi.create()` client code (C7)** or build the endpoint it calls — currently unused, but will 404 if wired up as-is

### Low Priority (Optimizations)
14. **Make fixed expense suggestions dynamic** — based on user data; also fix nonsensical suggestion categories (e.g. "Internet"/"Mobile Data" tagged `transport`, "School Fees" tagged `healthcare`)
15. **Add transaction category update** — in merchant classification (blocked on C2 first)
16. **Add discipline score table** — superseded by item 9 above, keep as a sub-task of it
17. **Error handling and loading states** — better UX once real API wiring begins

---

## Next Steps

See `ROADMAP.md` for the phased build order (Phase A onward), which sequences the blocker fixes above before any new screen-wiring work. In short:

1. **Schema-drift fixes first** (C1–C4) — nothing else can be trusted until these land, since they affect modules already marked "done."
2. **Backend correctness fixes** (C5, C6, C9) — close functional gaps and test-coverage gaps in modules that otherwise work.
3. **New stub → real implementations** (notifications, merchant reports) — now safe to build on a settled schema.
4. **Frontend wiring** — the 7 confirmed-mock screens, in the dependency order in `ROADMAP.md`.
5. **Testing & polish** — integration tests against a real (not mocked) Supabase instance for at least the modules touched by C2/C3, so schema drift like this can't recur silently.