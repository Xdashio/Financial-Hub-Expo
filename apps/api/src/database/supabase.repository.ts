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
  MerchantReport, MerchantReportInsert,
  NotificationPreferences, NotificationPreferencesUpdate,
  PushToken, PushTokenInsert,
  NotificationDeliveryInsert,
  IdempotencyRecord, IdempotencyRecordInsert, IdempotencyScope,
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

  /** Deactivate every active plan for the user except `exceptPlanId`. */
  async deactivateUserPlansExcept(userId: string, exceptPlanId: string): Promise<void> {
    const { error } = await this.supabase
      .from('plans')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .neq('id', exceptPlanId);
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

  // Deletes every fixed expense row for a user. Used by
  // OnboardingService.commit() to give onboarding/retake submissions
  // full-replace semantics instead of appending on top of whatever was
  // already there — see BACKEND_FRONTEND_AUDIT.md-style note in
  // onboarding.service.ts commit().
  async deleteFixedExpensesByUserId(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('fixed_expenses')
      .delete()
      .eq('user_id', userId);
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

  async getTransactionsByPocketIdPaginated(
    pocketId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ transactions: Transaction[]; total: number; totalPages: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('pocket_id', pocketId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      transactions: data || [],
      total,
      totalPages
    };
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateTransaction(
    id: string,
    updates: { category?: string | null; pocket_id?: string },
  ): Promise<Transaction | null> {
    const { data, error } = await this.supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPocketSummary(pocketId: string): Promise<{
    allocated: number;
    spent: number;
    available: number;
    transactionCount: number;
    reallocationCount: number;
  }> {
    const [transactions, reallocations] = await Promise.all([
      this.getTransactionsByPocketId(pocketId),
      this.supabase
        .from('reallocations')
        .select('*')
        .or(`from_pocket_id.eq.${pocketId},to_pocket_id.eq.${pocketId}`)
    ]);

    // Ledger-based balance:
    //   Credits  — allocation (income landed), reallocation_in (money moved in),
    //              rollover with positive amount (e.g. daily unspent into Savings)
    //   Debits   — spend (money out), reallocation_out (negative amounts summed),
    //              rollover with negative amount (daily unspent leaving a spendable)
    // monthly_allocation on the pocket row is a planning ceiling only and is
    // never mutated after onboarding — balances are always derived from here.
    const allocated = transactions
      .filter(t => t.type === 'allocation' || t.type === 'reallocation_in')
      .reduce((sum, t) => sum + t.amount, 0);

    const spent = transactions
      .filter(t => t.type === 'spend')
      .reduce((sum, t) => sum + t.amount, 0);

    // reallocation_out amounts are stored as negative values in the ledger
    // (see reallocations.service.ts createTransactions call), so summing them
    // reduces the balance correctly without a separate subtract step.
    const reallocatedOut = transactions
      .filter(t => t.type === 'reallocation_out')
      .reduce((sum, t) => sum + t.amount, 0); // amounts are negative

    // Daily under-cap rollover (Batch 6): signed amounts — negative leaves a
    // spendable pocket, positive lands in Savings. Zero-amount placeholder
    // rows (early unlock audit) are no-ops.
    const rolloverNet = transactions
      .filter(t => t.type === 'rollover')
      .reduce((sum, t) => sum + t.amount, 0);

    const available = allocated + reallocatedOut - spent + rolloverNet;

    const transactionCount = transactions.length;
    const reallocationCount = (reallocations.data || []).length;

    return {
      allocated,
      spent,
      available: Math.max(0, available),
      transactionCount,
      reallocationCount,
    };
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

    // PostgREST's `.or()` logic-tree filter only supports referencing a
    // *directly* embedded resource's own columns (e.g. `from_pocket.user_id`),
    // not a resource nested two levels deep through another embed (
    // `from_pocket.plan.user_id`). The previous version of this query used
    // exactly that two-level path and failed at request time with
    // `failed to parse logic tree` (see BACKEND_FRONTEND_AUDIT.md-style
    // schema/query drift — this one wasn't caught because, like C6, nothing
    // exercises this against real PostgREST/Supabase).
    //
    // Fix: resolve the user's own pocket ids first (via their active plan),
    // then filter reallocations by direct `from_pocket_id`/`to_pocket_id`
    // membership, which `.or(...)` supports natively.
    const plan = await this.getActivePlanByUserId(userId);
    if (!plan) return [];

    const pockets = await this.getPocketsByPlanId(plan.id);
    if (pockets.length === 0) return [];

    const pocketIds = pockets.map(p => p.id);
    const idList = pocketIds.join(',');

    const { data, error } = await this.supabase
      .from('reallocations')
      .select('*')
      .or(`from_pocket_id.in.(${idList}),to_pocket_id.in.(${idList})`)
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

  async getMerchantClassificationById(id: string): Promise<MerchantClassification | null> {
    const { data, error } = await this.supabase
      .from('merchant_classifications')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async deleteMerchantClassification(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('merchant_classifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Merchant Reports
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

  // Paginated variant for the Insights "recent activity" list (see
  // getBehaviorEventsByUserId above, which is kept for callers that just
  // want the latest N events with no page metadata).
  async getBehaviorEventsByUserIdPaginated(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ events: BehaviorEvent[]; total: number; totalPages: number }> {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await this.supabase
      .from('behavior_events')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return { events: data || [], total, totalPages };
  }

  // Every behavior event for the trailing `days` window, oldest first —
  // used to build the Insights activity heatmap (one cell per calendar
  // day). Unlike the paginated/limited variants above this is intentionally
  // unbounded within the window since the heatmap needs every event, not
  // just the latest page.
  async getBehaviorEventsSince(userId: string, sinceIso: string): Promise<BehaviorEvent[]> {
    const { data, error } = await this.supabase
      .from('behavior_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Powers the heatmap's tap-to-expand day detail (InsightsService.getEventsForDay)
  // — the events for one calendar day, oldest first, bounded on both ends so
  // it stays cheap regardless of how much history the user has.
  async getBehaviorEventsBetween(userId: string, startIso: string, endIsoExclusive: string): Promise<BehaviorEvent[]> {
    const { data, error } = await this.supabase
      .from('behavior_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .lt('created_at', endIsoExclusive)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /** Behavior events of specific types since a timestamp (for streak / idempotency). */
  async getBehaviorEventsByTypesSince(
    userId: string,
    types: string[],
    sinceIso: string,
  ): Promise<BehaviorEvent[]> {
    if (types.length === 0) return [];
    const { data, error } = await this.supabase
      .from('behavior_events')
      .select('*')
      .eq('user_id', userId)
      .in('type', types)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /**
   * Spend totals keyed by pocket_id for transactions in [start, end).
   * Only type='spend' rows are summed (positive amounts).
   */
  async getSpendTotalsByPocketBetween(
    pocketIds: string[],
    startIso: string,
    endIsoExclusive: string,
  ): Promise<Map<string, number>> {
    const totals = new Map<string, number>();
    for (const id of pocketIds) totals.set(id, 0);
    if (pocketIds.length === 0) return totals;

    const { data, error } = await this.supabase
      .from('transactions')
      .select('pocket_id, amount')
      .in('pocket_id', pocketIds)
      .eq('type', 'spend')
      .gte('created_at', startIso)
      .lt('created_at', endIsoExclusive);
    if (error) throw error;

    for (const row of data || []) {
      totals.set(row.pocket_id, (totals.get(row.pocket_id) || 0) + Number(row.amount));
    }
    return totals;
  }

  /** Sum of positive rollover credits into a pocket this calendar month (UTC). */
  async getRolloverCreditsForPocketBetween(
    pocketId: string,
    startIso: string,
    endIsoExclusive: string,
  ): Promise<number> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('pocket_id', pocketId)
      .eq('type', 'rollover')
      .gt('amount', 0)
      .gte('created_at', startIso)
      .lt('created_at', endIsoExclusive);
    if (error) throw error;
    return (data || []).reduce((sum, row) => sum + Number(row.amount), 0);
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

  // Notification Preferences
  async getNotificationPreferencesByUserId(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async upsertNotificationPreferences(
    userId: string,
    updates: NotificationPreferencesUpdate
  ): Promise<NotificationPreferences | null> {
    const updatedAt = new Date().toISOString();

    // Try UPDATE first so fields the caller didn't touch are preserved for
    // an existing row. The previous single-upsert call always merged a full
    // set of defaults underneath `updates`, which meant a partial update
    // (e.g. only toggling reallocation_confirms) silently reset every other
    // preference back to its default value.
    const { data: updated, error: updateError } = await this.supabase
      .from('notification_preferences')
      .update({ ...updates, updated_at: updatedAt })
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return updated;

    // No existing row for this user — insert one. Fields not present in
    // `updates` fall back to the column DEFAULT declared in the schema
    // (see 001_initial_schema.sql), so no separate defaults object needs
    // to be threaded through from the caller.
    const { data: inserted, error: insertError } = await this.supabase
      .from('notification_preferences')
      .insert({ user_id: userId, ...updates, updated_at: updatedAt })
      .select()
      .single();
    if (insertError) throw insertError;
    return inserted;
  }

  // Push tokens (Batch 7)
  async upsertPushToken(token: PushTokenInsert): Promise<PushToken | null> {
    const updatedAt = new Date().toISOString();

    // If this Expo token was previously registered to a *different* user
    // (device re-login / account switch), delete the stale row first so we
    // never silently reassign another account's push channel via upsert.
    const { data: existing, error: existingError } = await this.supabase
      .from('push_tokens')
      .select('id, user_id')
      .eq('token', token.token)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.user_id !== token.user_id) {
      const { error: deleteError } = await this.supabase
        .from('push_tokens')
        .delete()
        .eq('id', existing.id);
      if (deleteError) throw deleteError;
    }

    const { data, error } = await this.supabase
      .from('push_tokens')
      .upsert(
        { ...token, updated_at: updatedAt },
        { onConflict: 'token' },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPushTokensByUserId(userId: string): Promise<PushToken[]> {
    const { data, error } = await this.supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data || [];
  }

  async listUserIdsWithPushTokens(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('push_tokens')
      .select('user_id');
    if (error) throw error;
    return [...new Set((data || []).map((row: { user_id: string }) => row.user_id))];
  }

  async deletePushToken(userId: string, token: string): Promise<boolean> {
    const { error, count } = await this.supabase
      .from('push_tokens')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .eq('token', token);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async deletePushTokenByValue(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('push_tokens')
      .delete()
      .eq('token', token);
    if (error) throw error;
  }

  /**
   * Insert-or-no-op for delivery dedupe. Returns true when this process
   * claimed the (user, kind, dedupe_key) slot; false if it already existed.
   */
  async tryClaimNotificationDelivery(
    delivery: NotificationDeliveryInsert,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('notification_deliveries')
      .insert(delivery)
      .select('id')
      .maybeSingle();

    if (error) {
      // Unique violation → already delivered (or another worker claimed it).
      if (error.code === '23505') return false;
      throw error;
    }
    return Boolean(data);
  }

  async deleteNotificationDelivery(
    userId: string,
    kind: string,
    dedupeKey: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('notification_deliveries')
      .delete()
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('dedupe_key', dedupeKey);
    if (error) throw error;
  }

  async getCoolingOffReallocationsEndingBetween(
    windowStartIso: string,
    windowEndIso: string,
  ): Promise<Reallocation[]> {
    const { data, error } = await this.supabase
      .from('reallocations')
      .select('*')
      .eq('status', 'cooling_off')
      .gte('cooling_off_ends_at', windowStartIso)
      .lte('cooling_off_ends_at', windowEndIso);
    if (error) throw error;
    return data || [];
  }

  async resolveUserIdForPocket(pocketId: string): Promise<string | null> {
    const pocket = await this.getPocketById(pocketId);
    if (!pocket) return null;
    const plan = await this.getPlanById(pocket.plan_id);
    return plan?.user_id ?? null;
  }

  // Idempotency (income / spend retries)
  async getIdempotencyRecord(
    userId: string,
    scope: IdempotencyScope,
    key: string,
  ): Promise<IdempotencyRecord | null> {
    const { data, error } = await this.supabase
      .from('idempotency_records')
      .select('*')
      .eq('user_id', userId)
      .eq('scope', scope)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async saveIdempotencyRecord(
    record: IdempotencyRecordInsert,
  ): Promise<IdempotencyRecord | null> {
    const { data, error } = await this.supabase
      .from('idempotency_records')
      .insert(record)
      .select()
      .single();
    if (error) {
      // Race: another request with the same key won — surface as null so
      // the caller re-reads the winning record.
      if (error.code === '23505') return null;
      throw error;
    }
    return data;
  }
}
