# Flutter → Expo Port Guide
**Status:** Audit complete — ready for implementation planning.
**Scope:** MVP standalone app (investor/institution showcase). M-Pesa, Wallet, and external payment layers are explicitly out of scope.

---

## How to read this doc

Each section is structured as:
- **What the Flutter app had** — what was built, how it worked, what was good or broken about it.
- **Current Expo state** — what exists, what's stubbed, what's missing entirely.
- **Recommended Expo implementation** — a better version where applicable, not a literal port.

Severity labels: 🔴 **Blocks MVP** · 🟡 **Weakens MVP significantly** · 🟢 **Nice-to-have / post-MVP**

---

## 1. Daily rollover → Savings 🔴

### Flutter
`DailyBudgetService.runDailyRolloverIfNeeded` computed the actual unspent amount per spendable pocket each night, debited it out, credited it into the Savings pocket, and wrote a `daily_rollover_success` behavioral event. It ran client-side on app open (checked for yesterday's rollover, skipped if already done via idempotency key). Also showed a local push notification when rollover completed.

It was real, ledger-backed logic — not a stub.

### Current Expo state
`calculateRollover()` in `home-store.ts` is a hardcoded `return 0`. No backend job, no ledger writes, no event. The `rolloverAmount` shown in the UI is always zero.

This is the single biggest missing piece. The ONBOARDING_AND_SCORING_REDESIGN.md explicitly calls it out (Bug #6) and correctly flags it as the natural trigger for the streak system — a day every spendable pocket stayed under cap is a genuine daily win. Without real rollover there is no honest streak, which means the discipline score's streak bonus is built on a ghost.

### Recommended Expo implementation
Port to the **backend** (not client-side like Flutter did) as a Supabase Edge Function or a NestJS scheduled job, both more reliable than client-triggered logic:

```
POST /income/rollover/run  (idempotent — checks if already run for yesterday)
```

**Logic (mirror of Flutter's DailyBudgetService, server-side):**
1. For each spendable pocket: `pocketDailyCap = monthly_allocation / daysRemainingInMonth`.
2. Query spend transactions for that pocket for yesterday.
3. `unspent = pocketDailyCap - spentYesterday`. If ≤ 0, skip.
4. Debit pocket, credit Savings pocket in the ledger.
5. Write `daily_rollover_success` behavior event with `{ amount: totalRollover }`.
6. Idempotency: reference key `daily_rollover_YYYYMMDD_planId`.

**Frontend:** call this on app foreground (not on every render — throttle to once per calendar day using `AsyncStorage`). Show the rollover amount in the home screen hero. Emit a `useDataSync.bump()` after it completes so all screens refresh.

**Streak connection:** the `daily_rollover_success` event becomes the primary streak signal. A day with this event is a streak day. See §7.

---

## 2. Streak system 🔴

### Flutter
`StreakService.computeStreak` queried `behavioral_events` for `spend_within_budget` and `overspend_attempt` events over 90 days, grouped by calendar day, walked backward to compute current streak and longest streak, and detected milestones at `[3, 7, 14, 30, 60, 90]`. No grace/freeze mechanic existed.

It was read-only (compute only, no persistence of the streak count itself). The result fed into the discipline score's `streak_bonus` (+1pt per streak day, cap +15).

### Current Expo state
`InsightsService` returns a `streak` field but it appears to always be 0 in practice because the `spend_within_budget` event is never written (no rollover, no daily cap compliance check). The heatmap in `StreakHeatmap.tsx` exists visually but renders empty data.

### Recommended Expo implementation
The Flutter approach of computing streak from raw events is correct. Port it to the backend as a pure query (no persistence needed):

```typescript
// insights.service.ts — computeStreakForUser(userId: string)
// Returns { currentStreak, longestStreak, milestone }
```

**Key improvements over Flutter:**
1. **Use `daily_rollover_success` as the primary streak event** (more reliable than `spend_within_budget` which requires a logged spend every day — days with zero spend but under-cap behavior shouldn't break the streak).
2. **Add a grace day** — if today has no data yet (it's early in the day), don't break the streak. Flutter's implementation had a fragile `if (i === 0) continue` that only half-solved this.
3. **Milestone notifications** — Flutter had milestones defined but no notification wired. Wire a push at 3, 7, 14, 30. See §6.

---

## 3. Discipline score — recency weighting + full rule set 🟡

### Flutter
`DisciplineScoreService` had a full weighted scoring model with recency buckets (7d = 1.0×, 14d = 0.75×, 21d = 0.5×, 30d = 0.25×), a streak bonus (+1pt/day, cap +15), a savings rate bonus (0–10 linear), and 9 event types including `goal_achieved` (+10, cap +20), `essential_override` (−10, cap −30), and `daily_overspend` (−3, cap −15). Score range: 0–100, base 40.

### Current Expo state
`DisciplineScoreService` in the API exists and computes a score, but the rule set is a reduced version (no recency weighting, no savings rate bonus, no `goal_achieved` or `essential_override` events). The `DEFAULT_SCORE` duplication risk called out in ONBOARDING_AND_SCORING_REDESIGN.md (Bug #7) is still present.

### Recommended Expo implementation
Port the full Flutter rule set directly — it's well-designed. Specific additions:

| Event type | Points | Cap | Notes |
|---|---|---|---|
| `daily_rollover_success` | +3 | +15 | New — primary positive signal |
| `goal_achieved` | +10 | +20 | Already in Flutter, missing from Expo |
| `essential_override` | −10 | −30 | Critical for category-gating integrity |
| `daily_overspend` | −3 | −15 | Already in Flutter, missing from Expo |

Add recency weighting: multiply event points by the bucket weight before summing. This makes the score reflect recent behavior, not a lifetime average.

Collapse `DEFAULT_SCORE` to a single export from `@financial-hub/shared` (it's currently duplicated between `insights.service.ts` and `discipline-score.service.ts`).

---

## 4. Savings goals — set, track, graduate 🟡

### Flutter
Full savings goal flow: `SetSavingsGoalSheet` (name, target amount, target date), goal progress bar on the pocket card, `GraduateGoalSheet` (when balance ≥ goal: celebrate, increase goal +25%, or reuse balance), and a `goal_achieved` behavioral event.

The `Pocket` model carried `goalName`, `goalAmount`, `goalTargetDate`, and `goalProgress` fields. Progress was shown as a visual ring/bar.

### Current Expo state
The DB schema has `goal_name`, `goal_amount`, `goal_target_date` on the `pockets` table (based on the existing API types). The `detail.tsx` pocket screen exists. But there is no UI to set a goal, no progress display, and no graduate-goal flow.

### Recommended Expo implementation
Three additions to `(pockets)/detail.tsx`:

1. **Set goal sheet** (bottom modal): name field, amount input (KSh), optional target date picker. Calls `PATCH /pockets/:id` with `{ goal_name, goal_amount, goal_target_date }`.
2. **Goal progress bar** on the detail hero: `balance / goal_amount` as a linear progress bar with a percentage label. Show target date countdown ("X days left").
3. **Graduate goal sheet** (triggered when balance ≥ goal): three options — "Set a new goal" (pre-fills +25%), "Transfer to another pocket" (opens realloc flow), "Keep as savings buffer". Writes `goal_achieved` behavioral event on any path.

**Do not** copy Flutter's keypad-heavy amount entry pattern — the existing `Input` component with numeric keyboard is faster on Expo.

---

## 5. Sub-pockets 🟢

### Flutter
`CreateSubPocketSheet`, `EditSubPocketSheet`, `ManageAllocationsSheet`, and `SubPocketsScreen` implemented a full sub-pocket hierarchy under a parent pocket. Sub-pockets had their own icon, name, and allocation split. The parent showed an aggregate balance and a split breakdown.

### Current Expo state
No sub-pocket concept exists in the Expo app or API schema. The `pocket_hierarchy.dart` core service and `sub_pockets_screen.dart` in Flutter are the full implementation.

### Recommended Expo implementation
**Defer to post-MVP.** Sub-pockets are a power-user feature not needed for investor showcase. Flag the schema design decision: if added later, prefer a `parent_pocket_id` FK on the `pockets` table rather than a separate `sub_pockets` table — simpler queries, same ledger logic.

---

## 6. Push notifications — real delivery 🔴

### Flutter
`NotificationService` was a full implementation using `flutter_local_notifications` with:
- `showAllocationReceived` — income allocated successfully.
- `showDailyRollover` — rollover completed (amount).
- `scheduleWeeklySummary` — Sunday evening summary of the week's spend.
- Milestone/streak notifications (defined but not fully wired).
- Permission request on Android.
- Tap routing back into the app via GoRouter.

### Current Expo state
`NotificationsService` in the API stores preferences (5 toggles) and reads/writes them. The preferences screen (`(settings)/notifications.tsx`) is wired. **But nothing actually sends a notification.** No `expo-notifications`, no scheduled jobs, no push tokens. Preferences are stored for future use only.

### Recommended Expo implementation
`expo-notifications` is the correct library (already in the Expo ecosystem, no extra native module pain). Implement in two passes:

**Pass 1 — Local notifications (no server needed, MVP-ready):**
```typescript
// src/services/notifications.ts
import * as Notifications from 'expo-notifications';

export async function requestPermissions() { ... }
export async function showRolloverSuccess(amount: number) { ... }
export async function showAllocationReceived(amount: number, pocketCount: number) { ... }
export async function scheduleMilestoneNotification(streakDays: number) { ... }
```
Call `showRolloverSuccess` after the rollover API call resolves. Call `showAllocationReceived` after `POST /income`. Gate each behind the relevant preference toggle from `notificationsApi.getPreferences()`.

**Pass 2 — Scheduled weekly summary (post-MVP):**
Use Expo's `scheduleNotificationAsync` with a `CalendarTrigger` (Sunday 8pm local). Mirror Flutter's `WeeklySummaryService._composeSummary` logic server-side as a `/insights/weekly-summary` endpoint that returns the body string.

**iOS gotcha:** `expo-notifications` requires an Expo project with EAS Build for real push tokens on iOS. For the MVP demo, local notifications (no push token needed) are sufficient and work on both platforms.

---

## 7. Smart nudges / behavioral prompts 🟡

### Flutter
`SmartNudgesSheet` read the current pockets state and insights to surface 2–3 actionable nudges:
- "You have surplus in [pocket] — sweep KSh X to Savings?" (triggered when a spendable pocket had > 3,000 KES surplus).
- Compliance warnings from the discipline score details.
- Direct CTA into the reallocation flow.

### Current Expo state
No equivalent. The insights tab shows the discipline score and heatmap, but no proactive nudge surface.

### Recommended Expo implementation
Add a `NudgesCard` component to the home screen (`(tabs)/index.tsx`) that renders 1–2 smart nudges, computed server-side:

```
GET /insights/nudges
→ [{ type: 'sweep_surplus', pocketId, pocketName, amount, targetPocketId }, ...]
```

**Nudge types for MVP:**
1. **Surplus sweep** — spendable pocket balance > 120% of its monthly allocation. Suggest sweeping excess to Savings.
2. **Streak at risk** — no spend logged today and it's past 6pm. "Log a spend to keep your X-day streak alive."
3. **Runway low** — freelancer plan, runway ≤ 3 days. "Payment expected soon — consider tightening your daily cap."

Keep the nudge tappable: tap opens the relevant flow directly (realloc for surplus, log-spend for streak, daily cap info for runway).

---

## 8. Transaction detail screen 🟡

### Flutter
`TransactionDetailScreen` showed: amount, date/time, pocket name with icon, merchant (if classified), transaction type badge, and a reclassify action (tapping merchant opened `MerchantClassificationSheet`).

### Current Expo state
No transaction detail screen. The transactions list (`(pockets)/detail.tsx`) shows a flat list of items. Tapping a transaction does nothing.

### Recommended Expo implementation
Add `(pockets)/transaction/[id].tsx`:
- Hero: amount (large, colored by type), date, pocket name.
- Body: merchant name if classified, category badge, transaction type, reference.
- Action: "Reclassify" button (pending the merchant classification bug fix — see §9).

---

## 9. Merchant classification — two confirmed bugs 🔴

### Flutter
`MerchantClassificationSheet` saved both the category and the `pocket_id` together. The `merchant_classifications` table had a `pocket_id` column.

### Current Expo state
Two bugs confirmed in ONBOARDING_AND_SCORING_REDESIGN.md:

1. **`pocket_id` is dropped** — the UI in `(classification)/classify.tsx` asks the user to pick a pocket, but `merchant_classifications` has no `pocket_id` column, so the answer is silently discarded. Either add the column or remove the question.
2. **Reclassification is a fake echo** — `MerchantService.classify` returns a `transaction_updated` shape but performs no DB write. The transaction category in the ledger never actually updates.

### Recommended Expo implementation
Fix both together in one migration + service pass:

```sql
-- Migration 003
ALTER TABLE merchant_classifications ADD COLUMN pocket_id UUID REFERENCES pockets(id) ON DELETE SET NULL;
```

```typescript
// merchant.service.ts — fix classify()
async classify(dto: ClassifyDto, userId: string) {
  // 1. Upsert merchant_classifications with pocket_id
  await this.repository.upsertMerchantClassification({
    merchant_name: dto.merchantName,
    category: dto.category,
    pocket_id: dto.pocketId ?? null,
    user_id: userId,
  });
  // 2. Actually update the transaction
  if (dto.transactionId) {
    await this.repository.updateTransactionCategory(dto.transactionId, dto.category);
  }
  return { success: true };
}
```

---

## 10. App lock / biometric gate 🟡

### Flutter
`AppLockService` + `AppLockGate` — PIN or biometric auth on app resume (not just on launch). The lock triggered after a configurable idle timeout.

### Current Expo state
`(auth)/biometric-enable.tsx` exists and appears to have received recent work (in the last pull). Check if it currently gates app resume or only initial launch.

### Recommended Expo implementation
Use `expo-local-authentication` (already available in Expo Go without EAS). The gate should:
1. Trigger on `AppState` change to `active` after being in `background` for > 60 seconds.
2. Show a biometric/PIN prompt.
3. Block all navigation until authenticated.

Implement as a root layout wrapper in `app/_layout.tsx` rather than per-screen, mirroring Flutter's `AppLockGate` pattern.

---

## 11. Export (PDF / CSV) 🟢

### Flutter
`ExportService` + `PdfDelivery` — generated a PDF statement of transactions for a date range and shared it via the native share sheet.

### Current Expo state
Not present.

### Recommended Expo implementation
**Post-MVP.** For investor demo, a CSV export from the transactions endpoint is sufficient and needs no native module:

```
GET /transactions/export?format=csv&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Return as a file download. The mobile app can open it with `expo-sharing`. Full PDF generation can wait for post-MVP.

---

## 12. Onboarding redesign — persona expansion 🟡

### Flutter
Onboarding was a simple 3-step flow. The `IncomeType` model had `salary | business | mixed`.

### Current Expo state  
The Expo app improved on this (already has `salaried | freelancer | mix` + the banded pay cadence picker from batch 3). But the ONBOARDING_AND_SCORING_REDESIGN.md recommends a richer persona model.

### Recommended Expo implementation
The redesign doc (§2.1) proposes two independent dimensions instead of a single enum:

**Dimension 1 — Income stability:**
- `predictable` (salaried, student stipend)
- `semi-predictable` (gig/platform worker, salaried + side income)
- `volatile` (freelancer/project-based, informal trader)

**Dimension 2 — Income concentration (new):**
- `single-source`
- `multi-source`

This maps cleanly to the existing `incomePattern` + a new `sourceConcentration` field on the plan. The rules engine maps the stability dimension to the runway math (only `volatile` gets the full adaptive runway) and the concentration dimension to how cautiously the income allocation splits.

**Copy changes per the psychology notes:**
- Normalize irregularity in the first question: "Some months more comes in than others — that's how most people in Kenya actually earn."
- Lead with concrete categories (rent, food) for users who show avoidance signals; lead with savings goal for users who show saver signals.
- Add `housing`/`rent` as a first-class pocket category (Bug #5 in the redesign doc — it doesn't exist in `PocketCategorySchema` today).

---

## 13. Daily budget summary — `spentToday` + derived cap 🟡

### Flutter
`DailyBudgetService.getSummary` returned `{ dailyCap, derivedCap, spentToday, remaining, rolloverThisMonth, todayTransactions }`. The home screen showed today's spend vs cap with a visual bar. `derivedCap` (computed from remaining balance ÷ days left in month) was shown alongside the manual `dailyCap` for transparency.

### Current Expo state
The home screen shows `safeToSpendToday` but it's a static computed value from `home-store.ts` with no real query for today's spend. `rolloverThisMonth` is always 0 (see §1).

### Recommended Expo implementation
Add `GET /pockets/daily-summary`:
```typescript
{
  dailyCap: number;         // from pocket.daily_cap
  derivedCap: number;       // monthly_allocation ÷ daysRemainingInMonth
  spentToday: number;       // sum of spend transactions today across spendable pockets
  remaining: number;        // dailyCap - spentToday
  rolloverThisMonth: number; // sum of daily_rollover transactions this month
  runway?: RunwaySummary;   // for freelancer plans, collapse the /pockets/runway call here
}
```

Show both `dailyCap` and `derivedCap` on the home screen per the runway psychology note: "you have 9 days of runway" is legible; a cap that silently shrinks is alarming. Show the concrete days number and the derived daily figure side by side.

---

## 14. Weekly summary / insights digest 🟢

### Flutter
`WeeklySummaryService` composed a human-readable summary of the week's spend (total, top pocket, vs cap) and scheduled it as a Sunday notification.

### Current Expo state
Not present. The insights tab shows historical data but no weekly digest.

### Recommended Expo implementation
**Post-MVP.** Add `GET /insights/weekly-summary` as the data source, then wire the local notification once push is live (§6). The composition logic from Flutter is straightforward to port.

---

## 15. `housing` / `rent` category — schema gap 🔴

### Flutter
Had a `housing` category in the pocket category enum.

### Current Expo state
`PocketCategorySchema` in `packages/shared/src/schemas/index.ts` has no `housing` or `rent` value. The redesign doc flags this (Bug #5). The category is referenced in suggestion copy today but cannot actually be persisted.

### Recommended Expo implementation
```typescript
// packages/shared/src/schemas/index.ts
export const PocketCategorySchema = z.enum([
  'food', 'transport', 'leisure', 'personal',
  'utilities', 'healthcare', 'education',
  'housing',   // ← add
  'family',    // ← add (school fees, upkeep — §1.2 research)
  'other',
]);
```

Then a migration:
```sql
-- Migration 004
ALTER TYPE pocket_category ADD VALUE IF NOT EXISTS 'housing';
ALTER TYPE pocket_category ADD VALUE IF NOT EXISTS 'family';
```

And update the fixed-expense suggestion list in the onboarding to suggest `housing` first (per the category prioritization research in §3.3 of the redesign doc).

---

## Prioritized implementation order for MVP

| Priority | Item | Section | Effort |
|---|---|---|---|
| 🔴 1 | Real daily rollover → Savings | §1 | Medium |
| 🔴 2 | Streak system (backend compute) | §2 | Small |
| 🔴 3 | Merchant classification bug fixes | §9 | Small |
| 🔴 4 | `housing` + `family` category schema | §15 | Small |
| 🔴 5 | Local push notifications (expo-notifications) | §6 | Medium |
| 🟡 6 | Savings goals (set, track, graduate) | §4 | Medium |
| 🟡 7 | Full discipline score rule set | §3 | Small |
| 🟡 8 | Smart nudges card on home | §7 | Small |
| 🟡 9 | Daily budget summary endpoint | §13 | Small |
| 🟡 10 | Transaction detail screen | §8 | Small |
| 🟡 11 | App lock on resume | §10 | Small |
| 🟡 12 | Onboarding persona expansion | §12 | Medium |
| 🟢 13 | Sub-pockets | §5 | Large — post-MVP |
| 🟢 14 | Export (CSV first, PDF later) | §11 | Small |
| 🟢 15 | Weekly summary digest | §14 | Small |
