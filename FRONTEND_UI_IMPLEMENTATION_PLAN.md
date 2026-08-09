# Financial Hub - Frontend UI Implementation Plan

## Overview

This plan outlines the steps to make all frontend screens fully functional by connecting them to real backend APIs, removing mock data, and implementing proper error handling and loading states.

---

## Phase 1: API Service Layer Setup

### 1.1 Create API Service Infrastructure

**Status:** 🔴 BLOCKER - Required for all API integrations

**Directory Structure:**
```
apps/mobile/src/services/
├── api/
│   ├── client.ts          # HTTP client configuration
│   ├── pockets.service.ts # Pocket-related API calls
│   ├── income.service.ts  # Income-related API calls
│   ├── merchant.service.ts # Merchant-related API calls
│   ├── notifications.service.ts # Notifications API calls
│   ├── profile.service.ts # Profile/fixed expenses API calls
│   └── index.ts           # Export all services
├── types/
│   ├── api.types.ts       # API response types
│   └── index.ts
└── hooks/
    ├── useApi.ts          # Custom hook for API calls
    └── index.ts
```

---

### 1.2 Create HTTP Client

**File:** `apps/mobile/src/services/api/client.ts`

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          // This could trigger a logout action
        }
        return Promise.reject(error);
      }
    );
  }

  public get<T = any>(url: string, params?: any) {
    return this.client.get<T>(url, { params });
  }

  public post<T = any>(url: string, data?: any) {
    return this.client.post<T>(url, data);
  }

  public put<T = any>(url: string, data?: any) {
    return this.client.put<T>(url, data);
  }

  public delete<T = any>(url: string) {
    return this.client.delete<T>(url);
  }
}

export const apiClient = new ApiClient();
```

---

### 1.3 Create API Types

**File:** `apps/mobile/src/services/types/api.types.ts`

```typescript
// Pocket Types
export interface Pocket {
  id: string;
  name: string;
  kind: 'savings' | 'fixed' | 'spendable';
  category: string | null;
  monthly_allocation: number;
  daily_cap: number | null;
  is_time_locked: boolean;
  lock_until: string | null;
}

export interface PocketSummary {
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
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'allocation' | 'spend' | 'reallocation_in' | 'reallocation_out' | 'rollover';
  merchant: string | null;
  category: string | null;
  created_at: string;
}

// Merchant Types
export interface MerchantClassification {
  id: string;
  recipient_key: string;
  category: string;
  pocket_id: string | null;
  pocket_name: string;
  remember: boolean;
  usage_count: number;
  last_used: string;
  created_at: string;
}

export interface ClassificationResponse {
  classification: MerchantClassification;
  transaction_updated?: { id: string; category: string };
}

// Notification Types
export interface NotificationPreferences {
  reallocation_confirms: boolean;
  cooling_off_reminders: boolean;
  savings_milestones: boolean;
  monthly_insights: boolean;
  tips_nudges: boolean;
}

// Fixed Expense Types
export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  user_id: string;
  created_at: string;
}

// Lock Status Types
export interface LockStatus {
  pocket_id: string;
  pocket_name: string;
  is_locked: boolean;
  lock_status: {
    locked_until: string | null;
    locked_at: string | null;
    total_lock_days: number;
    days_remaining: number;
    days_elapsed: number;
    percentage_complete: number;
  } | null;
  protected_amount: number;
  early_unlock_cost: number;
  can_unlock: boolean;
}
```

---

### 1.4 Create Pockets Service

**File:** `apps/mobile/src/services/api/pockets.service.ts`

```typescript
import { apiClient } from './client';
import { PocketSummary, Transaction, LockStatus } from '../types/api.types';

export class PocketsService {
  async getSummary(pocketId: string): Promise<PocketSummary> {
    const response = await apiClient.get<PocketSummary>(`/pockets/${pocketId}/summary`);
    return response.data;
  }

  async getTransactions(pocketId: string, page: number = 1, limit: number = 20): Promise<{
    transactions: Transaction[];
    total: number;
  }> {
    const response = await apiClient.get(`/pockets/${pocketId}/transactions`, {
      page,
      limit,
    });
    return response.data;
  }

  async getLockStatus(pocketId: string): Promise<LockStatus> {
    const response = await apiClient.get<LockStatus>(`/pockets/${pocketId}/lock-status`);
    return response.data;
  }

  async unlock(pocketId: string, data: { reason?: string; biometric_confirmed: boolean }): Promise<any> {
    const response = await apiClient.post(`/pockets/${pocketId}/unlock`, data);
    return response.data;
  }

