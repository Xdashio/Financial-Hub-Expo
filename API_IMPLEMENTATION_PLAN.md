# Financial Hub - API Implementation Plan

## Overview

This plan outlines the steps to make all backend APIs fully functional and ready for the frontend integration. Based on the audit, we have 5 real implementations and 2 stub implementations that need database tables and real logic.

---

## Phase 1: Database Schema Updates

### 1.1 Create notification_preferences Table

**Status:** 🔴 BLOCKER - Required for notifications feature

**Migration SQL:**
```sql
-- Create notification_preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reallocation_confirms BOOLEAN DEFAULT true,
  cooling_off_reminders BOOLEAN DEFAULT true,
  savings_milestones BOOLEAN DEFAULT true,
  monthly_insights BOOLEAN DEFAULT false,
  tips_nudges BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Add RLS policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);
```

**Implementation Tasks:**
- [ ] Create migration file in Supabase
- [ ] Run migration in development environment
- [ ] Test in development environment
- [ ] Run migration in production environment

---

### 1.2 Create merchant_reports Table

**Status:** 🔴 BLOCKER - Required for merchant reporting feature

**Migration SQL:**
```sql
-- Create merchant_reports table
CREATE TABLE merchant_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_key TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('wrong_category', 'not_gambling', 'wrong_amount', 'unknown_payee')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  suggested_category TEXT
);

-- Create indexes for faster lookups
CREATE INDEX idx_merchant_reports_user_id ON merchant_reports(user_id);
CREATE INDEX idx_merchant_reports_status ON merchant_reports(status);
CREATE INDEX idx_merchant_reports_recipient_key ON merchant_reports(recipient_key);

-- Add RLS policies
ALTER TABLE merchant_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own merchant reports"
  ON merchant_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own merchant reports"
  ON merchant_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own merchant reports"
  ON merchant_reports FOR UPDATE
  USING (auth.uid() = user_id);
```

**Implementation Tasks:**
- [ ] Create migration file in Supabase
- [ ] Run migration in development environment
- [ ] Test in development environment
- [ ] Run migration in production environment

---

### 1.3 Optional Schema Enhancements

**Status:** 🟡 OPTIONAL - Can be done later

#### Add pocket_id to merchant_classifications
```sql
ALTER TABLE merchant_classifications
ADD COLUMN pocket_id UUID REFERENCES pockets(id) ON DELETE SET NULL;

CREATE INDEX idx_merchant_classifications_pocket_id ON merchant_classifications(pocket_id);
```

#### Add transaction type 'early_unlock'
```sql
ALTER TYPE transaction_type ADD VALUE 'early_unlock' AFTER 'rollover';
```

#### Add locked_at to pockets
```sql
ALTER TABLE pockets
ADD COLUMN locked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_pockets_locked_at ON pockets(locked_at);
```

#### Add status to fixed_expenses
```sql
ALTER TABLE fixed_expenses
ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived'));

CREATE INDEX idx_fixed_expenses_status ON fixed_expenses(status);
```

**Implementation Tasks:**
- [ ] Evaluate need for each enhancement
- [ ] Create migration for approved enhancements
- [ ] Test migrations
- [ ] Update TypeScript types

---

## Phase 2: Backend API Implementation

### 2.1 Implement Real Notifications API

**File:** `apps/api/src/modules/notifications/notifications.service.ts`

**Current State:** Stub implementation with hardcoded defaults

**Required Changes:**

1. **Update getPreferences method:**
```typescript
async getPreferences(userId: string): Promise<{
  preferences: {
    reallocation_confirms: boolean;
    cooling_off_reminders: boolean;
    savings_milestones: boolean;
    monthly_insights: boolean;
    tips_nudges: boolean;
  };
  user_id: string;
  updated_at: string | null;
  is_default?: boolean;
}> {
  // Try to get existing preferences
  const existing = await this.repository.getNotificationPreferencesByUserId(userId);
  
  if (existing) {
    return {
      preferences: {
        reallocation_confirms: existing.reallocation_confirms,
        cooling_off_reminders: existing.cooling_off_reminders,
        savings_milestones: existing.savings_milestones,
        monthly_insights: existing.monthly_insights,
        tips_nudges: existing.tips_nudges,
      },
      user_id: existing.user_id,
      updated_at: existing.updated_at,
    };
  }
  
  // Return default preferences if none exist
  return {
    preferences: {
      reallocation_confirms: true,
      cooling_off_reminders: true,
      savings_milestones: true,
      monthly_insights: false,
      tips_nudges: false,
    },
    user_id: userId,
    updated_at: null,
    is_default: true,
  };
}
```

