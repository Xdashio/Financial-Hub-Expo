# Emergency Unlock Feature Spec

## Overview
When all non-savings pockets are depleted, users can unlock funds from their savings pocket as an emergency measure. The feature analyzes their 30-day spending patterns to suggest a safe amount range, limits usage to once per month, and allocates the unlocked amount proportionally to non-savings pockets like normal income allocation.

## User Flow

### Trigger Conditions
1. All non-savings pockets (spendable + fixed) have zero available balance
2. User has initially allocated pockets (not a new user with no allocations)
3. Savings pocket has non-zero balance
4. User has ≥7 days of spending history (for meaningful pattern analysis)

### When Feature is NOT Available
- **New users with no allocations**: Feature not shown
- **Users with <7 days spending history**: Show graceful message when they try to access emergency unlock:
  - "Not enough spending data yet to calculate safe amounts. Continue logging spends for a few more days to unlock this feature."
- **Savings pocket depleted**: Feature not shown

### Flow Steps

1. **Detection**: App detects all non-savings pockets are at zero balance
2. **UI Entry Point**: 
   - Bottom sheet/banner on pockets screen
   - Notification prompt
   - Triggered when user tries to interact with depleted pockets
3. **Spending Analysis** (backend):
   - Fetch last 30 days of transactions
   - Filter to non-savings + fixed expenses pockets only
   - Calculate:
     - `least_daily_spend`: minimum total spend per day
     - `most_daily_spend`: maximum total spend per day
     - `average_daily_spend`: mean daily spend
   - Handle edge case: if all daily amounts are equal, use that single value
4. **Amount Range Calculation**:
   - Minimum: `least_daily_spend`
   - Maximum: `average_daily_spend` (conservative)
   - Show both numeric amounts and "days this will last you" translation simultaneously
5. **User Selection**:
   - Slider or input field between min and max
   - Real-time "X KSh will last you Y days" display
   - Y calculated as: `selected_amount / least_daily_spend` (conservative)
6. **Savings Reserve Protection**:
   - Do not unlock entire savings balance
   - Leave a reserve (e.g., 20% of savings or minimum KSh threshold)
   - Show user: "You'll keep KSh X in reserve"
7. **Confirmation**:
   - Show breakdown of how amount will be allocated across pockets
   - One-time monthly limit: "You can only do this once per month. Last used: [date]"
8. **Allocation**:
   - Proportionally allocate to all non-savings pockets (like normal income)
   - Create ledger transactions from savings → target pockets
   - Record emergency unlock event for monthly limit tracking

## Data Model

### New Table: `emergency_unlocks`
```sql
CREATE TABLE emergency_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id UUID NOT NULL REFERENCES plans(id),
  amount NUMERIC NOT NULL,
  days_calculated INTEGER NOT NULL,
  least_daily_spend NUMERIC NOT NULL,
  average_daily_spend NUMERIC NOT NULL,
  reserve_kept NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT one_per_month UNIQUE (user_id, DATE_TRUNC('month', created_at))
);
```

### Fields to Add to Existing Tables
- `pockets` table: No changes needed
- `transactions` table: Add `emergency_unlock_id` UUID FK to `emergency_unlocks.id` (nullable)

## API Endpoints

### GET /pockets/emergency-unlock/eligibility
Returns whether user is eligible for emergency unlock and analysis data.

**Response (eligible):**
```json
{
  "eligible": true,
  "analysis": {
    "least_daily_spend": 500,
    "most_daily_spend": 2000,
    "average_daily_spend": 1200,
    "days_of_history": 30,
    "monthly_limit_used": false,
    "last_used": null
  },
  "savings_reserve": {
    "total_savings": 50000,
    "minimum_reserve": 10000,
    "available_to_unlock": 40000
  }
}
```

**Response (not eligible - insufficient history):**
```json
{
  "eligible": false,
  "reason": "insufficient_history",
  "message": "Not enough spending data yet to calculate safe amounts. Continue logging spends for a few more days to unlock this feature.",
  "days_of_history": 3,
  "minimum_required_days": 7
}
```

**Response (not eligible - monthly limit):**
```json
{
  "eligible": false,
  "reason": "monthly_limit_reached",
  "message": "You can only use emergency unlock once per month. Next available: 2026-09-01",
  "last_used": "2026-08-15T10:30:00Z"
}
```

**Response (not eligible - savings depleted):**
```json
{
  "eligible": false,
  "reason": "savings_depleted",
  "message": "Your savings pocket is currently empty. Emergency unlock requires available savings."
}
```

### POST /pockets/emergency-unlock
Execute the emergency unlock with selected amount.

**Request:**
```json
{
  "amount": 1500,
  "confirm_reserve": true
}
```

**Response (success):**
```json
{
  "applied": true,
  "unlock": {
    "id": "unlock-uuid",
    "amount": 1500,
    "days_lasting": 3,
    "reserve_kept": 10000,
    "allocations": [
      {
        "pocket_id": "pocket-food",
        "pocket_name": "Food & Groceries",
        "amount": 900,
        "percentage": 60
      },
      {
        "pocket_id": "pocket-transport",
        "pocket_name": "Transport",
        "amount": 600,
        "percentage": 40
      }
    ]
  },
  "next_available": "2026-09-01"
}
```

**Response (validation failure):**
```json
{
  "applied": false,
  "error": "amount_below_minimum",
  "message": "Amount must be at least KSh 500 (your least daily spend)"
}
```

