import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import {
  User, UserInsert, UserUpdate,
  Plan, PlanInsert, PlanUpdate,
  Pocket, PocketInsert, PocketUpdate,
  FixedExpense, FixedExpenseInsert, FixedExpenseUpdate,
  IncomeEvent, IncomeEventInsert,
  Transaction, TransactionInsert,
  Reallocation, ReallocationInsert, ReallocationUpdate,
  MerchantClassification, MerchantClassificationInsert,
  BehaviorEvent, BehaviorEventInsert,
  DisciplineScore, DisciplineScoreInsert,
} from '../database/database.types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PostgREST `or()` takes a raw filter string, so any interpolated value must
// be proven safe before it goes in — a value containing `,` or `)` would
// otherwise rewrite the filter expression.
function assertUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

@Injectable()
export class SupabaseRepository {
  private supabase = getSupabaseClient();

  // Users
  async createUser(user: UserInsert): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .insert(user)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateUser(id: string, updates: UserUpdate): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Plans
  async createPlan(plan: PlanInsert): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from('plans')
      .insert(plan)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getActivePlanByUserId(userId: string): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getPlanById(id: string): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updatePlan(id: string, updates: PlanUpdate): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from('plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deactivateUserPlans(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('plans')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;
  }

  // Pockets
  async createPockets(pockets: PocketInsert[]): Promise<Pocket[]> {
    const { data, error } = await this.supabase
      .from('pockets')
      .insert(pockets)
      .select();
    if (error) throw error;
    return data || [];
  }

  async getPocketsByPlanId(planId: string): Promise<Pocket[]> {
    const { data, error } = await this.supabase
      .from('pockets')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getPocketById(id: string): Promise<Pocket | null> {
    const { data, error } = await this.supabase
      .from('pockets')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updatePocket(id: string, updates: PocketUpdate): Promise<Pocket | null> {
    const { data, error } = await this.supabase
      .from('pockets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Fixed Expenses
  async createFixedExpense(expense: FixedExpenseInsert): Promise<FixedExpense | null> {
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .insert(expense)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getFixedExpensesByUserId(userId: string): Promise<FixedExpense[]> {
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .select('*')
      .eq('user_id', userId)
      .order('due_day', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getFixedExpenseById(id: string): Promise<FixedExpense | null> {
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateFixedExpense(id: string, updates: FixedExpenseUpdate): Promise<FixedExpense | null> {
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteFixedExpense(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('fixed_expenses')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Income Events
  async createIncomeEvent(event: IncomeEventInsert): Promise<IncomeEvent | null> {
    const { data, error } = await this.supabase
      .from('income_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getIncomeEventsByUserId(userId: string): Promise<IncomeEvent[]> {
    const { data, error } = await this.supabase
      .from('income_events')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Transactions
  async createTransaction(transaction: TransactionInsert): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async createTransactions(transactions: TransactionInsert[]): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .insert(transactions)
      .select();
    if (error) throw error;
    return data || [];
  }

  async getTransactionsByPocketId(pocketId: string): Promise<Transaction[]> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('pocket_id', pocketId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Reallocations
  async createReallocation(reallocation: ReallocationInsert): Promise<Reallocation | null> {
    const { data, error } = await this.supabase
      .from('reallocations')
      .insert(reallocation)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getReallocationById(id: string): Promise<Reallocation | null> {
    const { data, error } = await this.supabase
      .from('reallocations')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getReallocationsByUserId(userId: string): Promise<Reallocation[]> {
    assertUuid(userId, 'user id');
    const { data, error } = await this.supabase
      .from('reallocations')
      .select(`
        *,
        from_pocket:pockets!from_pocket_id (
          id,
          plan:plans!plan_id (user_id)
        ),
        to_pocket:pockets!to_pocket_id (
          id,
          plan:plans!plan_id (user_id)
        )
      `)
      .or(`from_pocket.plan.user_id.eq.${userId},to_pocket.plan.user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async updateReallocation(id: string, updates: ReallocationUpdate): Promise<Reallocation | null> {
    const { data, error } = await this.supabase
      .from('reallocations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Merchant Classifications
  async upsertMerchantClassification(classification: MerchantClassificationInsert): Promise<MerchantClassification | null> {
    const { data, error } = await this.supabase
      .from('merchant_classifications')
      .upsert(classification, { onConflict: 'user_id,recipient_key' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMerchantClassificationsByUserId(userId: string): Promise<MerchantClassification[]> {
    const { data, error } = await this.supabase
      .from('merchant_classifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getMerchantClassification(userId: string, recipientKey: string): Promise<MerchantClassification | null> {
    const { data, error } = await this.supabase
      .from('merchant_classifications')
      .select('*')
      .eq('user_id', userId)
      .eq('recipient_key', recipientKey)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Behavior Events
  async createBehaviorEvent(event: BehaviorEventInsert): Promise<BehaviorEvent | null> {
    const { data, error } = await this.supabase
      .from('behavior_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getBehaviorEventsByUserId(userId: string, limit = 50): Promise<BehaviorEvent[]> {
    const { data, error } = await this.supabase
      .from('behavior_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  // Discipline Scores
  async upsertDisciplineScore(score: DisciplineScoreInsert): Promise<DisciplineScore | null> {
    const { data, error } = await this.supabase
      .from('discipline_scores')
      .upsert(score, { onConflict: 'user_id,period' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getDisciplineScore(userId: string, period: string): Promise<DisciplineScore | null> {
    const { data, error } = await this.supabase
      .from('discipline_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('period', period)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getLatestDisciplineScore(userId: string): Promise<DisciplineScore | null> {
    const { data, error } = await this.supabase
      .from('discipline_scores')
      .select('*')
      .eq('user_id', userId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
}