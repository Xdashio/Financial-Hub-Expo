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
  EmergencyUnlockRow, EmergencyUnlockRowInsert,
  MsmeProject, MsmeProjectInsert, MsmeProjectUpdate,
  MsmeProjectTier, MsmeProjectTierInsert, MsmeProjectTierUpdate,
  MsmeProjectIncomeEvent, MsmeProjectIncomeEventInsert,
  MsmeProjectAllocation, MsmeProjectAllocationInsert,
  MsmeProjectSpend, MsmeProjectSpendInsert,
  MsmeProjectExcessPrompt, MsmeProjectExcessPromptInsert, MsmeProjectExcessPromptUpdate,
  MsmeInvoice, MsmeInvoiceInsert, MsmeInvoiceUpdate,
  MsmeStockItem, MsmeStockItemInsert, MsmeStockItemUpdate,
  MsmeStockMovement, MsmeStockMovementInsert,
} from '../database/database.types';
import { sumMoney, netMoney } from '@financial-hub/shared';

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

  async getActivePlanByUserId(userId: string, segment: 'individual' | 'msme' = 'individual'): Promise<Plan | null> {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('segment', segment)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** All active plans for the user (both segments). Used by cold-start routing to decide hasPlan. */
  async getActivePlansByUserId(userId: string): Promise<Plan[]> {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;
    return data || [];
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

  async getPlansByMonthlyPlanningDay(day: number): Promise<Plan[]> {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('status', 'active')
      .eq('income_pattern', 'freelancer')
      .eq('type', 'daily')
      .eq('monthly_planning_day', day);
    if (error) throw error;
    return data || [];
  }

  async getActiveFreelancerDailyPlans(): Promise<Plan[]> {
    const { data, error } = await this.supabase
      .from('plans')
      .select('*')
      .eq('status', 'active')
      .eq('income_pattern', 'freelancer')
      .eq('type', 'daily');
    if (error) throw error;
    return data || [];
  }

  async getOpenDailyAllocationsByDate(date: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('daily_allocations')
      .select('*')
      .eq('allocation_date', date)
      .eq('status', 'open');
    if (error) throw error;
    return data || [];
  }

  async getActualSpendForAllocation(allocationId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('transactions')
      .select('amount')
      .eq('daily_allocation_id', allocationId)
      .eq('type', 'spend');
    if (error) throw error;
    return (data || []).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  }

  async deactivateUserPlans(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('plans')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('status', 'active');
    if (error) throw error;
  }

  /** Deactivate every active plan for the user in one segment, leaving the
   *  other segment's active plan untouched (ADR-001 D1 — two active plans,
   *  one per segment, can coexist). */
  async deactivateUserPlansBySegment(userId: string, segment: 'individual' | 'msme'): Promise<void> {
    const { error } = await this.supabase
      .from('plans')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('segment', segment);
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

  /**
   * Top-level pockets only (excludes sub-pockets). Use this — not
   * `getPocketsByPlanId` — anywhere that used to assume "every pocket in
   * this plan" meant "every pocket the user sees as a home-screen row",
   * e.g. the main pocket list and the freelancer daily-cap computation.
   * Sub-pockets share the parent's `plan_id` (audit_team.md item 10), so
   * without this filter they'd double-list on the home screen and
   * double-count in `computeSpendableDailyCaps`.
   */
  async getTopLevelPocketsByPlanId(planId: string): Promise<Pocket[]> {
    const { data, error } = await this.supabase
      .from('pockets')
      .select('*')
      .eq('plan_id', planId)
      .is('parent_pocket_id', null)
      .order('created_at', { ascending: true });
    // Migration 007 not applied yet: parent_pocket_id unknown → fall back
    // to unfiltered plan pockets so income/home don't 500.
    if (error) {
      const msg = typeof error.message === 'string' ? error.message : '';
      if (/parent_pocket_id/i.test(msg) || error.code === '42703') {
        return this.getPocketsByPlanId(planId);
      }
      throw error;
    }
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

  /** Sub-pockets nested directly under `parentPocketId` (audit_team.md item 10). */
  async getSubPocketsByParentId(parentPocketId: string): Promise<Pocket[]> {
    const { data, error } = await this.supabase
      .from('pockets')
      .select('*')
      .eq('parent_pocket_id', parentPocketId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /** Single-row insert helper for sub-pocket creation — createPockets is
   *  batch-oriented (onboarding provisioning) and always returns an array;
   *  callers creating exactly one pocket want the row back directly. */
  async createPocket(pocket: PocketInsert): Promise<Pocket | null> {
    const { data, error } = await this.supabase
      .from('pockets')
      .insert(pocket)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deletePocket(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('pockets')
      .delete()
      .eq('id', id);
    if (error) throw error;
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

  // ------------------------------------------------------------------------
  // Pre-016 segment fallback helpers (see 016_msme_phase2_segment_isolation.sql)
  // ------------------------------------------------------------------------

  /**
   * True only when the error is PostgREST/Postgres telling us the segment
   * column doesn't exist yet (DB hasn't run 016):
   * - 42703  = Postgres `undefined_column` (column filter on .eq())
   * - PGRST204 = PostgREST schema-cache miss on INSERT payload key
   * Require the message to mention "segment" too so we never swallow an
   * unrelated 42703/PGRST204 (e.g. a different column drifting).
   */
  private isMissingSegmentColumn(error: unknown): boolean {
    const err = error as { code?: string; message?: unknown };
    const codeOk = err?.code === '42703' || err?.code === 'PGRST204';
    const msg = typeof err?.message === 'string' ? err.message : '';
    return codeOk && /segment/i.test(msg);
  }

  /** Drop the segment key from an insert payload (016 pre-migration retry). */
  private stripSegment<T extends object>(payload: T): Omit<T, 'segment'> {
    const { segment: _seg, ...rest } = payload as T & { segment?: unknown };
    return rest;
  }

  // Fixed Expenses
  async createFixedExpense(expense: FixedExpenseInsert): Promise<FixedExpense | null> {
    const { data, error } = await this.supabase
      .from('fixed_expenses')
      .insert(expense)
      .select()
      .single();
    if (error) {
      if (this.isMissingSegmentColumn(error)) {
        const { data: fallback, error: fallbackErr } = await this.supabase
          .from('fixed_expenses')
          .insert(this.stripSegment(expense))
          .select()
          .single();
        if (fallbackErr) throw fallbackErr;
        return fallback;
      }
      throw error;
    }
    return data;
  }

  async getFixedExpensesByUserId(
    userId: string,
    segment?: 'individual' | 'msme',
  ): Promise<FixedExpense[]> {
    let query = this.supabase
      .from('fixed_expenses')
      .select('*')
      .eq('user_id', userId);
    if (segment) {
      query = query.eq('segment', segment);
    }
    const { data, error } = await query.order('due_day', { ascending: true });
    if (error) {
      if (this.isMissingSegmentColumn(error)) {
        const { data: fallback, error: fallbackErr } = await this.supabase
          .from('fixed_expenses')
          .select('*')
          .eq('user_id', userId)
          .order('due_day', { ascending: true });
        if (fallbackErr) throw fallbackErr;
        return fallback || [];
      }
      throw error;
    }
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

  // Loans (audit_team.md item 9) - get loans with due dates in a date range
  async getLoansWithDueDateBetween(startDate: string, endDate: string): Promise<Pocket[]> {
    const { data, error } = await this.supabase
      .from('pockets')
      .select('*')
      .eq('kind', 'loan')
      .gte('due_day', parseInt(startDate.slice(8, 10)))
      .lte('due_day', parseInt(endDate.slice(8, 10)))
      .order('due_day', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Get all pockets of a specific kind (for loan reminders)
  async getPocketsByKind(kind: string): Promise<Pocket[]> {
    const { data, error } = await this.supabase
      .from('pockets')
      .select('*')
      .eq('kind', kind);
    if (error) throw error;
    return data || [];
  }

  // Deletes every fixed expense row for a user. Used by
  // OnboardingService.commit() to give onboarding/retake submissions
  // full-replace semantics instead of appending on top of whatever was
  // already there — see BACKEND_FRONTEND_AUDIT.md-style note in
  // onboarding.service.ts commit().
  // Phase 2: optionally scoped to one segment so Individual and MSME
  // onboarding do not wipe each other's bills.
  async deleteFixedExpensesByUserId(
    userId: string,
    segment?: 'individual' | 'msme',
  ): Promise<void> {
    let query = this.supabase.from('fixed_expenses').delete().eq('user_id', userId);
    if (segment) {
      query = query.eq('segment', segment);
    }
    const { error } = await query;
    if (error) {
      if (segment && this.isMissingSegmentColumn(error)) {
        // Pre-migration fallback — delete unfiltered (old behaviour)
        const { error: fallbackErr } = await this.supabase
          .from('fixed_expenses')
          .delete()
          .eq('user_id', userId);
        if (fallbackErr) throw fallbackErr;
        return;
      }
      throw error;
    }
  }

  // Income Events
  async createIncomeEvent(event: IncomeEventInsert): Promise<IncomeEvent | null> {
    const { data, error } = await this.supabase
      .from('income_events')
      .insert(event)
      .select()
      .single();
    if (error) {
      if (this.isMissingSegmentColumn(error)) {
        const { data: fallback, error: fallbackErr } = await this.supabase
          .from('income_events')
          .insert(this.stripSegment(event))
          .select()
          .single();
        if (fallbackErr) throw fallbackErr;
        return fallback;
      }
      throw error;
    }
    return data;
  }

  async getIncomeEventsByUserId(
    userId: string,
    segment?: 'individual' | 'msme',
  ): Promise<IncomeEvent[]> {
    let query = this.supabase
      .from('income_events')
      .select('*')
      .eq('user_id', userId);
    if (segment) {
      query = query.eq('segment', segment);
    }
    const { data, error } = await query.order('date', { ascending: false });
    if (error) {
      if (this.isMissingSegmentColumn(error)) {
        const { data: fallback, error: fallbackErr } = await this.supabase
          .from('income_events')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });
        if (fallbackErr) throw fallbackErr;
        return fallback || [];
      }
      throw error;
    }
    return data || [];
  }

  async getIncomeEventById(incomeEventId: string): Promise<IncomeEvent | null> {
    const { data, error } = await this.supabase
      .from('income_events')
      .select('*')
      .eq('id', incomeEventId)
      .single();
    if (error) throw error;
    return data;
  }

  async updateIncomeEvent(incomeEventId: string, updates: Partial<IncomeEventInsert>): Promise<IncomeEvent | null> {
    const { data, error } = await this.supabase
      .from('income_events')
      .update(updates)
      .eq('id', incomeEventId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Atomically claim a pending surplus so only one caller can allocate it. */
  async claimPendingSurplus(incomeEventId: string): Promise<IncomeEvent | null> {
    const { data, error } = await this.supabase
      .from('income_events')
      .update({ surplus_allocation_status: 'allocated', unallocated_surplus: null })
      .eq('id', incomeEventId)
      .eq('surplus_allocation_status', 'pending')
      .select()
      .maybeSingle();
    if (error) throw error;
    return data;
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

  async getTransactionsByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Transaction[]> {
    // First get the user's active plan to filter by plan
    const plan = await this.getActivePlanByUserId(userId);
    if (!plan) return [];

    // Get all pockets in the plan
    const pockets = await this.getTopLevelPocketsByPlanId(plan.id);
    const pocketIds = pockets.map((p) => p.id);

    // Get transactions in date range for plan's pockets
    const { data, error } = await this.supabase
      .from('transactions')
      .select('*')
      .in('pocket_id', pocketIds)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createEmergencyUnlock(unlock: {
    user_id: string;
    plan_id: string;
    amount: number;
    days_calculated: number;
    least_daily_spend: number;
    average_daily_spend: number;
    reserve_kept: number;
    // New runway impact fields (migration 013)
    runway_days_before?: number;
    runway_days_after?: number;
    runway_reduction_days?: number;
  }): Promise<EmergencyUnlockRow> {
    const { data, error } = await this.supabase
      .from('emergency_unlocks')
      .insert(unlock)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getEmergencyUnlockByUserId(userId: string): Promise<EmergencyUnlockRow[]> {
    const { data, error } = await this.supabase
      .from('emergency_unlocks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getEmergencyUnlockThisMonth(userId: string): Promise<EmergencyUnlockRow | null> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await this.supabase
      .from('emergency_unlocks')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }
    return data;
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
    // Summed in integer cents (see @financial-hub/shared money.ts) rather
    // than raw float addition — Postgres NUMERIC is exact, but a JS
    // reduce() over many ledger rows can accumulate float rounding error
    // that a final Math.round(n*100)/100 patch doesn't prevent, since the
    // error is baked into every intermediate sum before that final round.
    const allocated = sumMoney(
      transactions
        .filter(t => t.type === 'allocation' || t.type === 'reallocation_in')
        .map(t => t.amount),
    );

    const spent = sumMoney(
      transactions
        .filter(t => t.type === 'spend')
        .map(t => t.amount),
    );

    // reallocation_out amounts are stored as negative values in the ledger
    // (see reallocations.service.ts createTransactions call), so summing them
    // reduces the balance correctly without a separate subtract step.
    const reallocatedOut = sumMoney(
      transactions
        .filter(t => t.type === 'reallocation_out')
        .map(t => t.amount), // amounts are negative
    );

    // Daily under-cap rollover (Batch 6): signed amounts — negative leaves a
    // spendable pocket, positive lands in Savings. Zero-amount placeholder
    // rows (early unlock audit) are no-ops.
    const rolloverNet = sumMoney(
      transactions
        .filter(t => t.type === 'rollover')
        .map(t => t.amount),
    );

    const available = netMoney(allocated, reallocatedOut, -spent, rolloverNet);

    const transactionCount = transactions.length;
    const reallocationCount = (reallocations.data || []).length;

    return {
      allocated,
      spent,
      // NOT clamped to 0 here: an overridden spend (spend.service.ts
      // `override: true`) can legitimately push a pocket negative, and
      // emergency-unlock eligibility depends on seeing that true negative/
      // zero value. Clamping here would silently hide overdrafts and make
      // emergency unlock permanently unreachable even after this fix.
      available,
      transactionCount,
      reallocationCount,
    };
  }

  /**
   * Calculate a parent pocket's reserved balance (subpocket-feature-spec.md §2).
   * Reserved = parent.available - sum(sub_pockets.available).
   * This is the portion of the parent's balance that is not distributed to
   * sub-pockets and should only be accessible via the overflow/borrow flow.
   */
  async getParentReservedBalance(parentPocketId: string): Promise<number> {
    const parentSummary = await this.getPocketSummary(parentPocketId);
    const subPockets = await this.getSubPocketsByParentId(parentPocketId);
    
    if (subPockets.length === 0) {
      // No sub-pockets: entire balance is available (not reserved)
      return 0;
    }

    // Sum all sub-pocket available balances (distributable portion)
    const subPocketSummaries = await Promise.all(
      subPockets.map(sp => this.getPocketSummary(sp.id))
    );
    const distributable = sumMoney(subPocketSummaries.map(summary => summary.available));

    // Reserved = parent total - distributable to children
    const reserved = Math.max(0, netMoney(parentSummary.available, -distributable));
    return reserved;
  }

  async getDailyAllocationByPlanIdAndDate(planId: string, allocationDate: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('daily_allocations')
      .select('*')
      .eq('plan_id', planId)
      .eq('allocation_date', allocationDate)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getDailyAllocationById(id: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('daily_allocations')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createDailyAllocation(allocation: {
    id: string;
    plan_id: string;
    user_id: string;
    allocation_date: string;
    planned_amount: number;
    actual_spend: number;
    returned_amount: number;
    overspend_amount: number;
    runway_days_at_open: number;
    runway_days_at_close: number | null;
    status: string;
    created_at: Date;
    closed_at: Date | null;
  }): Promise<any> {
    const { data, error } = await this.supabase
      .from('daily_allocations')
      .insert(allocation)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateDailyAllocation(id: string, updates: {
    actual_spend?: number;
    returned_amount?: number;
    overspend_amount?: number;
    status?: string;
    closed_at?: Date | null;
    runway_days_at_close?: number | null;
  }): Promise<any> {
    const { data, error } = await this.supabase
      .from('daily_allocations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getDailyAllocationsByPlanIdAndMonth(
    planId: string,
    cycleMonth: string,
  ): Promise<any[]> {
    const startOfMonth = cycleMonth;
    const endOfMonth = new Date(cycleMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('daily_allocations')
      .select('*')
      .eq('plan_id', planId)
      .gte('allocation_date', startOfMonth)
      .lt('allocation_date', endOfMonthStr)
      .order('allocation_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getDailyAllocationsByPlanIdAndDateRange(
    planId: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('daily_allocations')
      .select('*')
      .eq('plan_id', planId)
      .gte('allocation_date', startDate)
      .lte('allocation_date', endDate)
      .order('allocation_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createPlanningCycleEvent(event: {
    plan_id: string;
    user_id: string;
    cycle_month: string;
    reserve_balance_at_start: number;
    total_fixed_obligations: number;
    discretionary_reserve: number;
    daily_budget: number;
    runway_days: number;
    allocation_snapshot: any;
    recommendations_snapshot: any;
  }): Promise<any> {
    const { data, error } = await this.supabase
      .from('planning_cycle_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPlanningCycleEventsByUserId(userId: string, months: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('planning_cycle_events')
      .select('*')
      .eq('user_id', userId)
      .gte('cycle_month', startDateStr)
      .order('cycle_month', { ascending: false });
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

  /**
   * Create an immediate parent-to-child reallocation for the overflow/borrow flow.
   * This skips the cooling-off period since it's money moving within the same
   * parent-child family (subpocket-feature-spec.md §5).
   */
  async createImmediateParentToChildReallocation(
    fromPocketId: string,
    toPocketId: string,
    amount: number,
    reason: 'other' | 'emergency' | 'unexpected_expense' | 'income_change' | 'priority_shift'
  ): Promise<Reallocation | null> {
    const { data, error } = await (this.supabase as any).rpc('atomic_parent_borrow', {
      p_parent_pocket_id: fromPocketId,
      p_child_pocket_id: toPocketId,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) throw error;
    return data as Reallocation | null;
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

  /** Completes a requested reallocation exactly once with atomic ledger writes. */
  async claimReallocationCompletion(
    id: string,
    updates: Pick<ReallocationUpdate, 'completed_at' | 'discipline_cost'>,
  ): Promise<Reallocation | null> {
    const { data, error } = await (this.supabase as any).rpc('atomic_complete_reallocation', {
      p_reallocation_id: id,
      p_discipline_cost: updates.discipline_cost ?? 0,
    });
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
    return sumMoney((data || []).map((row) => Number(row.amount)));
  }

  /**
   * Idempotency guard for the nightly rollover sweep (see rollover.service.ts
   * processDay). The sweep is a two-step write — ledger rows first, then the
   * EVENT_DAILY_ROLLOVER_SUCCESS behavior event. The behavior event is the
   * canonical "already processed" marker, but if the process dies between the
   * two writes (or the event write is lost), the next rollover run still sees
   * that day as unhandled and re-inserts the ledger rows, producing duplicate
   * "+KSh X rollover" entries on the source pocket. Checking the ledger itself
   * — for any 'rollover' row already written for one of the spendable pockets
   * on that UTC day — closes that gap: a day whose rows were committed but
   * whose event was missed is treated as done, not re-run.
   */
  async hasRolloverLedgerRowsForDate(
    pocketIds: string[],
    startIso: string,
    endIsoExclusive: string,
  ): Promise<boolean> {
    if (pocketIds.length === 0) return false;
    const { data, error } = await this.supabase
      .from('transactions')
      .select('id')
      .in('pocket_id', pocketIds)
      .eq('type', 'rollover')
      .gte('created_at', startIso)
      .lt('created_at', endIsoExclusive)
      .limit(1);
    if (error) throw error;
    return (data || []).length > 0;
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

  async getDisciplineScoreHistory(userId: string, startDate: string, endDate: string): Promise<DisciplineScore[]> {
    const { data, error } = await this.supabase
      .from('discipline_scores')
      .select('*')
      .eq('user_id', userId)
      .gte('calculated_at', startDate)
      .lte('calculated_at', endDate)
      .order('calculated_at', { ascending: true });
    if (error) throw error;
    return data || [];
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
    const userIds = (data || [])
      .map((row: { user_id: string }) => row.user_id)
      .filter((id): id is string => typeof id === 'string');
    return [...new Set(userIds)];
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

  // ========================================================================
  // MSME Project Funding Cascade (Phase 3 - 017_msme_projects.sql)
  // ========================================================================

  async createMsmeProject(project: MsmeProjectInsert): Promise<MsmeProject | null> {
    const { data, error } = await this.supabase
      .from('msme_projects')
      .insert(project)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectById(id: string): Promise<MsmeProject | null> {
    const { data, error } = await this.supabase
      .from('msme_projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectsByUserId(userId: string): Promise<MsmeProject[]> {
    const { data, error } = await this.supabase
      .from('msme_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getActiveCascadeByUserId(userId: string): Promise<MsmeProject | null> {
    const { data, error } = await this.supabase
      .from('msme_projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active_cascade', true)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async updateMsmeProject(id: string, updates: MsmeProjectUpdate): Promise<MsmeProject | null> {
    const { data, error } = await this.supabase
      .from('msme_projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Tiers
  async createMsmeProjectTier(tier: MsmeProjectTierInsert): Promise<MsmeProjectTier | null> {
    const { data, error } = await this.supabase
      .from('msme_project_tiers')
      .insert(tier)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectTierById(id: string): Promise<MsmeProjectTier | null> {
    const { data, error } = await this.supabase
      .from('msme_project_tiers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectTiersByProjectId(projectId: string): Promise<MsmeProjectTier[]> {
    const { data, error } = await this.supabase
      .from('msme_project_tiers')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async updateMsmeProjectTier(id: string, updates: MsmeProjectTierUpdate): Promise<MsmeProjectTier | null> {
    const { data, error } = await this.supabase
      .from('msme_project_tiers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Income Events
  async createMsmeProjectIncomeEvent(event: MsmeProjectIncomeEventInsert): Promise<MsmeProjectIncomeEvent | null> {
    const { data, error } = await this.supabase
      .from('msme_project_income_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectIncomeEventsByProjectId(projectId: string): Promise<MsmeProjectIncomeEvent[]> {
    const { data, error } = await this.supabase
      .from('msme_project_income_events')
      .select('*')
      .eq('project_id', projectId)
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Allocations
  async createMsmeProjectAllocation(allocation: MsmeProjectAllocationInsert): Promise<MsmeProjectAllocation | null> {
    const { data, error } = await this.supabase
      .from('msme_project_allocations')
      .insert(allocation)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectAllocationsByProjectId(projectId: string): Promise<MsmeProjectAllocation[]> {
    const { data, error } = await this.supabase
      .from('msme_project_allocations')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getMsmeProjectAllocationsByIncomeEventId(incomeEventId: string): Promise<MsmeProjectAllocation[]> {
    const { data, error } = await this.supabase
      .from('msme_project_allocations')
      .select('*')
      .eq('income_event_id', incomeEventId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Spends
  async createMsmeProjectSpend(spend: MsmeProjectSpendInsert): Promise<MsmeProjectSpend | null> {
    const { data, error } = await this.supabase
      .from('msme_project_spends')
      .insert(spend)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectSpendsByProjectId(projectId: string): Promise<MsmeProjectSpend[]> {
    const { data, error } = await this.supabase
      .from('msme_project_spends')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getMsmeProjectSpendsByTierId(tierId: string): Promise<MsmeProjectSpend[]> {
    const { data, error } = await this.supabase
      .from('msme_project_spends')
      .select('*')
      .eq('tier_id', tierId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Excess Prompts
  async createMsmeProjectExcessPrompt(prompt: MsmeProjectExcessPromptInsert): Promise<MsmeProjectExcessPrompt | null> {
    const { data, error } = await this.supabase
      .from('msme_project_excess_prompts')
      .insert(prompt)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectExcessPromptById(id: string): Promise<MsmeProjectExcessPrompt | null> {
    const { data, error } = await this.supabase
      .from('msme_project_excess_prompts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getMsmeProjectExcessPromptsByProjectId(
    projectId: string,
    status?: 'pending' | 'resolved' | 'dismissed'
  ): Promise<MsmeProjectExcessPrompt[]> {
    let query = this.supabase
      .from('msme_project_excess_prompts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updateMsmeProjectExcessPrompt(
    id: string,
    updates: MsmeProjectExcessPromptUpdate
  ): Promise<MsmeProjectExcessPrompt | null> {
    const { data, error } = await this.supabase
      .from('msme_project_excess_prompts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ========================================================================
  // MSME Invoicing & Receivables (020_msme_invoices.sql) — eTIMS-ready
  // ========================================================================

  async createMsmeInvoice(invoice: MsmeInvoiceInsert): Promise<MsmeInvoice | null> {
    const { data, error } = await this.supabase
      .from('msme_invoices')
      .insert(invoice)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getMsmeInvoiceById(id: string): Promise<MsmeInvoice | null> {
    const { data, error } = await this.supabase
      .from('msme_invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async getMsmeInvoicesByUserId(
    userId: string,
    filters?: { status?: string; overdueOnly?: boolean }
  ): Promise<MsmeInvoice[]> {
    let query = this.supabase
      .from('msme_invoices')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    let rows = (data || []) as MsmeInvoice[];

    if (filters?.overdueOnly) {
      const today = new Date().toISOString().slice(0, 10);
      rows = rows.filter(r => r.due_date < today && (r.status === 'draft' || r.status === 'sent'));
    }

    return rows;
  }

  async getMsmeInvoicesByPlanId(planId: string): Promise<MsmeInvoice[]> {
    const { data, error } = await this.supabase
      .from('msme_invoices')
      .select('*')
      .eq('plan_id', planId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async updateMsmeInvoice(id: string, updates: MsmeInvoiceUpdate): Promise<MsmeInvoice | null> {
    const { data, error } = await this.supabase
      .from('msme_invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** Atomically records invoice income, allocations, and the paid status. */
  async claimMsmeInvoicePayment(
    id: string,
    input: { userId: string; source: string; label: string; date: string; allocations: Array<{ pocket_id: string; amount: number }> },
  ): Promise<MsmeInvoice | null> {
    const { data, error } = await (this.supabase as any).rpc('atomic_pay_msme_invoice', {
      p_invoice_id: id,
      p_user_id: input.userId,
      p_source: input.source,
      p_label: input.label,
      p_date: input.date,
      p_allocations: input.allocations,
    });
    if (error) throw error;
    return data;
  }

  async deleteMsmeInvoice(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('msme_invoices')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getOverdueInvoicesByUserId(userId: string): Promise<MsmeInvoice[]> {
    return this.getMsmeInvoicesByUserId(userId, { overdueOnly: true });
  }

  // ========================================================================
  // MSME Stock (021_msme_stock.sql)
  // ========================================================================

  async createMsmeStockItem(item: MsmeStockItemInsert): Promise<MsmeStockItem | null> {
    const { data, error } = await this.supabase.from('msme_stock_items').insert(item).select().single();
    if (error) throw error;
    return data;
  }

  async getMsmeStockItemById(id: string): Promise<MsmeStockItem | null> {
    const { data, error } = await this.supabase.from('msme_stock_items').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async getMsmeStockItemsByUserId(userId: string): Promise<MsmeStockItem[]> {
    const { data, error } = await this.supabase.from('msme_stock_items').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getMsmeStockItemsByPlanId(planId: string): Promise<MsmeStockItem[]> {
    const { data, error } = await this.supabase.from('msme_stock_items').select('*').eq('plan_id', planId).order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async updateMsmeStockItem(id: string, updates: MsmeStockItemUpdate): Promise<MsmeStockItem | null> {
    const { data, error } = await this.supabase.from('msme_stock_items').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteMsmeStockItem(id: string): Promise<void> {
    const { error } = await this.supabase.from('msme_stock_items').delete().eq('id', id);
    if (error) throw error;
  }

  async createMsmeStockMovement(m: MsmeStockMovementInsert): Promise<MsmeStockMovement | null> {
    const { data, error } = await this.supabase.from('msme_stock_movements').insert(m).select().single();
    if (error) throw error;
    return data;
  }

  async getMsmeStockMovementsByItemId(itemId: string): Promise<MsmeStockMovement[]> {
    const { data, error } = await this.supabase.from('msme_stock_movements').select('*').eq('item_id', itemId).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getMsmeStockMovementsByUserId(userId: string, limit = 50): Promise<MsmeStockMovement[]> {
    const { data, error } = await this.supabase.from('msme_stock_movements').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data || [];
  }

  // B-02: atomic adjust via DB function (024_stock_atomic_helpers.sql)
  async adjustStockQty(itemId: string, delta: number): Promise<MsmeStockItem> {
    const { data, error } = await (this.supabase as any).rpc('adjust_stock_qty', {
      p_item_id: itemId,
      p_delta: delta,
    });
    if (error) throw error;
    // rpc returns single row (TABLE) or object; normalize
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('adjust_stock_qty returned no row');
    return row as MsmeStockItem;
  }

  // Paginated helpers for A-02 (server-side pagination, avoids loading entire history)
  async getMsmeInvoicesByUserIdPaginated(
    userId: string,
    page = 1,
    limit = 20,
    filters?: { status?: string; overdueOnly?: boolean; search?: string },
  ): Promise<{ data: MsmeInvoice[]; total: number; totalPages: number }> {
    let query = (this.supabase as any)
      .from('msme_invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.search) {
      const s = `%${filters.search}%`;
      query = query.or(`customer_name.ilike.${s},description.ilike.${s}`);
    }
    query = query.order('due_date', { ascending: true });
    const from = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));
    const to = from + Math.min(50, Math.max(1, limit)) - 1;
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) throw error;
    let rows = (data || []) as MsmeInvoice[];
    if (filters?.overdueOnly) {
      const today = new Date().toISOString().slice(0, 10);
      rows = rows.filter(r => r.due_date < today && (r.status === 'draft' || r.status === 'sent'));
    }
    const total = typeof count === 'number' ? count : rows.length;
    return { data: rows, total, totalPages: Math.ceil(total / Math.min(50, Math.max(1, limit))) };
  }

  async getMsmeStockItemsByUserIdPaginated(
    userId: string,
    page = 1,
    limit = 20,
    filters?: { search?: string; lowStockOnly?: boolean },
  ): Promise<{ data: MsmeStockItem[]; total: number; totalPages: number }> {
    let query = (this.supabase as any)
      .from('msme_stock_items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);
    if (filters?.search) {
      const s = `%${filters.search}%`;
      query = query.or(`name.ilike.${s},sku.ilike.${s},location.ilike.${s}`);
    }
    query = query.order('created_at', { ascending: false });
    const from = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit));
    const to = from + Math.min(50, Math.max(1, limit)) - 1;
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) throw error;
    let rows = (data || []) as MsmeStockItem[];
    if (filters?.lowStockOnly) {
      rows = rows.filter(r => Number(r.qty_on_hand) <= Number(r.low_stock_threshold));
    }
    const total = typeof count === 'number' ? count : rows.length;
    return { data: rows, total, totalPages: Math.ceil(total / Math.min(50, Math.max(1, limit))) };
  }
}