  async extendLock(pocketId: string, data: { additional_days: number; reason?: string }): Promise<any> {
    const response = await apiClient.post(`/pockets/${pocketId}/extend-lock`, data);
    return response.data;
  }
}

export const pocketsService = new PocketsService();
```

---

### 1.5 Create Merchant Service

**File:** `apps/mobile/src/services/api/merchant.service.ts`

```typescript
import { apiClient } from './client';
import { ClassificationResponse, MerchantClassification } from '../types/api.types';

export class MerchantService {
  async classify(data: {
    recipient_key: string;
    category: string;
    pocket_id: string;
    remember: boolean;
    transaction_id?: string;
    amount?: number;
  }): Promise<ClassificationResponse> {
    const response = await apiClient.post<ClassificationResponse>('/merchant/classify', data);
    return response.data;
  }

  async getClassifications(userId: string, page: number = 1, limit: number = 50, search?: string): Promise<{
    classifications: MerchantClassification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await apiClient.get('/merchant/classifications', {
      userId,
      page,
      limit,
      search,
    });
    return response.data;
  }

  async deleteClassification(id: string): Promise<void> {
    await apiClient.delete(`/merchant/classifications/${id}`);
  }

  async createReport(data: {
    recipient_key: string;
    report_type: string;
    description?: string;
    suggested_category?: string;
  }): Promise<any> {
    const response = await apiClient.post('/merchant/report', data);
    return response.data;
  }

  async getReports(userId: string, page: number = 1, limit: number = 20, status?: string): Promise<any> {
    const response = await apiClient.get('/merchant/reports', {
      userId,
      page,
      limit,
      status,
    });
    return response.data;
  }
}

export const merchantService = new MerchantService();
```

---

### 1.6 Create Notifications Service

**File:** `apps/mobile/src/services/api/notifications.service.ts`

```typescript
import { apiClient } from './client';
import { NotificationPreferences } from '../types/api.types';

export class NotificationsService {
  async getPreferences(): Promise<{
    preferences: NotificationPreferences;
    user_id: string;
    updated_at: string | null;
  }> {
    const response = await apiClient.get('/notifications/settings');
    return response.data;
  }

  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<{
    preferences: NotificationPreferences;
    user_id: string;
    updated_at: string;
  }> {
    const response = await apiClient.put('/notifications/settings', preferences);
    return response.data;
  }
}

export const notificationsService = new NotificationsService();
```

---

### 1.7 Create Profile Service

**File:** `apps/mobile/src/services/api/profile.service.ts`

```typescript
import { apiClient } from './client';
import { FixedExpense } from '../types/api.types';

export class ProfileService {
  async getFixedExpenses(): Promise<FixedExpense[]> {
    const response = await apiClient.get<FixedExpense[]>('/profile/fixed-expenses');
    return response.data;
  }

  async createFixedExpense(data: {
    name: string;
    amount: number;
    dueDay: number;
    category: string;
  }): Promise<FixedExpense> {
    const response = await apiClient.post<FixedExpense>('/profile/fixed-expenses', data);
    return response.data;
  }

  async updateFixedExpense(id: string, data: {
    name?: string;
    amount?: number;
    dueDay?: number;
    category?: string;
  }): Promise<FixedExpense> {
    const response = await apiClient.put<FixedExpense>(`/profile/fixed-expenses/${id}`, data);
    return response.data;
  }

  async deleteFixedExpense(id: string): Promise<void> {
    await apiClient.delete(`/profile/fixed-expenses/${id}`);
  }

  async getFixedExpenseSuggestions(): Promise<{
    suggestions: Array<{
      name: string;
      category: string;
      suggested_amount: number;
      suggested_due_day: number;
      description: string;
    }>;
    total_monthly_suggestion: number;
  }> {
    const response = await apiClient.get('/profile/fixed-expenses/suggestions');
    return response.data;
  }

  async bulkCreateFixedExpenses(expenses: Array<{
    name: string;
    amount: number;
    dueDay: number;
    category: string;
  }>): Promise<{
    created: FixedExpense[];
    failed: Array<{ index: number; error: string }>;
    total_monthly: number;
  }> {
    const response = await apiClient.post('/profile/fixed-expenses/bulk', expenses);
    return response.data;
  }
}

export const profileService = new ProfileService();
```

---

### 1.8 Create Custom Hook

**File:** `apps/mobile/src/services/hooks/useApi.ts`

```typescript
import { useState, useEffect } from 'react';