2. **Update updatePreferences method:**
```typescript
async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<{
  preferences: {
    reallocation_confirms: boolean;
    cooling_off_reminders: boolean;
    savings_milestones: boolean;
    monthly_insights: boolean;
    tips_nudges: boolean;
  };
  user_id: string;
  updated_at: string;
}> {
  // Check if preferences exist
  const existing = await this.repository.getNotificationPreferencesByUserId(userId);
  
  if (existing) {
    // Update existing
    const updated = await this.repository.updateNotificationPreferences(userId, {
      ...dto,
      updated_at: new Date().toISOString(),
    });
    
    if (!updated) {
      throw new NotFoundException('Failed to update notification preferences');
    }
    
    return {
      preferences: {
        reallocation_confirms: updated.reallocation_confirms,
        cooling_off_reminders: updated.cooling_off_reminders,
        savings_milestones: updated.savings_milestones,
        monthly_insights: updated.monthly_insights,
        tips_nudges: updated.tips_nudges,
      },
      user_id: updated.user_id,
      updated_at: updated.updated_at,
    };
  }
  
  // Create new preferences
  const created = await this.repository.createNotificationPreferences({
    user_id: userId,
    ...dto,
    updated_at: new Date().toISOString(),
  });
  
  if (!created) {
    throw new BadRequestException('Failed to create notification preferences');
  }
  
  return {
    preferences: {
      reallocation_confirms: created.reallocation_confirms,
      cooling_off_reminders: created.cooling_off_reminders,
      savings_milestones: created.savings_milestones,
      monthly_insights: created.monthly_insights,
      tips_nudges: created.tips_nudges,
    },
    user_id: created.user_id,
    updated_at: created.updated_at,
  };
}
```

