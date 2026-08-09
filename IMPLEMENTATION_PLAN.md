# Financial Hub Backend Implementation Plan

> **⚠️ Superseded 2026-08-09.** This plan was written from a docs-level read of the repo and its "current state" section is out of date — a code-level audit found several modules described here as further along than they actually are (schema drift causes some to fail at runtime). **Use `ROADMAP.md` (Phase A onward) for current sequencing, and `BACKEND_FRONTEND_AUDIT.md` for the up-to-date state.** This file is kept for its task breakdowns and endpoint sketches, which are still useful reference once Phase A's blockers are cleared — just don't treat the phase numbers or "current state" below as accurate.

## Current State Analysis

### ✅ Built & Wired to Real API (16 screens)
- Auth flow (signin, signup, verify-otp, biometric-enable)
- Onboarding (income, habits, fixed, result)
- Home screens (structured, daily)
- Reallocation flow (pick, review, cooldown, success)
- Insights, Profile screens

### ⚠️ Partially Built (1 screen)
- Empty home state (generic implementation exists, needs dedicated pre-allocation design)

### ❌ Not Built - No Backend API (9 screens)
1. **Pocket detail** (detail.html) - DB table + repo methods exist; no controller/route
2. **Manual income entry** (income-entry.html) - No backend module at all
3. **Merchant classification** (classify.html) - No backend module at all
4. **Add money** (add-money.html) - Can reuse reallocation API once pocket detail exists
5. **Blocked spend** (blocked-spend.html) - No backend module at all
6. **Report merchant** (report-merchant.html) - No backend module at all
7. **Fixed expenses manager** (fixed-expenses.html) - Backend CRUD fully built (profileApi), just no screen
8. **Time-lock savings** (time-lock.html) - No unlock endpoint
9. **Notifications settings** (notifications.html) - No backend status specified

### Database Schema Status
The database schema is well-designed and includes all necessary tables:
- ✅ users, plans, pockets, fixed_expenses, income_events, transactions
- ✅ reallocations, merchant_classifications, behavior_events, discipline_scores
- ✅ All relationships and constraints properly defined

---

## Phased Implementation Plan

### Phase 1: Core Pocket Management (Foundation)
**Priority: HIGH** - Enables several other features

#### 1.1 Pocket Detail API
**Screen:** detail.html  
**Status:** DB table exists, repository methods exist, needs controller/route

**Required API Endpoints:**
```
GET    /pockets/:id/transactions      - Get pocket transaction history
GET    /pockets/:id/summary           - Get pocket summary (available, spent, remaining)
GET    /pockets/:id/merchant-scope   - Get merchant scope for pocket
```

**Implementation Tasks:**
- Create `PocketDetailController` in pockets module
- Add transaction history query with pagination
- Add pocket summary calculation (available balance, monthly allocation, spending)
- Add merchant scope retrieval (allowed/blocked categories)
- Integrate with existing `PocketsService`

**Dependencies:** None (builds on existing pockets module)

#### 1.2 Manual Income Entry API
**Screen:** income-entry.html  
**Status:** No backend module

**Required API Endpoints:**
```
POST   /income/manual                - Create manual income entry
POST   /income/manual/allocate-preview - Preview allocation before confirming
```

**Implementation Tasks:**
- Create `IncomeModule` with controller and service
- Implement manual income creation with validation
- Implement allocation preview using existing onboarding rules
- Add support for different income sources (client payment, cash, other)
- Integrate with existing `income_events` table
- Trigger allocation if `run_allocation` flag is true

**Dependencies:** Onboarding rules engine (already exists)

---

### Phase 2: Merchant Classification System
**Priority: HIGH** - Critical for spend tracking and blocking

#### 2.1 Merchant Classification API
**Screen:** classify.html  
**Status:** No backend module, DB table exists

**Required API Endpoints:**
```
POST   /merchant/classify           - Save merchant classification
GET    /merchant/classifications    - Get user's merchant classifications
DELETE /merchant/classifications/:id - Remove classification
```

**Implementation Tasks:**
- Create `MerchantModule` with controller and service
- Implement classification CRUD operations
- Add logic to check merchant scope before spend attempts
- Implement "remember" functionality for future auto-classification
- Add validation for blocked categories on essential pockets
- Integrate with existing `merchant_classifications` table

