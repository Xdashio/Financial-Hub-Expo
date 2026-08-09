# Financial Hub - Backend & Frontend Audit

## Executive Summary

This audit identifies the current state of the Financial Hub application's backend APIs and frontend screens, focusing on what is functional vs. what uses mock data or stub implementations.

**Current Status:**
- **Backend APIs:** 5 Real, 2 Stub implementations
- **Frontend Screens:** 7 Screens with mock data (all require API integration)
- **Database Tables Required:** 2 additional tables for stub implementations

---

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
**Status:** ✅ FULLY FUNCTIONAL
**Endpoints:**
- `POST /merchant/classify` - Classify merchant
- `GET /merchant/classifications` - Get user classifications
- `DELETE /merchant/classifications/:id` - Remove classification

**Database Operations:**
- ✅ Creates/updates merchant_classifications
- ✅ Reads merchant_classifications
- ✅ Deletes merchant_classifications
- ✅ Reads pockets for ownership verification

**Schema Used:**
- `merchant_classifications` table (existing)
- `pockets` table (existing)
- `plans` table (existing)

**Limitations:**
- Note: `pocket_id` field not in current schema for merchant_classifications
- Transaction category update is stubbed (line 34-40)

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
**Status:** ✅ FULLY FUNCTIONAL
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
**Status:** ⚠️ STUB IMPLEMENTATION
**Endpoints:**
- `POST /merchant/report` - Submit merchant report
- `GET /merchant/reports` - Get user reports

**Current Behavior:**
- Returns empty array for reports
- Logs to console instead of persisting
- Repository methods are stubs (supabase.repository.ts lines 447-450)

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

## Summary Table

| Component | Status | Database Ready | API Functional | UI Functional |
|-----------|--------|----------------|----------------|---------------|
| Income API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Merchant Classification API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Spend Check API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Merchant Report API | ⚠️ Stub | ❌ No | ❌ No | ❌ No |
| Time-Lock API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Notifications API | ⚠️ Stub | ❌ No | ❌ No | ❌ No |
| Fixed Expenses API | ✅ Real | ✅ Yes | ✅ Yes | ❌ No |
| Pocket Detail Screen | 🎨 Mock | ✅ Yes | ⚠️ Partial | ❌ No |
| Classification Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |
| Blocked Spend Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |
| Report Merchant Screen | 🎨 Mock | ❌ No | ❌ No | ❌ No |
| Time-Lock Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |
| Notifications Screen | 🎨 Mock | ❌ No | ❌ No | ❌ No |
| Fixed Expenses Screen | 🎨 Mock | ✅ Yes | ✅ Yes | ❌ No |

---

## Action Items Priority

### High Priority (Core Functionality)
1. **Create notification_preferences table** - Required for notifications feature
2. **Create merchant_reports table** - Required for merchant reporting feature
3. **Implement real notification_preferences API** - Replace stub with database operations
4. **Implement real merchant_reports API** - Replace stub with database operations
5. **Add pocket_id to merchant_classifications schema** - Better classification tracking

### Medium Priority (Enhancements)
6. **Add transaction type 'early_unlock' to schema** - Proper transaction tracking
7. **Add locked_at to pockets schema** - Track when lock was initiated
8. **Add status field to fixed_expenses schema** - Proper status management
9. **Enhance pocket detail API** - Add summary endpoint for screen
10. **Add transaction pagination API** - For pocket detail screen

### Low Priority (Optimizations)
11. **Make fixed expense suggestions dynamic** - Based on user data
12. **Add transaction category update** - In merchant classification
13. **Add discipline score table** - Better score tracking
14. **API service layer in mobile app** - Centralized API calls
15. **Error handling and loading states** - Better UX

---

## Next Steps

1. **Database Schema Updates**
   - Run migration for notification_preferences table
   - Run migration for merchant_reports table
   - Consider optional schema enhancements

2. **Backend API Implementation**
   - Replace notification stubs with real implementation
   - Replace merchant report stubs with real implementation
   - Test all APIs with real data

3. **Frontend API Integration**
   - Create API service layer in mobile app
   - Replace all mock data with real API calls
   - Add proper error handling
   - Add loading states

4. **Testing**
   - Test end-to-end flows
   - Test error scenarios
   - Test edge cases
   - Performance testing