# Financial Hub API Specification

## Overview
This document specifies all API endpoints needed to implement the missing screens and features for the Financial Hub application.

---

## Phase 1: Core Pocket Management APIs

### 1.1 Pocket Detail API

#### GET /pockets/:id/transactions
Get transaction history for a specific pocket with pagination.

**Request:**
```typescript
GET /pockets/:id/transactions?page=1&limit=20
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number for pagination
- `limit` (optional, default: 20) - Number of transactions per page

**Response (200 OK):**
```typescript
{
  "transactions": [
    {
      "id": "uuid",
      "pocket_id": "uuid",
      "amount": number,
      "type": "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover",
      "merchant": string | null,
      "category": "grocery" | "landlord_rent" | "utility" | "transport" | "healthcare" | "education" | "entertainment" | "gambling_betting" | "personal_care" | "other" | "unclassified" | null,
      "created_at": "ISO-8601 datetime"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Response (404 Not Found):**
```typescript
{
  "statusCode": 404,
  "message": "Pocket not found",
  "error": "Not Found"
}
```

**Response (403 Forbidden):**
```typescript
{
  "statusCode": 403,
  "message": "You don't have access to this pocket",
  "error": "Forbidden"
}
```

---

#### GET /pockets/:id/summary
Get pocket summary including available balance, spending, and allocation details.

**Request:**
```typescript
GET /pockets/:id/summary
```

**Response (200 OK):**
```typescript
{
  "pocket": {
    "id": "uuid",
    "name": "Groceries & food",
    "kind": "spendable",
    "category": "food",
    "monthly_allocation": 6240,
    "daily_cap": 208,
    "is_time_locked": false,
    "lock_until": null
  },
  "summary": {
    "available": 3660,
    "spent": 2580,
    "remaining": 3660,
    "percentage_remaining": 59,
    "monthly_allocation": 6240,
    "days_remaining": 18,
    "daily_average_spend": 143.33
  },
  "recent_activity": {
    "last_transaction": "2026-08-09T13:24:00Z",
    "transaction_count": 15,
    "reallocation_count": 3
  }
}
```

---

#### GET /pockets/:id/merchant-scope
Get merchant scope (allowed/blocked categories) for a specific pocket.

**Request:**
```typescript
GET /pockets/:id/merchant-scope
```

**Response (200 OK):**
```typescript
{
  "pocket_id": "uuid",
  "pocket_name": "Groceries & food",
  "pocket_kind": "spendable",
  "merchant_scope": {
    "allowed_categories": [
      "grocery",
      "food_delivery",
      "restaurants"
    ],
    "blocked_categories": [
      "gambling_betting",
      "entertainment"
    ],
    "classification_mode": "strict", // "strict" | "permissive"
    "unclassified_handling": "ask_once" // "ask_once" | "block" | "allow"
  },
  "saved_classifications": [
    {
      "recipient_key": "Naivas Supermarket",
      "category": "grocery",
      "remember": true,
      "created_at": "2026-08-01T10:00:00Z"
    }
  ]
}
```

---

### 1.2 Manual Income Entry API

#### POST /income/manual
Create a manual income entry with optional allocation.

**Request:**
```typescript
POST /income/manual
Content-Type: application/json

{
  "amount": 14500,
  "source": "client_payment", // "client_payment" | "cash" | "other"
  "label": "Website project — Kito Ltd",
  "date": "2026-08-07",
  "run_allocation": true
}
```

**Request Schema:**
```typescript
{
  amount: number; // Required, positive number
  source: 'client_payment' | 'cash' | 'other'; // Required
  label?: string; // Optional, max 255 characters
  date: string; // Required, ISO-8601 date format
  run_allocation: boolean; // Required, whether to trigger allocation
}
```

**Response (201 Created):**
```typescript
{
  "income_event": {
    "id": "uuid",
    "user_id": "uuid",
    "amount": 14500,
    "source": "client_payment",
    "label": "Website project — Kito Ltd",
    "date": "2026-08-07",
    "run_allocation": true,
    "created_at": "2026-08-09T10:30:00Z"
  },
  "allocation": {
    "triggered": true,
    "allocations": [
      {
        "pocket_id": "uuid",
        "pocket_name": "Savings",
        "amount": 1450,
        "percentage": 10
      },
      {
        "pocket_id": "uuid",
        "pocket_name": "Groceries & food",
        "amount": 4350,
        "percentage": 30
      },
      {
        "pocket_id": "uuid",
        "pocket_name": "Transport",
        "amount": 2175,
        "percentage": 15
      },
      {
        "pocket_id": "uuid",
        "pocket_name": "Personal & leisure",
        "amount": 2900,
        "percentage": 20
      }
    ],
    "total_allocated": 10875,
    "unallocated": 3625
  }
}
```

**Response (400 Bad Request):**
```typescript
{
  "statusCode": 400,
  "message": "Invalid income data",
  "errors": [
    {
      "field": "amount",
      "message": "Amount must be a positive number"
    }
  ]
}
```

---

#### POST /income/manual/allocate-preview
Preview allocation for manual income before confirming.

**Request:**
```typescript
POST /income/manual/allocate-preview
Content-Type: application/json

{
  "amount": 14500,
  "source": "client_payment"
}
```

**Response (200 OK):**
```typescript
{
  "preview": {
    "total_amount": 14500,
    "allocation_rules": {
      "savings_min_percentage": 10,
      "use_plan_rules": true
    },
    "projected_allocations": [
      {
        "pocket_id": "uuid",
        "pocket_name": "Savings",
        "amount": 1450,
        "percentage": 10,
        "is_minimum": true
      },
      {
        "pocket_id": "uuid",
        "pocket_name": "Groceries & food",
        "amount": 4350,
        "percentage": 30
      },
      {
        "pocket_id": "uuid",
        "pocket_name": "Transport",
        "amount": 2175,
        "percentage": 15
      },
      {
        "pocket_id": "uuid",
        "pocket_name": "Personal & leisure",
        "amount": 2900,
        "percentage": 20
      }
    ],
    "total_allocated": 10875,
    "unallocated": 3625,
    "unallocated_handling": "remaining_balance"
  }
}
```

---

## Phase 2: Merchant Classification System APIs

### 2.1 Merchant Classification API

#### POST /merchant/classify
Save or update a merchant classification for a user.

**Request:**
```typescript
POST /merchant/classify
Content-Type: application/json

{
  "recipient_key": "Juma K.",
  "category": "other",
  "pocket_id": "uuid",
  "remember": true,
  "context": {
    "transaction_id": "uuid",
    "amount": 500,
    "description": "P2P payment · Self-help group contribution"
  }
}
```

**Request Schema:**
```typescript
{
  recipient_key: string; // Required, merchant/recipient identifier
  category: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified'; // Required
  pocket_id: string; // Required, target pocket for this classification
  remember: boolean; // Required, whether to remember for future transactions
  context?: {
    transaction_id?: string;
    amount?: number;
    description?: string;
  }; // Optional context
}
```

**Response (201 Created):**
```typescript
{
  "classification": {
    "id": "uuid",
    "user_id": "uuid",
    "recipient_key": "Juma K.",
    "category": "other",
    "pocket_id": "uuid",
    "remember": true,
    "created_at": "2026-08-09T14:30:00Z"
  },
  "transaction_updated": {
    "id": "uuid",
    "category": "other"
  }
}
```

---

#### GET /merchant/classifications
Get all merchant classifications for the current user.

**Request:**
```typescript
GET /merchant/classifications?page=1&limit=50&search=Juma
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 50) - Results per page
- `search` (optional) - Filter by recipient key

**Response (200 OK):**
```typescript
{
  "classifications": [
    {
      "id": "uuid",
      "recipient_key": "Juma K.",
      "category": "other",
      "pocket_id": "uuid",
      "pocket_name": "Personal & leisure",
      "remember": true,
      "usage_count": 5,
      "last_used": "2026-08-09T14:30:00Z",
      "created_at": "2026-08-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 23,
    "totalPages": 1
  }
}
```

---

#### DELETE /merchant/classifications/:id
Remove a merchant classification.

**Request:**
```typescript
DELETE /merchant/classifications/:id
```

**Response (204 No Content):**
Empty response body.

**Response (404 Not Found):**
```typescript
{
  "statusCode": 404,
  "message": "Classification not found",
  "error": "Not Found"
}
```

---

### 2.2 Blocked Spend Check API

#### POST /spend/check
Check if a spend is allowed for a specific pocket and merchant.

**Request:**
```typescript
POST /spend/check
Content-Type: application/json

{
  "pocket_id": "uuid",
  "amount": 500,
  "recipient_key": "Juma K.",
  "category": "unclassified"
}
```

**Request Schema:**
```typescript
{
  pocket_id: string; // Required
  amount: number; // Required
  recipient_key?: string; // Optional
  category?: string; // Optional, if known
}
```

**Response (200 OK - Allowed):**
```typescript
{
  "allowed": true,
  "block_reason": null,
  "suggested_category": null,
  "pocket": {
    "id": "uuid",
    "name": "Groceries & food",
    "available_balance": 3660
  }
}
```

**Response (200 OK - Blocked):**
```typescript
{
  "allowed": false,
  "block_reason": "blocked_category",
  "blocked_category": "gambling_betting",
  "pocket_type": "essential",
  "message": "Betting & gambling can't be paid from Groceries & food",
  "review_available": true,
  "pocket": {
    "id": "uuid",
    "name": "Groceries & food",
    "available_balance": 3660
  }
}
```

**Response (200 OK - Needs Classification):**
```typescript
{
  "allowed": false,
  "block_reason": "unclassified_merchant",
  "requires_classification": true,
  "recipient_key": "Juma K.",
  "suggested_categories": [
    {
      "category": "other",
      "pocket_id": "uuid",
      "pocket_name": "Personal & leisure",
      "confidence": 0.8
    }
  ],
  "message": "We need to sort this payment into the right pocket"
}
```

---

#### GET /spend/blocked-reasons
Get list of blocked categories for a specific pocket.

**Request:**
```typescript
GET /spend/blocked-reasons?pocket_id=uuid
```

**Query Parameters:**
- `pocket_id` (required) - Pocket ID to check

**Response (200 OK):**
```typescript
{
  "pocket_id": "uuid",
  "pocket_name": "Groceries & food",
  "pocket_kind": "spendable",
  "blocked_categories": [
    {
      "category": "gambling_betting",
      "reason": "Essential pocket protection",
      "can_override": false
    },
    {
      "category": "entertainment",
      "reason": "Essential pocket protection",
      "can_override": true
    }
  ],
  "allowed_categories": [
    "grocery",
    "food_delivery",
    "restaurants",
    "utilities"
  ]
}
```

---

### 2.3 Report Merchant API

#### POST /merchant/report
Submit a merchant classification report.

**Request:**
```typescript
POST /merchant/report
Content-Type: application/json

{
  "recipient_key": "Juma K.",
  "report_type": "wrong_category",
  "description": "This is a self-help group contribution — it's not betting or an unclassified leisure payment.",
  "transaction_id": "uuid",
  "suggested_category": "other"
}
```

**Request Schema:**
```typescript
{
  recipient_key: string; // Required
  report_type: 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee'; // Required
  description?: string; // Optional, detailed description
  transaction_id?: string; // Optional, related transaction
  suggested_category?: string; // Optional, suggested correct category
}
```

**Response (201 Created):**
```typescript
{
  "report": {
    "id": "uuid",
    "user_id": "uuid",
    "recipient_key": "Juma K.",
    "report_type": "wrong_category",
    "description": "This is a self-help group contribution...",
    "status": "pending",
    "created_at": "2026-08-09T15:00:00Z"
  },
  "message": "Thank you for your report. We'll review it and improve our classification."
}
```

---

#### GET /merchant/reports
Get user's submitted merchant reports.

**Request:**
```typescript
GET /merchant/reports?page=1&limit=20&status=pending
```

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Results per page
- `status` (optional) - Filter by status: pending, reviewed, resolved

**Response (200 OK):**
```typescript
{
  "reports": [
    {
      "id": "uuid",
      "recipient_key": "Juma K.",
      "report_type": "wrong_category",
      "description": "This is a self-help group contribution...",
      "status": "pending",
      "created_at": "2026-08-09T15:00:00Z",
      "reviewed_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## Phase 3: Advanced Features APIs

### 3.1 Time-Lock Unlock API

#### POST /pockets/:id/unlock
Request early unlock of a time-locked pocket with discipline cost.

**Request:**
```typescript
POST /pockets/:id/unlock
Content-Type: application/json

{
  "reason": "emergency_expense",
  "biometric_confirmed": true
}
```

**Request Schema:**
```typescript
{
  reason?: string; // Optional, reason for early unlock
  biometric_confirmed: boolean; // Required, biometric confirmation
}
```

**Response (200 OK - Unlock Successful):**
```typescript
{
  "unlock": {
    "pocket_id": "uuid",
    "pocket_name": "Savings",
    "original_lock_until": "2026-09-21T00:00:00Z",
    "unlocked_at": "2026-08-09T16:00:00Z",
    "days_remaining": 45
  },
  "discipline_cost": {
    "points_deducted": 10,
    "previous_score": 85,
    "new_score": 75,
    "reason": "early_unlock_45_days"
  },
  "transaction": {
    "id": "uuid",
    "type": "early_unlock",
    "amount": 0,
    "description": "Early unlock - 45 days remaining"
  }
}
```

**Response (400 Bad Request - Already Unlocked):**
```typescript
{
  "statusCode": 400,
  "message": "This pocket is not currently locked",
  "error": "Bad Request"
}
```

**Response (403 Forbidden - Biometric Required):**
```typescript
{
  "statusCode": 403,
  "message": "Biometric confirmation required for early unlock",
  "error": "Forbidden"
}
```

---

#### GET /pockets/:id/lock-status
Get lock status and remaining time for a pocket.

**Request:**
```typescript
GET /pockets/:id/lock-status
```

**Response (200 OK):**
```typescript
{
  "pocket_id": "uuid",
  "pocket_name": "Savings",
  "is_locked": true,
  "lock_status": {
    "locked_until": "2026-09-21T00:00:00Z",
    "locked_at": "2026-08-07T00:00:00Z",
    "total_lock_days": 45,
    "days_remaining": 43,
    "days_elapsed": 2,
    "percentage_complete": 4.4
  },
  "protected_amount": 8500,
  "early_unlock_cost": 10,
  "can_unlock": true
}
```

**Response (200 OK - Not Locked):**
```typescript
{
  "pocket_id": "uuid",
  "pocket_name": "Savings",
  "is_locked": false,
  "lock_status": null,
  "protected_amount": 0,
  "early_unlock_cost": 0,
  "can_unlock": false
}
```

---

#### POST /pockets/:id/extend-lock
Extend the lock period for a time-locked pocket.

**Request:**
```typescript
POST /pockets/:id/extend-lock
Content-Type: application/json

{
  "additional_days": 30,
  "reason": "building_emergency_fund"
}
```

**Request Schema:**
```typescript
{
  additional_days: number; // Required, positive number
  reason?: string; // Optional, reason for extension
}
```

**Response (200 OK):**
```typescript
{
  "extension": {
    "pocket_id": "uuid",
    "previous_lock_until": "2026-09-21T00:00:00Z",
    "new_lock_until": "2026-10-21T00:00:00Z",
    "days_added": 30,
    "total_lock_days": 75
  },
  "discipline_bonus": {
    "points_added": 5,
    "previous_score": 75,
    "new_score": 80,
    "reason": "lock_extension_30_days"
  }
}
```

---

### 3.2 Notifications Settings API

#### GET /notifications/settings
Get user notification preferences.

**Request:**
```typescript
GET /notifications/settings
```

**Response (200 OK):**
```typescript
{
  "preferences": {
    "reallocation_confirms": true,
    "cooling_off_reminders": true,
    "savings_milestones": true,
    "monthly_insights": false,
    "tips_nudges": false
  },
  "user_id": "uuid",
  "updated_at": "2026-08-09T10:00:00Z"
}
```

**Response (404 Not Found - First Time):**
```typescript
{
  "preferences": {
    "reallocation_confirms": true,
    "cooling_off_reminders": true,
    "savings_milestones": true,
    "monthly_insights": false,
    "tips_nudges": false
  },
  "user_id": "uuid",
  "is_default": true
}
```

---

#### PUT /notifications/settings
Update user notification preferences.

**Request:**
```typescript
PUT /notifications/settings
Content-Type: application/json

{
  "reallocation_confirms": true,
  "cooling_off_reminders": true,
  "savings_milestones": true,
  "monthly_insights": true,
  "tips_nudges": false
}
```

**Request Schema:**
```typescript
{
  reallocation_confirms?: boolean;
  cooling_off_reminders?: boolean;
  savings_milestones?: boolean;
  monthly_insights?: boolean;
  tips_nudges?: boolean;
}
```

**Response (200 OK):**
```typescript
{
  "preferences": {
    "reallocation_confirms": true,
    "cooling_off_reminders": true,
    "savings_milestones": true,
    "monthly_insights": true,
    "tips_nudges": false
  },
  "user_id": "uuid",
  "updated_at": "2026-08-09T16:30:00Z"
}
```

---

## Common Response Codes

### Success Responses
- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded, no content returned

### Error Responses
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - User lacks permission
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., insufficient funds)
- `422 Unprocessable Entity` - Valid data but semantic error
- `500 Internal Server Error` - Server error

### Error Response Format
```typescript
{
  "statusCode": number,
  "message": string,
  "error": string,
  "errors?: Array<{
    field: string;
    message: string;
  }>
}
```

---

## Authentication

All endpoints require authentication via Supabase Auth token in the `Authorization` header:

```
Authorization: Bearer <supabase_jwt_token>
```

The existing `SupabaseAuthGuard` will validate the token and inject the user object into the request.

---

## Rate Limiting

Suggested rate limits for production:

- Pocket detail endpoints: 100 requests/minute
- Classification endpoints: 50 requests/minute
- Manual income entry: 20 requests/minute
- Spend check: 200 requests/minute
- Settings endpoints: 30 requests/minute

---

## Webhooks (Future Consideration)

Future implementations may include webhooks for:

- Reallocation status changes
- Cooling-off period completion
- Savings milestone achievements
- Monthly insight generation
- Merchant report status updates

Webhook format will follow standard POST with signature verification.

---

## Testing Examples

### Example 1: Complete Manual Income Flow
```bash
# 1. Preview allocation
curl -X POST http://localhost:3000/income/manual/allocate-preview \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 14500, "source": "client_payment"}'

# 2. Create income with allocation
curl -X POST http://localhost:3000/income/manual \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 14500, "source": "client_payment", "label": "Website project", "date": "2026-08-07", "run_allocation": true}'
```

### Example 2: Merchant Classification Flow
```bash
# 1. Check if spend is allowed
curl -X POST http://localhost:3000/spend/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pocket_id": "uuid", "amount": 500, "recipient_key": "Juma K.", "category": "unclassified"}'

# 2. Save classification
curl -X POST http://localhost:3000/merchant/classify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient_key": "Juma K.", "category": "other", "pocket_id": "uuid", "remember": true}'
```

### Example 3: Time-Lock Unlock Flow
```bash
# 1. Check lock status
curl -X GET http://localhost:3000/pockets/uuid/lock-status \
  -H "Authorization: Bearer $TOKEN"

# 2. Request early unlock
curl -X POST http://localhost:3000/pockets/uuid/unlock \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "emergency", "biometric_confirmed": true}'
```

---

## Versioning

API versioning will use URL path versioning:
- Current version: `/v1/`
- Example: `/v1/pockets/:id/transactions`

When breaking changes are introduced, a new version will be created.

---

## Performance Considerations

### Response Time Targets
- Pocket detail queries: < 200ms
- Classification lookups: < 100ms
- Spend checks: < 50ms
- Settings operations: < 150ms

### Caching Strategy
- Merchant classifications: Cache for 1 hour
- Pocket summaries: Cache for 5 minutes
- User preferences: Cache for 30 minutes
- Spend block rules: Cache for 1 hour

### Database Indexing
Required indexes for performance:
- `transactions(pocket_id, created_at)`
- `merchant_classifications(user_id, recipient_key)`
- `pockets(user_id, is_time_locked)`
- `income_events(user_id, date)`
- `reallocations(from_pocket_id, status)`

---

## Security Considerations

### Input Validation
- All monetary values must be positive numbers
- All dates must be valid ISO-8601 format
- All UUIDs must be valid UUID format
- All enum values must match defined options

### Authorization
- Users can only access their own data
- Pocket access limited to user's own pockets
- Classification operations limited to user's own classifications

### Audit Logging
Sensitive operations should be logged:
- Manual income entries
- Reallocation operations
- Early unlock requests
- Classification changes
- Settings modifications

---

This API specification provides a complete roadmap for implementing all missing backend features. Each endpoint includes detailed request/response schemas, error handling, and practical examples for testing and integration.