## Shared Schemas

### EmergencyUnlockEligibilityResponse
```typescript
{
  eligible: boolean;
  reason?: 'insufficient_history' | 'monthly_limit_reached' | 'savings_depleted' | 'no_depleted_pockets';
  message?: string;
  analysis?: {
    least_daily_spend: number;
    most_daily_spend: number;
    average_daily_spend: number;
    days_of_history: number;
    monthly_limit_used: boolean;
    last_used: string | null;
  };
  savings_reserve?: {
    total_savings: number;
    minimum_reserve: number;
    available_to_unlock: number;
  };
  days_of_history?: number;
  minimum_required_days?: number;
  last_used?: string;
  next_available?: string;
}
```

### EmergencyUnlockRequest
```typescript
{
  amount: number;
  confirm_reserve: boolean;
}
```

### EmergencyUnlockResponse
```typescript
{
  applied: boolean;
  unlock?: {
    id: string;
    amount: number;
    days_lasting: number;
    reserve_kept: number;
    allocations: Array<{
      pocket_id: string;
      pocket_name: string;
      amount: number;
      percentage: number;
    }>;
  };
  error?: string;
  message?: string;
  next_available?: string;
}
```

## Service Implementation

### SpendingAnalysisService
```typescript
class SpendingAnalysisService {
  async analyze30DaySpending(userId: string, planId: string): Promise<{
    least_daily_spend: number;
    most_daily_spend: number;
    average_daily_spend: number;
    days_of_history: number;
    daily_spend_by_date: Map<string, number>;
  }>;
  
  private filterToNonSavingsPockets(transactions: Transaction[]): Transaction[];
  private groupByDate(transactions: Transaction[]): Map<string, number>;
  private calculateStatistics(dailySpendMap: Map<string, number>): Statistics;
}
```

### EmergencyUnlockService
```typescript
class EmergencyUnlockService {
  async checkEligibility(userId: string, planId: string): Promise<EmergencyUnlockEligibilityResponse>;
  
  async executeUnlock(
    userId: string,
    planId: string,
    request: EmergencyUnlockRequest
  ): Promise<EmergencyUnlockResponse>;
  
  private async validateMonthlyLimit(userId: string): Promise<boolean>;
  private async calculateReserve(savingsBalance: number): number;
  private async allocateToPockets(
    amount: number,
    pockets: Pocket[],
    planId: string
  ): Promise<Transaction[]>;
  private recordUnlock(data: EmergencyUnlockRecord): Promise<void>;
}
```

## Edge Cases

1. **No spending history (<7 days)**: Return graceful message, do not show unlock UI
2. **All daily spends equal**: Use that single value for both least and average
3. **User has allocations but no history**: Use monthly_allocation ÷ 30 as fallback (if enabled)
4. **Savings balance < minimum reserve**: Do not allow unlock
5. **Monthly limit already used**: Return next available date
6. **Some pockets not depleted**: Do not show unlock (only when ALL non-savings are zero)
7. **Zero daily spend for some days**: Include zeros in calculation (conservative)
8. **Negative transactions (refunds)**: Exclude from daily spend calculation

## Mobile UI Design

### Bottom Sheet Components

1. **Header**: "Emergency Unlock from Savings"
2. **Analysis Summary**:
   - "Based on your last 30 days of spending:"
   - "Least spent per day: KSh X"
   - "Average spent per day: KSh Y"
3. **Amount Selector**:
   - Slider from minimum to maximum
   - Input field for precise entry
   - Real-time display: "KSh [amount] will last you [days] days"
4. **Reserve Info**:
   - "You'll keep KSh [reserve] in savings"
   - Progress bar showing unlock amount vs reserve
5. **Allocation Preview**:
   - "This will be distributed as:"
   - Pocket breakdown with percentages
6. **Monthly Limit Warning**:
   - "You can only do this once per month"
   - "Last used: [date]" (if applicable)
7. **Actions**:
   - "Cancel" button
   - "Unlock KSh [amount]" button (primary)

### Notification

**When eligible**: "Your pockets are empty. Unlock emergency funds from savings to cover daily expenses."

**When not eligible (insufficient history)**: "Continue logging your daily spends to unlock personalized emergency recommendations."

## Implementation Phases

### Phase 1 - Backend Foundation
- Database migration for `emergency_unlocks` table
- Add `emergency_unlock_id` to transactions table
- Shared schemas for request/response types
- SpendingAnalysisService implementation
- EmergencyUnlockService basic implementation
- API endpoints (eligibility check, execute unlock)

### Phase 2 - Backend Integration
- Integrate with pockets service for allocation logic
- Integrate with transaction service for ledger entries
- Add monthly limit enforcement
- Add reserve calculation logic
- Comprehensive error handling

### Phase 3 - Testing
- Unit tests for SpendingAnalysisService
- Unit tests for EmergencyUnlockService
- Integration tests for API endpoints
- Edge case coverage (no history, equal spends, etc.)

### Phase 4 - Mobile UI
- Design emergency unlock bottom sheet
- Implement amount selector with real-time calculation
- Implement allocation preview
- Implement notification trigger
- Add to pockets screen when depleted
- Add to depleted pocket detail screens

### Phase 5 - Polish
- Analytics tracking for unlock usage
- A/B test reserve percentage (20% vs 30%)
- User feedback collection
- Performance optimization for 30-day analysis
