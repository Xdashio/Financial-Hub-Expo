# Nudges Architecture Design Decisions

## Overview

This document captures three architectural approaches for the nudges system, analyzing the current implementation and providing design options for long-term shape with dismissal state and push notification integration.

## Current State Analysis

### Client-Derived Nudges (`apps/mobile/src/services/nudges.ts`)

**Implementation:**
- Purely client-side calculation from home-store data
- `deriveNudges()` function processes pockets, daily caps, runway, streaks, discipline scores
- Re-calculated on every home screen load
- No persistence across sessions
- No dismissal state

**Strengths:**
- Simple, reactive, fast for the user
- No network latency
- Works offline
- Easy to iterate on UI/logic

**Weaknesses:**
- Limited data access (can't query ledger directly)
- Loses context between sessions
- No sophisticated runway/velocity calculations
- Cannot drive push notifications (push requires backend)
- No dismissal persistence

### Backend Nudges (`apps/api/src/modules/nudges/nudges.service.ts`)

**Implementation:**
- Server-side calculation with full database access
- Three nudge types: runway/velocity, surplus-sweep, streak-at-risk
- Called via `GET /insights/nudges` endpoint
- More sophisticated calculations (real runway, velocity tracking)
- Money-personality modifier integration
- Still no dismissal state

**Strengths:**
- Sophisticated runway/velocity calculations
- Full ledger and balance access
- Can drive push notifications
- Money-personality modifiers already integrated
- Consistent with existing notification architecture

**Weaknesses:**
- No dismissal state
- Network latency
- Currently underutilized (client still derives simple nudges)
- Requires API calls

### Push Notification Infrastructure (Already Has Persistence)

**Implementation:**
- `notification_delivery` table for deduplication
- `notification_preferences` table for preference gating
- `PushDeliveryService` with `sendIfAllowed()` for preference-gated delivery
- Money-personality cadence modifiers
- Event-driven + cron-based scheduling

**Strengths:**
- Full deduplication via `dedupe_key`
- Preference gating per notification kind
- Money-personality modifiers integrated
- Idempotent delivery pattern
- Handles device token management

**Weaknesses:**
- Only for push notifications, not in-app nudges
- No direct integration with nudge cards

---

## Design Option 1: Full Backend with Dismissal State

### Architecture

**Single source of truth:** Backend `nudges.service.ts` generates all nudges

**Dismissal persistence:** Extend `notification_preferences` table:
```sql
ALTER TABLE notification_preferences 
ADD COLUMN dismissed_nudges JSONB DEFAULT '[]';
```

**API endpoints:**
- `GET /insights/nudges` - fetch nudges (filtering out dismissed)
- `POST /insights/nudges/{id}/dismiss` - dismiss a nudge
- `POST /insights/nudges/{id}/snooze` - snooze a nudge (optional)

**Client integration:**
- Replace client-side `deriveNudges()` with backend fetch
- Add dismissal UI to nudge cards
- Cache nudges locally for offline support

**Consistency:**
- Same dismissal pattern as push notifications
- Unified notification_preferences table
- Money-personality modifiers already integrated

### Implementation Details

**Backend changes:**
1. Extend `NotificationPreferences` type with `dismissed_nudges: string[]`
2. Add `dismissNudge(userId, nudgeId)` to repository
3. Add dismissal logic to `getNudges()` - filter out dismissed IDs
4. Add controller endpoints for dismiss/snooze actions
5. Integrate with money-personality modifiers for cadence/tone

**Client changes:**
1. Replace `deriveNudges()` with API call to `/insights/nudges`
2. Add dismiss button to NudgeCard component
3. Handle network errors gracefully (fallback to cached)
4. Sync dismissal state on next successful fetch

**Dismissal strategy:**
- Time-based dismissal (e.g., 7 days)
- Permanent dismissal with "show again" option
- Context-aware dismissal (dismiss until next income event)

### Pros
- ✅ Sophisticated runway/velocity calculations already exist
- ✅ Consistent with existing push notification architecture
- ✅ Money-personality modifiers already integrated
- ✅ Cross-session persistence
- ✅ Better data access (ledger, real balances)
- ✅ Push and in-app nudges can share dismissal state
- ✅ Single source of truth reduces bugs

### Cons
- ❌ Network latency for nudge display
- ❌ More complex architecture
- ❌ Requires schema migration
- ❌ Offline handling complexity
- ❌ Breaking change to current client behavior

### Effort Estimate
- Backend: 2-3 days (schema, endpoints, logic)
- Client: 2-3 days (replace deriveNudges, UI, error handling)
- Testing: 1-2 days
- **Total: 5-8 days**

---

## Design Option 2: Enhanced Client-Derived with Dismissal

### Architecture

**Keep current approach:** Client-side `deriveNudges()` as primary

**Add dismissal persistence:** Extend `notification_preferences` table or create new `nudge_dismissals` table

**API endpoints:**
- `POST /insights/nudges/{id}/dismiss` - dismiss a nudge
- `GET /insights/nudges/dismissed` - fetch dismissed nudge IDs

**Client integration:**
- Keep current `deriveNudges()` logic
- Filter out dismissed IDs from local state
- Sync dismissal state with backend
- Cache dismissed IDs locally for offline

### Implementation Details

**Backend changes:**
1. Create `nudge_dismissals` table or extend `notification_preferences`
2. Add `dismissNudge(userId, nudgeId)` endpoint
3. Simple CRUD for dismissal state

**Client changes:**
1. Keep `deriveNudges()` unchanged
2. Add local dismissal state (React state + AsyncStorage)
3. Filter dismissed IDs before rendering
4. Sync dismissals to backend on network

**Dismissal strategy:**
- Simple permanent dismissal per nudge ID
- Time-based cleanup (remove entries older than 30 days)
- Reset on plan retake

### Pros
- ✅ Simple, maintains current architecture
- ✅ No network latency for nudge calculation
- ✅ Works offline
- ✅ Minimal backend changes
- ✅ Easy to iterate on client logic
- ✅ Adds dismissal persistence with low effort

### Cons
- ❌ Limited to client-side data access
- ❌ Cannot use sophisticated runway/velocity calculations
- ❌ Push and in-app nudges remain separate systems
- ❌ Money-personality modifiers not integrated
- ❌ No single source of truth
- ❌ Less sophisticated insights

### Effort Estimate
- Backend: 0.5-1 day (simple CRUD endpoints)
- Client: 1-2 days (dismissal UI, state management, sync)
- Testing: 0.5-1 day
- **Total: 2-4 days**

---

## Design Option 3: Hybrid Approach

### Architecture

**Split responsibility:**
- **Simple nudges:** Client-derived (daily caps, streaks, rollover)
- **Complex nudges:** Backend-derived (runway/velocity, surplus-sweep)

**Unified dismissal:** Backend dismissal state for both

**API endpoints:**
- `GET /insights/nudges` - fetch complex nudges
- `POST /insights/nudges/{id}/dismiss` - dismiss any nudge
- Client continues to derive simple nudges locally

**Client integration:**
- Merge backend nudges with client-derived nudges
- Unified dismissal filtering
- Priority: backend nudges take precedence over client

### Implementation Details

**Backend changes:**
1. Extend existing `nudges.service.ts` with dismissal logic
2. Add dismissal endpoints
3. Add preference gating for complex nudges

**Client changes:**
1. Keep `deriveNudges()` for simple nudges
2. Fetch complex nudges from backend
3. Merge and deduplicate by nudge ID
4. Unified dismissal UI for both types

**Nudge categorization:**
- **Client-derived:** Daily caps, streaks, rollover, discipline score
- **Backend-derived:** Runway/velocity, surplus-sweep, streak-at-risk

### Pros
- ✅ Best of both worlds: simple client nudges + sophisticated backend nudges
- ✅ Network latency only for complex nudges
- ✅ Offline support for simple nudges
- ✅ Gradual migration path
- ✅ Can leverage existing sophisticated calculations
- ✅ Unified dismissal state

### Cons
- ❌ Most complex architecture
- ❌ Two sources of truth can conflict
- ❌ Merge logic complexity
- ❌ Inconsistent user experience (some nudges offline, some not)
- ❌ Harder to maintain and debug
- ❌ Higher cognitive load for developers

### Effort Estimate
- Backend: 2-3 days (dismissal logic, categorization)
- Client: 3-4 days (merge logic, unified UI, error handling)
- Testing: 1-2 days
- **Total: 6-9 days**

---

## Recommendation: Option 1 (Full Backend)

### Rationale

**Primary reasons:**
1. **Consistency:** Aligns with existing push notification architecture
2. **Sophistication:** Leverages existing runway/velocity calculations
3. **Single source of truth:** Reduces bugs and inconsistency
4. **Future-proof:** Enables push notification integration naturally
5. **Money-personality integration:** Already implemented in backend

**Secondary benefits:**
- Cross-session persistence
- Better data access
- Unified dismissal state
- Consistent with audit_team.md guidance ("ongoing monitoring" infrastructure)

**Migration path:**
- Phase 1: Add dismissal endpoints to backend
- Phase 2: Update client to fetch from backend (with fallback to current)
- Phase 3: Remove client-side deriveNudges()
- Phase 4: Integrate push notification triggering

**Risk mitigation:**
- Keep client-side deriveNudges() as fallback during migration
- Add error boundaries for network failures
- Cache nudges locally for offline support
- Gradual rollout with feature flags

---

## Implementation Notes

### Dismissal State Schema

**Option A: Extend notification_preferences**
```sql
ALTER TABLE notification_preferences 
ADD COLUMN dismissed_nudges JSONB DEFAULT '[]';
-- Store: [{id: 'runway-critical', dismissedAt: '2024-01-15T10:00:00Z', expiresAt: '2024-01-22T10:00:00Z'}]
```

**Option B: Separate nudge_dismissals table**
```sql
CREATE TABLE nudge_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  nudge_id VARCHAR(255) NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  reason VARCHAR(50), -- 'permanent', 'snooze', 'context'
  UNIQUE(user_id, nudge_id)
);
```

### Money-Personality Integration

The existing `personality-modifiers.ts` provides:
- `notificationCadenceFor()` - interval multiplier and tone
- `coolingOffModifierFor()` - cooling-off duration and framing
- `insightPriorityOrderFor()` - insight ordering

These should be applied to nudges similarly to how they're applied to notifications:
- **Cadence:** How often nudges are shown/re-shown
- **Tone:** Copy framing (gentle vs direct)
- **Priority:** Which nudges appear first

### Push Notification Integration

With full backend nudges, push notifications become natural:
- Backend generates nudges
- High-priority nudges trigger push notifications
- Dismissal state syncs between push and in-app
- Money-personality modifiers apply to both

---

## Decision Timeline

### Phase 1: Documentation (Current)
- ✅ Document architecture options
- ✅ Get stakeholder alignment
- ✅ Choose final approach

### Phase 2: Schema and Backend (if Option 1 chosen)
- Add dismissal columns/tables
- Implement dismissal endpoints
- Update nudge generation logic
- Add money-personality integration

### Phase 3: Client Migration
- Replace deriveNudges with API calls
- Add dismissal UI
- Implement error handling and fallbacks
- Add offline caching

### Phase 4: Push Integration
- Connect nudges to push notification triggers
- Sync dismissal state
- Implement preference gating

---

## Open Questions

1. **Dismissal strategy:** Should nudges be permanently dismissed or expire after a time period?
2. **Snooze functionality:** Should users be able to snooze nudges for a period?
3. **Context-aware dismissal:** Should dismissal reset on significant events (plan retake, income event)?
4. **Priority ordering:** How should nudges be ordered when multiple are active?
5. **Preference gating:** Should users be able to opt out of specific nudge types?
6. **Analytics:** Should we track nudge dismissal rates for optimization?

---

## References

- Current implementation: `apps/mobile/src/services/nudges.ts`
- Backend nudges: `apps/api/src/modules/nudges/nudges.service.ts`
- Push delivery: `apps/api/src/modules/notifications/push-delivery.service.ts`
- Money-personality modifiers: `apps/api/src/common/personality-modifiers.ts`
- Database schema: `apps/api/src/database/database.types.ts`
- Notification preferences: `notification_preferences` table
- Notification delivery: `notification_delivery` table