export function useApi<T>(
  apiFunction: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiFunction();
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return { data, loading, error, refetch: () => fetchData() };
}
```

---

### 1.9 Export All Services

**File:** `apps/mobile/src/services/api/index.ts`

```typescript
export { apiClient } from './client';
export { pocketsService } from './pockets.service';
export { merchantService } from './merchant.service';
export { notificationsService } from './notifications.service';
export { profileService } from './profile.service';
```

**File:** `apps/mobile/src/services/types/index.ts`

```typescript
export * from './api.types';
```

**File:** `apps/mobile/src/services/hooks/index.ts`

```typescript
export { useApi } from './useApi';
```

**File:** `apps/mobile/src/services/index.ts`

```typescript
export * from './api';
export * from './types';
export * from './hooks';
```

---

## Phase 2: Screen Integration

### 2.1 Integrate Pocket Detail Screen

**File:** `apps/mobile/app/(pockets)/detail.tsx`

**Changes Required:**

1. **Import services:**
```typescript
import { pocketsService, useApi } from '@/services';
```

2. **Replace mock data loading:**
```typescript
const loadPocketData = async () => {
  try {
    setIsLoading(true);
    const [summary, txsData] = await Promise.all([
      pocketsService.getSummary(id),
      pocketsService.getTransactions(id, page),
    ]);
    
    setPocketSummary(summary);
    setTransactions(txsData.transactions);
    setHasMore(txsData.transactions.length < txsData.total);
  } catch (error) {
    console.error('Error loading pocket data:', error);
    Alert.alert('Error', 'Failed to load pocket data. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

3. **Remove mock data section** (lines 77-122)

4. **Add error handling for failed loads**

**Implementation Tasks:**
- [ ] Import services
- [ ] Replace loadPocketData with real API calls
- [ ] Remove mock data
- [ ] Add error alerts
- [ ] Test with real data
- [ ] Test error scenarios

---

### 2.2 Integrate Merchant Classification Screen

**File:** `apps/mobile/app/(classification)/classify.tsx`

**Changes Required:**

1. **Import services:**
```typescript
import { merchantService, pocketsService, useApi } from '@/services';
```

2. **Load pockets from API:**
```typescript
const { data: pockets, loading: pocketsLoading } = useApi(
  () => pocketsService.getPockets(), // Need to add this endpoint or use existing
  []
);
```

3. **Replace handleSubmit:**
```typescript
const handleSubmit = async () => {
  if (!selectedCategory || !selectedPocket) {
    Alert.alert('Missing Information', 'Please select both a category and a pocket.');
    return;
  }

  try {
    setIsLoading(true);
    await merchantService.classify({
      recipient_key: recipientKey,
      category: selectedCategory,
      pocket_id: selectedPocket,
      remember,
      transaction_id: transactionId,
      amount: amount ? parseFloat(amount) : undefined,
    });

    Alert.alert('Success', 'Classification saved successfully!', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  } catch (error) {
    Alert.alert('Error', 'Failed to save classification. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

4. **Remove hardcoded pockets array** (lines 40-45)

5. **Remove TODO comment** (lines 55-63)

**Implementation Tasks:**
- [ ] Import services
- [ ] Load pockets from API
- [ ] Replace handleSubmit with real API call
- [ ] Remove hardcoded pockets
- [ ] Add loading state for pockets
- [ ] Test with real data
- [ ] Test error scenarios

---

### 2.3 Integrate Report Merchant Screen

**File:** `apps/mobile/app/(merchant)/report.tsx`

**Changes Required:**

1. **Import services:**
```typescript
import { merchantService } from '@/services';
```

2. **Replace handleSubmit:**
```typescript
const handleSubmit = async () => {
  if (!selectedReportType) {
    Alert.alert('Missing Information', 'Please select a report type.');
    return;
  }

  try {
    setIsLoading(true);
    await merchantService.createReport({
      recipient_key: recipientKey,
      report_type: selectedReportType,
      description,
      suggested_category: suggestedCategory || undefined,
    });

    Alert.alert('Report Submitted', 'Thank you for your report. We will review it and improve our classification.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  } catch (error) {
    Alert.alert('Error', 'Failed to submit report. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

3. **Remove TODO comment** (lines 55-63)

**Implementation Tasks:**
- [ ] Import services
- [ ] Replace handleSubmit with real API call
- [ ] Remove TODO comment
- [ ] Test with real data
- [ ] Test error scenarios

---

### 2.4 Integrate Time-Lock Screen

**File:** `apps/mobile/app/(security)/time-lock.tsx`

**Changes Required:**

1. **Import services:**
```typescript
import { pocketsService } from '@/services';
```

2. **Replace loadLockStatus:**
```typescript
const loadLockStatus = async () => {
  try {
    setIsLoading(true);
    const status = await pocketsService.getLockStatus(pocketId);
    setLockStatus(status);
  } catch (error) {
    console.error('Error loading lock status:', error);
    Alert.alert('Error', 'Failed to load lock status. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

3. **Replace handleUnlock:**
```typescript
const handleUnlock = async () => {
  if (!lockStatus?.can_unlock) {
    Alert.alert('Cannot Unlock', 'This pocket is not currently locked.');
    return;
  }

  Alert.alert(
    'Early Unlock Required',
    `Unlocking will cost ${lockStatus.early_unlock_cost} discipline points. Your score will decrease from 85 to 75.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlock with Biometric',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsUnlocking(true);
            // TODO: Add biometric confirmation here
            await pocketsService.unlock(pocketId, { reason, biometric_confirmed: true });
            
            Alert.alert('Unlocked Successfully', 'Your pocket has been unlocked early.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (error) {
            Alert.alert('Error', 'Failed to unlock pocket. Please try again.');
          } finally {
            setIsUnlocking(false);
          }
        },
      },
    ]
  );
};
```

4. **Replace handleExtendLock:**
```typescript
const handleExtendLock = async () => {
  Alert.alert(
    'Extend Lock Period',
    'Extending your lock will earn you discipline bonus points for better security.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Extend 30 Days',
        onPress: async () => {
          try {
            await pocketsService.extendLock(pocketId, { additional_days: 30, reason: 'Building emergency fund' });
            
            Alert.alert('Lock Extended', 'Your lock has been extended by 30 days.');
            loadLockStatus();
          } catch (error) {
            Alert.alert('Error', 'Failed to extend lock. Please try again.');
          }
        },
      },
    ]
  );
};
```

5. **Remove mock data** (lines 40-55)
6. **Remove TODO comments** (lines 80-81, 107-108)

**Implementation Tasks:**
- [ ] Import services
- [ ] Replace loadLockStatus with real API call
- [ ] Replace handleUnlock with real API call
- [ ] Replace handleExtendLock with real API call
- [ ] Remove mock data
- [ ] Remove TODO comments
- [ ] Test with real data
- [ ] Test error scenarios

---

### 2.5 Integrate Notifications Settings Screen

**File:** `apps/mobile/app/(settings)/notifications.tsx`

**Changes Required:**

1. **Import services:**
```typescript
import { notificationsService } from '@/services';
```

2. **Replace loadPreferences:**
```typescript
const loadPreferences = async () => {
  try {
    setIsLoading(true);
    const data = await notificationsService.getPreferences();
    setPreferences(data.preferences);
  } catch (error) {
    console.error('Error loading preferences:', error);
    Alert.alert('Error', 'Failed to load notification preferences. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

3. **Replace updatePreference:**
```typescript
const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
  if (!preferences) return;

  try {
    setIsUpdating(true);
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);

    await notificationsService.updatePreferences({ [key]: value });
  } catch (error) {
    console.error('Error updating preference:', error);
    // Revert on error
    setPreferences(preferences);
    Alert.alert('Error', 'Failed to update preference. Please try again.');
  } finally {
    setIsUpdating(false);
  }
};
```

4. **Remove mock data** (lines 40-46)
5. **Remove TODO comments** (lines 36-37, 62-63)

**Implementation Tasks:**
- [ ] Import services
- [ ] Replace loadPreferences with real API call
- [ ] Replace updatePreference with real API call
- [ ] Remove mock data
- [ ] Remove TODO comments
- [ ] Test with real data
- [ ] Test error scenarios

---

### 2.6 Integrate Fixed Expenses Screen

**File:** `apps/mobile/app/(profile)/fixed-expenses.tsx`

**Changes Required:**

1. **Import services:**
```typescript
import { profileService } from '@/services';
```

2. **Replace loadExpenses:**
```typescript
const loadExpenses = async () => {
  try {
    setIsLoading(true);
    const data = await profileService.getFixedExpenses();
    setExpenses(data);
  } catch (error) {
    console.error('Error loading expenses:', error);
    Alert.alert('Error', 'Failed to load fixed expenses. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

3. **Replace handleAddExpense:**
```typescript
const handleAddExpense = async () => {
  if (!name || !amount || !dueDay || !category) {
    Alert.alert('Missing Information', 'Please fill in all fields.');
    return;
  }

  try {
    const newExpense = await profileService.createFixedExpense({
      name,
      amount: parseFloat(amount),
      dueDay: parseInt(dueDay),
      category,
    });

    setExpenses([...expenses, newExpense]);
    setShowAddModal(false);
    resetForm();
    Alert.alert('Success', 'Fixed expense added successfully.');
  } catch (error) {
    Alert.alert('Error', 'Failed to add expense. Please try again.');
  }
};
```

4. **Replace handleUpdateExpense:**
```typescript
const handleUpdateExpense = async () => {
  if (!editingExpense || !name || !amount || !dueDay || !category) {
    return;
  }

  try {
    const updatedExpense = await profileService.updateFixedExpense(editingExpense.id, {
      name,
      amount: parseFloat(amount),
      dueDay: parseInt(dueDay),
      category,
    });

    setExpenses(
      expenses.map((exp) =>
        exp.id === editingExpense.id ? updatedExpense : exp
      )
    );

    setShowEditModal(false);
    setEditingExpense(null);
    resetForm();
    Alert.alert('Success', 'Fixed expense updated successfully.');
  } catch (error) {
    Alert.alert('Error', 'Failed to update expense. Please try again.');
  }
};
```

5. **Replace handleDeleteExpense:**
```typescript
const handleDeleteExpense = async (expense: FixedExpense) => {
  Alert.alert(
    'Delete Fixed Expense',
    `Are you sure you want to delete "${expense.name}"?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await profileService.deleteFixedExpense(expense.id);
            setExpenses(expenses.filter((exp) => exp.id !== expense.id));
            Alert.alert('Deleted', 'Fixed expense deleted successfully.');
          } catch (error) {
            Alert.alert('Error', 'Failed to delete expense. Please try again.');
          }
        },
      },
    ]
  );
};
```

6. **Remove mock data** (lines 72-91)
7. **Remove TODO comments** (lines 68-69, 106-112, 141-147, 183-184)

**Implementation Tasks:**
- [ ] Import services
- [ ] Replace loadExpenses with real API call
- [ ] Replace handleAddExpense with real API call
- [ ] Replace handleUpdateExpense with real API call
- [ ] Replace handleDeleteExpense with real API call
- [ ] Remove mock data
- [ ] Remove TODO comments
- [ ] Test with real data
- [ ] Test error scenarios

---

## Phase 3: Error Handling & Loading States

### 3.1 Create Error Component

**File:** `apps/mobile/src/components/ui/ErrorState.tsx`

```typescript
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { spacing, typography } from '../../theme';
import { useTheme } from '@/theme/ThemeContext';
import { RefreshCw } from 'lucide-react-native';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();

  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: spacing.xl 
    }}>
      <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry && (
        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: 8,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.line,
          }}
          onPress={onRetry}
        >
          <RefreshCw size={16} color={colors.ink} />
          <Text style={{ ...typography.caption, color: colors.ink, marginLeft: spacing.sm }}>
            Retry
          </Text>
        </Pressable>
      )}
    </View>
  );
}
```

---

### 3.2 Create Loading Component

**File:** `apps/mobile/src/components/ui/LoadingState.tsx`

```typescript
import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { spacing, typography } from '../../theme';
import { useTheme } from '@/theme/ThemeContext';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const { colors } = useTheme();

  return (
    <View style={{ 
      flex: 1, 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: spacing.xl 
    }}>
      <ActivityIndicator size="large" color={colors.emeraldDeep} />
      {message && (
        <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md }}>
          {message}
        </Text>
      )}
    </View>
  );
}
```

---

### 3.3 Add to All Screens

**Implementation Tasks:**
- [ ] Add ErrorState component to all screens
- [ ] Add LoadingState component to all screens
- [ ] Replace manual loading indicators with LoadingState
- [ ] Replace error alerts with ErrorState where appropriate
- [ ] Test error scenarios across all screens

---

## Phase 4: Testing & Validation

### 4.1 Screen Testing

**Test Cases for Pocket Detail Screen:**
- [ ] Load with valid pocket ID
- [ ] Load with invalid pocket ID (404)
- [ ] Load with unauthorized pocket (403)
- [ ] Refresh on pull-to-refresh
- [ ] Load more transactions pagination
- [ ] Handle network errors
- [ ] Handle loading states

**Test Cases for Classification Screen:**
- [ ] Load pockets successfully
- [ ] Submit classification successfully
- [ ] Handle missing fields validation
- [ ] Handle API errors
- [ ] Navigate to report screen
- [ ] Test remember toggle

**Test Cases for Report Merchant Screen:**
- [ ] Submit report successfully
- [ ] Handle missing report type
- [ ] Handle API errors
- [ ] Test description field
- [ ] Test suggested category field

**Test Cases for Time-Lock Screen:**
- [ ] Load lock status successfully
- [ ] Unlock with biometric
- [ ] Extend lock successfully
- [ ] Handle not locked state
- [ ] Handle API errors
- [ ] Calculate discipline cost correctly

**Test Cases for Notifications Screen:**
- [ ] Load preferences successfully
- [ ] Update preferences successfully
- [ ] Toggle individual preferences
- [ ] Handle API errors
- [ ] Test default preferences

**Test Cases for Fixed Expenses Screen:**
- [ ] Load expenses successfully
- [ ] Add expense successfully
- [ ] Update expense successfully
- [ ] Delete expense successfully
- [ ] Use quick suggestions
- [ ] Handle validation errors
- [ ] Handle API errors

---

### 4.2 Integration Testing

**Test Cases:**
- [ ] End-to-end: Pocket detail → Add money → Verify
- [ ] End-to-end: Classify merchant → Verify classification
- [ ] End-to-end: Report merchant → Verify report created
- [ ] End-to-end: Time-lock unlock → Verify unlocked
- [ ] End-to-end: Update notifications → Verify saved
- [ ] End-to-end: Add fixed expense → Verify created
- [ ] Test offline scenarios
- [ ] Test slow network scenarios

---

## Phase 5: Cleanup

### 5.1 Remove Mock Data

**Files to Clean:**
- [ ] `apps/mobile/app/(pockets)/detail.tsx` - Remove lines 77-122
- [ ] `apps/mobile/app/(classification)/classify.tsx` - Remove lines 40-45
- [ ] `apps/mobile/app/(security)/time-lock.tsx` - Remove lines 40-55
- [ ] `apps/mobile/app/(settings)/notifications.tsx` - Remove lines 40-46
- [ ] `apps/mobile/app/(profile)/fixed-expenses.tsx` - Remove lines 72-91

### 5.2 Remove TODO Comments

**Files to Clean:**
- [ ] All screen files - Remove TODO comments related to API integration

### 5.3 Code Quality

**Tasks:**
- [ ] Run TypeScript type checking
- [ ] Run ESLint
- [ ] Format code with Prettier
- [ ] Remove console.log statements
- [ ] Add missing JSDoc comments
- [ ] Review and optimize imports

---

## Timeline Estimate

**Phase 1: API Service Layer Setup** - 2-3 days
- HTTP client and types: 0.5 day
- Service implementations: 1 day
- Custom hooks: 0.5 day
- Testing: 0.5 day

**Phase 2: Screen Integration** - 3-4 days
- Pocket detail: 0.5 day
- Classification: 0.5 day
- Report merchant: 0.5 day
- Time-lock: 0.5 day
- Notifications: 0.5 day
- Fixed expenses: 0.5 day
- Testing: 0.5 day

**Phase 3: Error Handling & Loading States** - 1 day
- Create components: 0.5 day
- Add to screens: 0.5 day

**Phase 4: Testing & Validation** - 2 days
- Screen testing: 1 day
- Integration testing: 1 day

**Phase 5: Cleanup** - 1 day
- Remove mock data: 0.5 day
- Code quality: 0.5 day

**Total Estimated Time:** 9-11 days

---

## Success Criteria

- [ ] All screens load real data from APIs
- [ ] All mock data removed
- [ ] All TODO comments removed
- [ ] Error handling implemented for all screens
- [ ] Loading states implemented for all screens
- [ ] TypeScript compilation succeeds
- [ ] No console.log statements in production code
- [ ] All screens pass testing
- [ ] Integration tests pass
- [ ] Code follows project conventions

---

## Risks & Mitigations

**Risk 1:** API endpoint changes during development
- **Mitigation:** Keep API versioning, document breaking changes

**Risk 2:** Network issues affecting user experience
- **Mitigation:** Implement retry logic, cache data locally

**Risk 3:** Authentication token expiration
- **Mitigation:** Implement token refresh logic, handle 401 errors

**Risk 4:** Performance issues with large datasets
- **Mitigation:** Implement pagination, lazy loading

**Risk 5:** TypeScript type mismatches with backend
- **Mitigation:** Regenerate types after backend changes, use strict type checking