// Database types generated from Supabase schema
// Simplified types to avoid complex generic issues

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          biometric_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          biometric_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          biometric_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          user_id: string
          // Segment discriminator (014_msme_segment.sql / ADR-001 D1).
          // Defaults to 'individual'; existing rows without it read as
          // individual.
          segment: 'individual' | 'msme'
          type: 'structured' | 'daily'
          income_pattern: 'salaried' | 'freelancer'
          income_interval_days: number | null
          expected_income_amount: number | null
          status: 'active' | 'inactive' | 'reassigned'
          money_personality: 'spender' | 'saver' | 'avoider'
          // Reserve logical layer (migration 013)
          reserve_balance: number
          monthly_planning_day: number
          last_planning_cycle_at: string | null
          created_at: string
          reassigned_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          segment?: 'individual' | 'msme'
          type: 'structured' | 'daily'
          income_pattern: 'salaried' | 'freelancer'
          income_interval_days?: number | null
          expected_income_amount?: number | null
          status?: 'active' | 'inactive' | 'reassigned'
          money_personality?: 'spender' | 'saver' | 'avoider'
          reserve_balance?: number
          monthly_planning_day?: number
          last_planning_cycle_at?: string | null
          created_at?: string
          reassigned_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          segment?: 'individual' | 'msme'
          type?: 'structured' | 'daily'
          income_pattern?: 'salaried' | 'freelancer'
          income_interval_days?: number | null
          expected_income_amount?: number | null
          status?: 'active' | 'inactive' | 'reassigned'
          money_personality?: 'spender' | 'saver' | 'avoider'
          reserve_balance?: number
          monthly_planning_day?: number
          last_planning_cycle_at?: string | null
          created_at?: string
          reassigned_at?: string | null
        }
        Relationships: []
      }
      pockets: {
        Row: {
          id: string
          plan_id: string
          name: string
          kind: 'savings' | 'fixed' | 'spendable' | 'loan'
          category: 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' | 'healthcare' | 'education' | 'housing' | 'family' | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent' | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment' | 'other' | null
          is_time_locked: boolean
          lock_until: string | null
          monthly_allocation: number
          daily_cap: number | null
          // Sub-pockets (audit_team.md item 10): null for a top-level pocket,
          // set for a sub-pocket nested under a parent. See
          // 007_sub_pockets.sql — depth is capped at one level, enforced in
          // pockets.service.ts, not here.
          parent_pocket_id: string | null
          // Source of truth for a sub-pocket's share of its parent
          // (010_sub_pocket_split_percentage.sql). Null for top-level
          // pockets. `monthly_allocation` above is kept in sync as a
          // derived cache — see pockets.service.ts.
          split_percentage: number | null
          // Loan-specific fields (audit_team.md item 9)
          repayment_schedule: Json | null
          loan_provider: string | null
          loan_purpose: string | null
          due_day: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          name: string
          kind: 'savings' | 'fixed' | 'spendable' | 'loan'
          category?: 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' | 'healthcare' | 'education' | 'housing' | 'family' | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent' | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment' | 'other' | null
          is_time_locked?: boolean
          lock_until?: string | null
          monthly_allocation: number
          daily_cap?: number | null
          parent_pocket_id?: string | null
          split_percentage?: number | null
          repayment_schedule?: Json | null
          loan_provider?: string | null
          loan_purpose?: string | null
          due_day?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          name?: string
          kind?: 'savings' | 'fixed' | 'spendable' | 'loan'
          category?: 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' | 'healthcare' | 'education' | 'housing' | 'family' | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent' | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment' | 'other' | null
          is_time_locked?: boolean
          lock_until?: string | null
          monthly_allocation?: number
          daily_cap?: number | null
          parent_pocket_id?: string | null
          split_percentage?: number | null
          repayment_schedule?: Json | null
          loan_provider?: string | null
          loan_purpose?: string | null
          due_day?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fixed_expenses: {
        Row: {
          id: string
          user_id: string
          name: string
          amount: number
          due_day: number
          category: 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' | 'healthcare' | 'education' | 'housing' | 'family' | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent' | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment' | 'other'
          status: 'active' | 'inactive'
          // Reserve obligation tracking (migration 013)
          funded_amount: number
          carry_forward: boolean
          funded_at: string | null
          notification_day_offset: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          amount: number
          due_day: number
          category: 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' | 'healthcare' | 'education' | 'housing' | 'family' | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent' | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment' | 'other'
          status?: 'active' | 'inactive'
          funded_amount?: number
          carry_forward?: boolean
          funded_at?: string | null
          notification_day_offset?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          amount?: number
          due_day?: number
          category?: 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' | 'healthcare' | 'education' | 'housing' | 'family' | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent' | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment' | 'other'
          status?: 'active' | 'inactive'
          funded_amount?: number
          carry_forward?: boolean
          funded_at?: string | null
          notification_day_offset?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_events: {
        Row: {
          id: string
          user_id: string
          amount: number
          source: string
          label: string | null
          date: string
          run_allocation: boolean
          unallocated_surplus: number | null
          surplus_allocation_status: 'pending' | 'allocated' | 'skipped' | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          source: string
          label?: string | null
          date: string
          run_allocation?: boolean
          unallocated_surplus?: number | null
          surplus_allocation_status?: 'pending' | 'allocated' | 'skipped' | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          source?: string
          label?: string | null
          date?: string
          run_allocation?: boolean
          unallocated_surplus?: number | null
          surplus_allocation_status?: 'pending' | 'allocated' | 'skipped' | null
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          pocket_id: string
          amount: number
          type: 'allocation' | 'spend' | 'reallocation_in' | 'reallocation_out' | 'rollover' | 'reserve_release' | 'reserve_return' | 'daily_overspend_debit' | 'fixed_expense_earmark' | 'fixed_expense_carry_forward'
          merchant: string | null
          category: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified' | null
          emergency_unlock_id: string | null
          daily_allocation_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pocket_id: string
          amount: number
          type: 'allocation' | 'spend' | 'reallocation_in' | 'reallocation_out' | 'rollover' | 'reserve_release' | 'reserve_return' | 'daily_overspend_debit' | 'fixed_expense_earmark' | 'fixed_expense_carry_forward'
          merchant?: string | null
          category?: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified' | null
          emergency_unlock_id?: string | null
          daily_allocation_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          pocket_id?: string
          amount?: number
          type?: 'allocation' | 'spend' | 'reallocation_in' | 'reallocation_out' | 'rollover' | 'reserve_release' | 'reserve_return' | 'daily_overspend_debit' | 'fixed_expense_earmark' | 'fixed_expense_carry_forward'
          merchant?: string | null
          category?: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified' | null
          emergency_unlock_id?: string | null
          daily_allocation_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reallocations: {
        Row: {
          id: string
          from_pocket_id: string
          to_pocket_id: string
          amount: number
          reason: 'emergency' | 'unexpected_expense' | 'income_change' | 'priority_shift' | 'other'
          status: 'pending' | 'cooling_off' | 'completed' | 'skipped'
          cooling_off_ends_at: string | null
          discipline_cost: number
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          from_pocket_id: string
          to_pocket_id: string
          amount: number
          reason: 'emergency' | 'unexpected_expense' | 'income_change' | 'priority_shift' | 'other'
          status?: 'pending' | 'cooling_off' | 'completed' | 'skipped'
          cooling_off_ends_at?: string | null
          discipline_cost?: number
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          from_pocket_id?: string
          to_pocket_id?: string
          amount?: number
          reason?: 'emergency' | 'unexpected_expense' | 'income_change' | 'priority_shift' | 'other'
          status?: 'pending' | 'cooling_off' | 'completed' | 'skipped'
          cooling_off_ends_at?: string | null
          discipline_cost?: number
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      merchant_classifications: {
        Row: {
          id: string
          user_id: string
          recipient_key: string
          category: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified'
          pocket_id: string | null
          remember: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recipient_key: string
          category: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified'
          pocket_id?: string | null
          remember?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recipient_key?: string
          category?: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified'
          pocket_id?: string | null
          remember?: boolean
          created_at?: string
        }
        Relationships: []
      }
      behavior_events: {
        Row: {
          id: string
          user_id: string
          type: string
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      emergency_unlocks: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          amount: number
          days_calculated: number
          least_daily_spend: number
          average_daily_spend: number
          reserve_kept: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          amount: number
          days_calculated: number
          least_daily_spend: number
          average_daily_spend: number
          reserve_kept: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          amount?: number
          days_calculated?: number
          least_daily_spend?: number
          average_daily_spend?: number
          reserve_kept?: number
          created_at?: string
        }
        Relationships: []
      }
      discipline_scores: {
        Row: {
          id: string
          user_id: string
          score: number
          delta: number
          period: string
          calculated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          score: number
          delta?: number
          period: string
          calculated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          score?: number
          delta?: number
          period?: string
          calculated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Simple type aliases for convenience
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Plan = Database['public']['Tables']['plans']['Row'];
export type PlanInsert = Database['public']['Tables']['plans']['Insert'];
export type PlanUpdate = Database['public']['Tables']['plans']['Update'];

export type Pocket = Database['public']['Tables']['pockets']['Row'];
export type PocketInsert = Database['public']['Tables']['pockets']['Insert'];
export type PocketUpdate = Database['public']['Tables']['pockets']['Update'];

export type FixedExpense = Database['public']['Tables']['fixed_expenses']['Row'];
export type FixedExpenseInsert = Database['public']['Tables']['fixed_expenses']['Insert'];
export type FixedExpenseUpdate = Database['public']['Tables']['fixed_expenses']['Update'];

export type IncomeEvent = Database['public']['Tables']['income_events']['Row'];
export type IncomeEventInsert = Database['public']['Tables']['income_events']['Insert'];

export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];

export type Reallocation = Database['public']['Tables']['reallocations']['Row'];
export type ReallocationInsert = Database['public']['Tables']['reallocations']['Insert'];
export type ReallocationUpdate = Database['public']['Tables']['reallocations']['Update'];

export type MerchantClassification = Database['public']['Tables']['merchant_classifications']['Row'];
export type MerchantClassificationInsert = Database['public']['Tables']['merchant_classifications']['Insert'];

export type BehaviorEvent = Database['public']['Tables']['behavior_events']['Row'];
export type BehaviorEventInsert = Database['public']['Tables']['behavior_events']['Insert'];

export type DisciplineScore = Database['public']['Tables']['discipline_scores']['Row'];
export type DisciplineScoreInsert = Database['public']['Tables']['discipline_scores']['Insert'];

// Merchant Reports (for report merchant feature)
export interface MerchantReport {
  id: string;
  user_id: string;
  recipient_key: string;
  report_type: 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee';
  description: string | null;
  suggested_category: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified' | null;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  reviewed_at: string | null;
}


export interface MerchantReportInsert {
  id?: string;
  user_id: string;
  recipient_key: string;
  report_type: 'wrong_category' | 'not_gambling' | 'wrong_amount' | 'unknown_payee';
  description?: string | null;
  suggested_category?: 'grocery' | 'landlord_rent' | 'utility' | 'transport' | 'healthcare' | 'education' | 'entertainment' | 'gambling_betting' | 'personal_care' | 'other' | 'unclassified' | null;
  status?: 'pending' | 'reviewed' | 'resolved';
  created_at?: string;
  reviewed_at?: string | null;
}

// Notification Preferences (per-user notification settings)
export interface NotificationPreferences {
  id: string;
  user_id: string;
  reallocation_confirms: boolean;
  cooling_off_reminders: boolean;
  savings_milestones: boolean;
  monthly_insights: boolean;
  tips_nudges: boolean;
  loan_reminders: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesInsert {
  id?: string;
  user_id: string;
  reallocation_confirms?: boolean;
  cooling_off_reminders?: boolean;
  savings_milestones?: boolean;
  monthly_insights?: boolean;
  tips_nudges?: boolean;
  loan_reminders?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationPreferencesUpdate {
  reallocation_confirms?: boolean;
  cooling_off_reminders?: boolean;
  savings_milestones?: boolean;
  monthly_insights?: boolean;
  tips_nudges?: boolean;
  loan_reminders?: boolean;
  updated_at?: string;
}

// Expo push device tokens (Batch 7)
export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PushTokenInsert {
  id?: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  device_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationDelivery {
  id: string;
  user_id: string;
  kind: string;
  dedupe_key: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown>;
  sent_at: string;
}

export interface NotificationDeliveryInsert {
  id?: string;
  user_id: string;
  kind: string;
  dedupe_key: string;
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
  sent_at?: string;
}

export type IdempotencyScope = 'income' | 'spend' | 'loan_reminder';

export interface IdempotencyRecord {
  id: string;
  user_id: string;
  scope: IdempotencyScope;
  idempotency_key: string;
  resource_id: string | null;
  response: Record<string, unknown>;
  created_at: string;
}

export interface IdempotencyRecordInsert {
  id?: string;
  user_id: string;
  scope: IdempotencyScope;
  idempotency_key: string;
  resource_id?: string | null;
  response?: Record<string, unknown>;
  created_at?: string;
}

// Emergency unlocks (savings emergency withdrawals with once-per-month limit)
export interface EmergencyUnlock {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  days_calculated: number;
  least_daily_spend: number;
  average_daily_spend: number;
  reserve_kept: number;
  created_at: string;
}

export interface EmergencyUnlockInsert {
  id?: string;
  user_id: string;
  plan_id: string;
  amount: number;
  days_calculated: number;
  least_daily_spend: number;
  average_daily_spend: number;
  reserve_kept: number;
  created_at?: string;
}

export type EmergencyUnlockRow = Database['public']['Tables']['emergency_unlocks']['Row'];
export type EmergencyUnlockRowInsert = Database['public']['Tables']['emergency_unlocks']['Insert'];