3. **Add repository methods** (`supabase.repository.ts`):
```typescript
async getNotificationPreferencesByUserId(userId: string): Promise<NotificationPreference | null> {
  const { data, error } = await this.supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async createNotificationPreferences(prefs: NotificationPreferenceInsert): Promise<NotificationPreference | null> {
  const { data, error } = await this.supabase
    .from('notification_preferences')
    .insert(prefs)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async updateNotificationPreferences(userId: string, updates: Partial<NotificationPreferenceInsert>): Promise<NotificationPreference | null> {
  const { data, error } = await this.supabase
    .from('notification_preferences')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

4. **Update TypeScript types** (`database.types.ts`):
```typescript
export type NotificationPreference = Database['public']['Tables']['notification_preferences']['Row'];
export type NotificationPreferenceInsert = Database['public']['Tables']['notification_preferences']['Insert'];
```

**Implementation Tasks:**
- [ ] Update database.types.ts with new types
- [ ] Add repository methods to supabase.repository.ts
- [ ] Update notifications.service.ts with real implementation
- [ ] Remove console.log statements
- [ ] Write unit tests
- [ ] Test with Supabase

---

### 2.2 Implement Real Merchant Reports API

**File:** `apps/api/src/modules/merchant-report/merchant-report.service.ts`

**Current State:** Stub implementation with empty array

**Required Changes:**

1. **Update createReport method:**
```typescript
async createReport(dto: ReportCreateDto, userId: string): Promise<{
  report: MerchantReportInsert;
  message: string;
}> {
  const report: MerchantReportInsert = {
    id: uuidv4(),
    user_id: userId,
    recipient_key: dto.recipient_key,
    report_type: dto.report_type,
    description: dto.description || null,
    status: 'pending',
    created_at: new Date().toISOString(),
    reviewed_at: null,
    suggested_category: dto.suggested_category || null,
  };

  const createdReport = await this.repository.createMerchantReport(report);
  if (!createdReport) {
    throw new Error('Failed to create merchant report');
  }

  return {
    report: createdReport,
    message: 'Thank you for your report. We will review it and improve our classification.',
  };
}
```

2. **Update getReports method:**
```typescript
async getReports(
  userId: string,
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<{
  reports: Array<{
    id: string;
    recipient_key: string;
    report_type: string;
    description: string | null;
    status: string;
    created_at: string;
    reviewed_at: string | null;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  let query = this.supabase
    .from('merchant_reports')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    reports: data || [],
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}
```

3. **Update repository methods** (`supabase.repository.ts`):
```typescript
async createMerchantReport(report: MerchantReportInsert): Promise<MerchantReport | null> {
  const { data, error } = await this.supabase
    .from('merchant_reports')
    .insert(report)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async getMerchantReportsByUserId(userId: string): Promise<MerchantReport[]> {
  const { data, error } = await this.supabase
    .from('merchant_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
```

4. **Update DTO** (`report-create.dto.ts`):
```typescript
import { IsString, IsEnum, IsOptional } from 'class-validator';

export class ReportCreateDto {
  @IsString()
  recipient_key: string;

  @IsEnum(['wrong_category', 'not_gambling', 'wrong_amount', 'unknown_payee'])
  report_type: 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  suggested_category?: string;
}
```

**Implementation Tasks:**
- [ ] Update DTO with suggested_category field
- [ ] Update repository methods in supabase.repository.ts
- [ ] Update merchant-report.service.ts with real implementation
- [ ] Remove stub methods
- [ ] Write unit tests
- [ ] Test with Supabase

---

### 2.3 Enhance Pocket Detail API

**File:** `apps/api/src/modules/pockets/pockets.service.ts`

**Current State:** Partial implementation, needs summary endpoint

**Required Changes:**

1. **Add getPocketSummary method:**
```typescript
async getPocketSummary(pocketId: string, userId: string): Promise<{
  pocket: Pocket;
  summary: {
    available: number;
    spent: number;
    remaining: number;
    percentage_remaining: number;
    monthly_allocation: number;
    days_remaining: number;
    daily_average_spend: number;
  };
  recent_activity: {
    last_transaction: string | null;
    transaction_count: number;
    reallocation_count: number;
  };
}> {
  const pocket = await this.repository.getPocketById(pocketId);
  if (!pocket) {
    throw new NotFoundException('Pocket not found');
  }
  await this.assertOwnership(pocket, userId);

  // Get transactions
  const transactions = await this.repository.getTransactionsByPocketId(pocketId);
  const spendTransactions = transactions.filter(t => t.type === 'spend');
  const spent = spendTransactions.reduce((sum, t) => sum + t.amount, 0);
  const available = (pocket.monthly_allocation || 0) - spent;
  const remaining = Math.max(0, available);
  const percentageRemaining = pocket.monthly_allocation > 0 
    ? (remaining / pocket.monthly_allocation) * 100 
    : 0;

  // Calculate days remaining in month
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = endOfMonth.getDate() - now.getDate();

  // Calculate daily average spend
  const daysInMonth = now.getDate();
  const dailyAverageSpend = daysInMonth > 0 ? spent / daysInMonth : 0;

  // Get recent activity
  const lastTransaction = spendTransactions.length > 0 
    ? spendTransactions[0].created_at 
    : null;
  const transactionCount = spendTransactions.length;
  const reallocationCount = transactions.filter(t => t.type === 'reallocation_in' || t.type === 'reallocation_out').length;

  return {
    pocket,
    summary: {
      available,
      spent,
      remaining,
      percentage_remaining: Math.round(percentageRemaining * 10) / 10,
      monthly_allocation: pocket.monthly_allocation || 0,
      days_remaining,
      daily_average_spend: Math.round(dailyAverageSpend * 100) / 100,
    },
    recent_activity: {
      last_transaction: lastTransaction,
      transaction_count: transactionCount,
      reallocation_count: reallocationCount,
    },
  };
}
```

2. **Add controller endpoint** (`pockets.controller.ts`):
```typescript
@Get(':id/summary')
@ApiOperation({ summary: 'Get pocket summary with spending analytics' })
@ApiResponse({ status: 200, description: 'Pocket summary' })
@ApiResponse({ status: 404, description: 'Pocket not found' })
@ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
getSummary(@Param('id') id: string, @Request() req: any) {
  return this.pocketsService.getPocketSummary(id, req.user.id);
}
```

3. **Add transactions pagination to repository:**
```typescript
async getTransactionsByPocketIdPaginated(
  pocketId: string, 
  page: number = 1, 
  limit: number = 20
): Promise<{ transactions: Transaction[]; total: number }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  const { data, error, count } = await this.supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('pocket_id', pocketId)
    .order('created_at', { ascending: false })
    .range(from, to);
  
  if (error) throw error;
  
  return {
    transactions: data || [],
    total: count || 0,
  };
}
```

**Implementation Tasks:**
- [ ] Add getPocketSummary method to pockets.service.ts
- [ ] Add getSummary endpoint to pockets.controller.ts
- [ ] Add paginated transactions method to repository
- [ ] Add getTransactionsPaginated endpoint to controller
- [ ] Write unit tests
- [ ] Test with real data

---

## Phase 3: Testing & Validation

### 3.1 Backend API Testing

**Test Cases for Notifications API:**
- [ ] Get preferences for user with no preferences (returns defaults)
- [ ] Get preferences for user with existing preferences
- [ ] Update preferences for existing user
- [ ] Create preferences for new user
- [ ] Invalid preference updates (validation)
- [ ] RLS policies (user can only access own preferences)

**Test Cases for Merchant Reports API:**
- [ ] Create merchant report
- [ ] Get reports for user
- [ ] Get reports with status filter
- [ ] Get reports with pagination
- [ ] Invalid report types (validation)
- [ ] RLS policies (user can only access own reports)

**Test Cases for Pocket Summary API:**
- [ ] Get summary for pocket with transactions
- [ ] Get summary for pocket with no transactions
- [ ] Get summary for non-existent pocket (404)
- [ ] Get summary for pocket user doesn't own (403)
- [ ] Calculate percentage correctly
- [ ] Calculate daily average correctly

### 3.2 Integration Testing

**Test Cases:**
- [ ] End-to-end flow: Create user → Set preferences → Verify
- [ ] End-to-end flow: Create report → Get reports → Update status
- [ ] End-to-end flow: Get pocket summary → Update → Verify changes
- [ ] Error handling: Invalid data, missing fields, unauthorized access
- [ ] Performance: Pagination with large datasets

---

## Phase 4: Documentation

### 4.1 API Documentation

**Update OpenAPI/Swagger Specs:**
- [ ] Add detailed request/response schemas
- [ ] Add example requests/responses
- [ ] Add error response examples
- [ ] Document all new endpoints
- [ ] Update existing endpoint documentation

### 4.2 Migration Documentation

**Create Migration Guide:**
- [ ] Document all database changes
- [ ] Provide rollback procedures
- [ ] Document RLS policies
- [ ] Document index strategies

---

## Timeline Estimate

**Phase 1: Database Schema Updates** - 2-3 days
- notification_preferences table: 1 day
- merchant_reports table: 1 day
- Optional enhancements: 1 day

**Phase 2: Backend API Implementation** - 3-4 days
- Notifications API: 1 day
- Merchant Reports API: 1 day
- Pocket Summary API: 1 day
- Testing: 1 day

**Phase 3: Testing & Validation** - 2 days
- Unit tests: 1 day
- Integration tests: 1 day

**Phase 4: Documentation** - 1 day
- API documentation: 0.5 day
- Migration documentation: 0.5 day

**Total Estimated Time:** 8-10 days

---

## Success Criteria

- [ ] All database migrations run successfully
- [ ] All API endpoints return 200 status with valid data
- [ ] All API endpoints handle errors appropriately
- [ ] All RLS policies prevent unauthorized access
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] API documentation is complete and accurate
- [ ] No console.log statements in production code
- [ ] TypeScript compilation succeeds
- [ ] No stub implementations remain

---

## Risks & Mitigations

**Risk 1:** Database migration failures
- **Mitigation:** Test migrations in development first, have rollback procedures ready

**Risk 2:** RLS policy misconfiguration
- **Mitigation:** Test with multiple users, verify isolation

**Risk 3:** Breaking changes to existing APIs
- **Mitigation:** Version APIs, maintain backward compatibility where possible

**Risk 4:** Performance issues with new tables
- **Mitigation:** Add appropriate indexes, test with large datasets

**Risk 5:** TypeScript type mismatches
- **Mitigation:** Regenerate types after schema changes, run strict type checking