**Dependencies:** Pocket detail API (needs pocket context)

#### 2.2 Blocked Spend Check API
**Screen:** blocked-spend.html  
**Status:** No backend module

**Required API Endpoints:**
```
POST   /spend/check                 - Check if spend is allowed for pocket/merchant
GET    /spend/blocked-reasons       - Get list of blocked categories for pocket
```

**Implementation Tasks:**
- Create `SpendModule` with controller and service
- Implement spend validation logic (pocket type + merchant category)
- Add blocked category checking against pocket merchant scope
- Return detailed block reasons for UI display
- Add support for essential vs discretionary pocket rules

**Dependencies:** Merchant classification API, Pocket detail API

#### 2.3 Report Merchant API
**Screen:** report-merchant.html  
**Status:** No backend module

**Required API Endpoints:**
```
POST   /merchant/report              - Submit merchant classification report
GET    /merchant/reports             - Get user's submitted reports
```

**Implementation Tasks:**
- Create merchant report tracking in database (may need new table)
- Implement report submission with categories (wrong category, not gambling, etc.)
- Add admin notification system for reports
- Implement report status tracking (pending, reviewed, resolved)
- Add feedback loop to improve classification accuracy

**Dependencies:** Merchant classification API

---

### Phase 3: Advanced Features
**Priority: MEDIUM** - Nice-to-have but important for UX

#### 3.1 Time-Lock Unlock API
**Screen:** time-lock.html  
**Status:** No unlock endpoint, DB table has `lock_until` field

**Required API Endpoints:**
```
POST   /pockets/:id/unlock           - Request early unlock with discipline cost
GET    /pockets/:id/lock-status     - Get lock status and remaining time
POST   /pockets/:id/extend-lock     - Extend lock period
```

**Implementation Tasks:**
- Add unlock endpoint to pockets controller
- Implement discipline cost calculation for early unlock
- Add validation for lock expiration checks
- Update `discipline_scores` table on unlock
- Add lock extension functionality
- Implement biometric confirmation for unlock (reuse existing auth)

**Dependencies:** Discipline scoring system (already exists)

#### 3.2 Notifications Settings API
**Screen:** notifications.html  
**Status:** No backend status specified

**Required API Endpoints:**
```
GET    /notifications/settings      - Get user notification preferences
PUT    /notifications/settings      - Update notification preferences
```

**Implementation Tasks:**
- Create `NotificationsModule` with controller and service
- Add notification preferences table to database
- Implement preference CRUD operations
- Integrate with notification delivery system (future work)
- Add defaults favoring friction-related alerts
- Implement per-notification-type toggles

**Dependencies:** May need notification infrastructure (can be stubbed initially)

---

### Phase 4: UI Enhancements
**Priority: LOW** - Polish and completeness

#### 4.1 Fixed Expenses Screen
**Screen:** fixed-expenses.html  
**Status:** Backend CRUD fully built (profileApi), just no screen

**Required Work:**
- Build React Native screen using existing profile API endpoints
- Reuse existing CRUD endpoints from `ProfileController`
- Add edit/delete functionality
- Implement fixed expense summary calculations
- Add suggestions for common fixed expenses

**Dependencies:** None (backend complete)

#### 4.2 Empty Home State Enhancement
**Screen:** empty-home.html  
**Status:** Generic implementation exists

**Required Work:**
- Enhance existing empty state to match mockup design
- Add pre-allocation specific messaging
- Add call-to-action for onboarding flow
- Improve visual design to match dedicated mockup

**Dependencies:** None

---

## Implementation Dependencies Graph

```
Phase 1 (Foundation):
├── Pocket Detail API (1.1)
└── Manual Income Entry API (1.2) → depends on onboarding rules

Phase 2 (Classification System):
├── Merchant Classification API (2.1) → depends on Pocket Detail
├── Blocked Spend Check API (2.2) → depends on (2.1)
└── Report Merchant API (2.3) → depends on (2.1)

Phase 3 (Advanced Features):
├── Time-Lock Unlock API (3.1) → depends on discipline scoring
└── Notifications Settings API (3.2) → independent

Phase 4 (UI Enhancements):
├── Fixed Expenses Screen (4.1) → backend complete
└── Empty Home State (4.2) → independent
```

---

## Recommended Implementation Order

### Sprint 1: Core Pocket Management (Week 1-2)
1. Pocket Detail API (1.1) - 2-3 days
2. Manual Income Entry API (1.2) - 2-3 days
3. Add money screen integration - 1-2 days (reuses reallocation)

### Sprint 2: Classification System (Week 3-4)
1. Merchant Classification API (2.1) - 3-4 days
2. Blocked Spend Check API (2.2) - 2-3 days
3. Report Merchant API (2.3) - 2-3 days

### Sprint 3: Advanced Features (Week 5-6)
1. Time-Lock Unlock API (3.1) - 2-3 days
2. Notifications Settings API (3.2) - 2-3 days
3. Time-lock screen integration - 1-2 days

### Sprint 4: UI Polish (Week 7-8)
1. Fixed Expenses Screen (4.1) - 2-3 days
2. Empty Home State enhancement (4.2) - 1-2 days
3. Integration testing and bug fixes - 2-3 days

---

## Database Schema Additions Needed

### New Tables Required:

1. **notification_preferences**
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reallocation_confirms BOOLEAN DEFAULT true,
  cooling_off_reminders BOOLEAN DEFAULT true,
  savings_milestones BOOLEAN DEFAULT true,
  monthly_insights BOOLEAN DEFAULT false,
  tips_nudges BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

2. **merchant_reports** (for report merchant feature)
```sql
CREATE TABLE merchant_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_key TEXT NOT NULL,
  report_type TEXT NOT NULL, -- 'wrong_category', 'not_gambling', 'wrong_amount', 'unknown_payee'
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved'
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP
);
```

---

## Technical Considerations

### Reusable Components
- **Reallocation Flow:** Can be reused for "add money" feature with pre-scoped destination
- **Authentication:** Existing biometric auth can be reused for sensitive operations
- **Rules Engine:** Existing onboarding rules can power allocation preview for manual income

### Security Considerations
- All spend operations must validate merchant scope
- Early unlock operations should require biometric confirmation
- Discipline score modifications should be audited
- Merchant reports should be private between user and system

### Performance Considerations
- Pocket transaction history should be paginated
- Merchant classification lookups should be cached
- Notification preferences should be loaded once per session
- Reallocation cooling-off checks should use indexed queries

---

## Testing Strategy

### Unit Tests Required
- Pocket detail calculations (available balance, spending summaries)
- Merchant classification validation logic
- Spend blocking rules (essential vs discretionary pockets)
- Discipline cost calculations for early unlock
- Notification preference validation

### Integration Tests Required
- Manual income entry with allocation preview
- Complete merchant classification flow
- Blocked spend scenario with override path
- Time-lock unlock with discipline cost application
- Notification preference updates

### E2E Tests Required
- Pocket detail screen with transaction history
- Manual income entry complete flow
- Merchant classification and remember functionality
- Add money (reallocation) complete flow
- Time-lock unlock with biometric confirmation

---

## Success Criteria

### Phase 1 Success Criteria
- ✅ Pocket detail screen shows accurate transaction history
- ✅ Manual income entry triggers correct allocation
- ✅ Add money flow works using reallocation API

### Phase 2 Success Criteria
- ✅ Merchant classification is saved and remembered
- ✅ Blocked spend prevents inappropriate transactions
- ✅ Merchant reports can be submitted and tracked

### Phase 3 Success Criteria
- ✅ Time-lock unlock applies correct discipline cost
- ✅ Notification preferences are saved and respected
- ✅ All advanced features work with biometric confirmation

### Phase 4 Success Criteria
- ✅ Fixed expenses screen provides full CRUD functionality
- ✅ Empty home state matches design mockup
- ✅ All screens integrate seamlessly with existing features

---

## Next Steps

1. **Review and approve** this implementation plan
2. **Set up development environment** for Sprint 1
3. **Begin Phase 1.1** - Pocket Detail API implementation
4. **Create feature branches** for each major component
5. **Set up CI/CD** for automated testing and deployment

This plan provides a clear path to completing all missing backend features while building on the solid foundation that already exists.