import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PocketUpdateInputSchema, RunwaySummary } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { RunwayService } from '../runway/runway.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';
import { Pocket, PocketUpdate, Transaction, MerchantClassification } from '../../database/database.types';

@Injectable()
export class PocketsService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
    private readonly runway: RunwayService,
  ) {}

  async getAllForUser(userId: string): Promise<(Pocket & { available_balance: number })[]> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      return [];
    }
    const pockets = await this.repository.getPocketsByPlanId(plan.id);

    // Enrich each pocket with its ledger-derived available balance so the
    // home screen doesn't need to call /summary per pocket. monthly_allocation
    // is the planning ceiling; available_balance is the spendable ledger balance.
    const enriched = await Promise.all(
      pockets.map(async (pocket) => {
        const summary = await this.repository.getPocketSummary(pocket.id);
        return { ...pocket, available_balance: summary.available };
      })
    );

    // Freelancer + daily plans get their spendable daily_cap recomputed
    // live against the current runway (days until next expected payment)
    // instead of the flat 30-day assumption baked in at onboarding. This is
    // the only place the adaptive cap is applied — everything downstream
    // (home hero, per-pocket progress bars) already reads daily_cap, so no
    // other screen needs to know runway exists. See
    // docs/FREELANCER_RUNWAY.md.
    if (plan.income_pattern === 'freelancer' && plan.type === 'daily') {
      const runwaySummary = await this.runway.getRunwayForPlan(userId, plan);
      const caps = computeSpendableDailyCaps(enriched, runwaySummary);
      for (const pocket of enriched) {
        const cap = caps.get(pocket.id);
        if (cap !== undefined) {
          pocket.daily_cap = cap;
        }
      }
    }

    return enriched;
  }

  /** See docs/FREELANCER_RUNWAY.md. Returns { applicable: false } for non-freelancer or non-daily plans. */
  async getRunwaySummaryForUser(userId: string): Promise<RunwaySummary> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      return { applicable: false };
    }
    return this.runway.getRunwayForPlan(userId, plan);
  }

  async getByIdForUser(id: string, userId: string): Promise<Pocket> {
    const pocket = await this.repository.getPocketById(id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);
    return pocket;
  }

  async updateForUser(id: string, userId: string, updates: unknown): Promise<Pocket> {
    const parsed = this.parseUpdate(updates);

    const pocket = await this.repository.getPocketById(id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    const updated = await this.repository.updatePocket(id, parsed);
    if (!updated) {
      throw new NotFoundException('Pocket not found');
    }
    return updated;
  }

  private parseUpdate(input: unknown): PocketUpdate {
    const result = PocketUpdateInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const { name, category, dailyCap } = result.data;
    const updates: PocketUpdate = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (dailyCap !== undefined) updates.daily_cap = dailyCap;
    if (Object.keys(updates).length === 0) {
      throw new BadRequestException('No updatable fields provided');
    }
    return updates;
  }

  private async assertOwnership(pocket: Pocket, userId: string): Promise<void> {
    const plan = await this.repository.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this pocket');
    }
  }

  async getTransactionsForUser(
    pocketId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ transactions: Transaction[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    const result = await this.repository.getTransactionsByPocketIdPaginated(pocketId, page, limit);
    return {
      transactions: result.transactions,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      }
    };
  }

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

    const summary = await this.repository.getPocketSummary(pocketId);
    // Balance is purely ledger-derived: sum of allocation credits minus spend
    // debits (and reallocation flows). monthly_allocation is the planning
    // ceiling — used here only for the percentage display, not for the balance.
    const remaining = summary.available;
    const percentage_remaining = pocket.monthly_allocation > 0
      ? Math.round((remaining / pocket.monthly_allocation) * 100)
      : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate() + 1;
    const dailyAverageSpend = daysInMonth > 0 ? summary.spent / now.getDate() : 0;

    const transactions = await this.repository.getTransactionsByPocketId(pocketId);
    const lastTransaction = transactions.length > 0 ? transactions[0].created_at : null;

    return {
      pocket,
      summary: {
        available: remaining,
        spent: summary.spent,
        remaining,
        percentage_remaining,
        monthly_allocation: pocket.monthly_allocation || 0,
        days_remaining: daysRemaining,
        daily_average_spend: Math.round(dailyAverageSpend * 100) / 100
      },
      recent_activity: {
        last_transaction: lastTransaction,
        transaction_count: summary.transactionCount,
        reallocation_count: summary.reallocationCount
      }
    };
  }

  async getMerchantScope(pocketId: string, userId: string): Promise<{
    pocket_id: string;
    pocket_name: string;
    pocket_kind: string;
    merchant_scope: {
      allowed_categories: string[];
      blocked_categories: string[];
      classification_mode: string;
      unclassified_handling: string;
    };
    saved_classifications: Array<{
      recipient_key: string;
      category: string;
      remember: boolean;
      created_at: string;
    }>;
  }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    const allowedCategories = this.getAllowedCategoriesForPocket(pocket);
    const blockedCategories = this.getBlockedCategoriesForPocket(pocket);

    // Classifications are stored per-user (by recipient), not per-pocket —
    // there's no pocket_id column on merchant_classifications. "Relevant to
    // this pocket" means: the user's saved classifications whose category
    // this pocket kind actually accepts.
    const allClassifications = await this.repository.getMerchantClassificationsByUserId(userId);
    const classifications = allClassifications.filter(c => allowedCategories.includes(c.category));

    return {
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      pocket_kind: pocket.kind,
      merchant_scope: {
        allowed_categories: allowedCategories,
        blocked_categories: blockedCategories,
        classification_mode: pocket.kind === 'fixed' ? 'strict' : 'permissive',
        unclassified_handling: 'ask_once'
      },
      saved_classifications: classifications.map(c => ({
        recipient_key: c.recipient_key,
        category: c.category,
        remember: c.remember,
        created_at: c.created_at
      }))
    };
  }

  private getAllowedCategoriesForPocket(pocket: Pocket): string[] {
    if (pocket.kind === 'fixed') {
      return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
    }
    return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'personal_care', 'other'];
  }

  private getBlockedCategoriesForPocket(pocket: Pocket): string[] {
    if (pocket.kind === 'fixed') {
      return ['gambling_betting', 'entertainment'];
    }
    return ['gambling_betting'];
  }

  async unlockPocket(
    pocketId: string,
    userId: string,
    body: { reason?: string; biometric_confirmed: boolean }
  ): Promise<{
    unlock: {
      pocket_id: string;
      pocket_name: string;
      original_lock_until: string | null;
      unlocked_at: string;
      days_remaining: number;
    };
    discipline_cost: {
      points_deducted: number;
      previous_score: number;
      new_score: number;
      reason: string;
    };
    transaction: {
      id: string;
      type: string;
      amount: number;
      description: string;
    };
  }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    if (!pocket.is_time_locked) {
      throw new BadRequestException('This pocket is not currently locked');
    }

    if (!body.biometric_confirmed) {
      throw new ForbiddenException('Biometric confirmation required for early unlock');
    }

    const lockUntil = pocket.lock_until ? new Date(pocket.lock_until) : null;
    if (!lockUntil || lockUntil <= new Date()) {
      throw new BadRequestException('Lock has already expired');
    }

    const daysRemaining = Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const disciplineCost = Math.ceil(daysRemaining * 0.5); // 0.5 points per day

    // Unlock the pocket
    const updatedPocket = await this.repository.updatePocket(pocketId, {
      is_time_locked: false,
      lock_until: null,
    });

    if (!updatedPocket) {
      throw new NotFoundException('Failed to unlock pocket');
    }

    // Create behavior event for the Insights activity log
    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: 'early_unlock',
      payload: {
        pocket_id: pocketId,
        days_remaining: daysRemaining,
        points_deducted: disciplineCost,
        reason: body.reason,
      },
    });

    // Apply the cost through the shared discipline-score service — the same
    // `discipline_scores` table ReallocationsService/InsightsService use, so
    // this unlock and a reallocation skip-cooldown both move the one score
    // the user sees everywhere (see discipline-score.service.ts).
    const { previousScore, newScore } = await this.disciplineScore.applyDelta(userId, -disciplineCost);

    // Create transaction record (use 'rollover' type as placeholder since 'early_unlock' is not in schema)
    const transaction = await this.repository.createTransaction({
      pocket_id: pocketId,
      amount: 0,
      type: 'rollover',
      merchant: null,
      category: null,
    });

    return {
      unlock: {
        pocket_id: pocket.id,
        pocket_name: pocket.name,
        original_lock_until: pocket.lock_until,
        unlocked_at: new Date().toISOString(),
        days_remaining: daysRemaining,
      },
      discipline_cost: {
        points_deducted: disciplineCost,
        previous_score: previousScore,
        new_score: newScore,
        reason: `early_unlock_${daysRemaining}_days`,
      },
      transaction: {
        id: transaction?.id || pocketId, // Use pocketId as fallback if transaction ID not available
        type: 'early_unlock',
        amount: 0,
        description: `Early unlock - ${daysRemaining} days remaining`,
      },
    };
  }

  async getLockStatus(pocketId: string, userId: string): Promise<{
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
  }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    const isLocked = pocket.is_time_locked && pocket.lock_until && new Date(pocket.lock_until) > new Date();

    let lockStatus = null;
    let daysRemaining = 0;
    let earlyUnlockCost = 0;

    if (isLocked && pocket.lock_until) {
      const lockUntil = new Date(pocket.lock_until);
      const now = new Date();
      daysRemaining = Math.ceil((lockUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const totalLockDays = 30; // Default lock period
      const daysElapsed = totalLockDays - daysRemaining;
      const percentageComplete = (daysElapsed / totalLockDays) * 100;
      earlyUnlockCost = Math.ceil(daysRemaining * 0.5);

      lockStatus = {
        locked_until: pocket.lock_until,
        locked_at: null, // Not tracked in current schema
        total_lock_days: totalLockDays,
        days_remaining: daysRemaining,
        days_elapsed: daysElapsed,
        percentage_complete: Math.round(percentageComplete * 10) / 10,
      };
    }

    // Calculate protected amount from the ledger, not from monthly_allocation
    const summary = await this.repository.getPocketSummary(pocketId);
    const protectedAmount = summary.available;

    return {
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      is_locked: !!isLocked,
      lock_status: lockStatus,
      protected_amount: Math.max(0, protectedAmount),
      early_unlock_cost: earlyUnlockCost,
      can_unlock: !!isLocked,
    };
  }

  async extendLock(
    pocketId: string,
    userId: string,
    body: { additional_days: number; reason?: string }
  ): Promise<{
    extension: {
      pocket_id: string;
      previous_lock_until: string | null;
      new_lock_until: string;
      days_added: number;
      total_lock_days: number;
    };
    discipline_bonus: {
      points_added: number;
      previous_score: number;
      new_score: number;
      reason: string;
    };
  }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    if (!pocket.is_time_locked) {
      throw new BadRequestException('This pocket is not currently locked');
    }

    const additionalDays = body.additional_days;
    if (additionalDays <= 0) {
      throw new BadRequestException('Additional days must be positive');
    }

    const currentLockUntil = pocket.lock_until ? new Date(pocket.lock_until) : new Date();
    const newLockUntil = new Date(currentLockUntil.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    // Calculate discipline bonus
    const disciplineBonus = Math.ceil(additionalDays * 0.2); // 0.2 points per day extended

    // Extend the lock
    const updatedPocket = await this.repository.updatePocket(pocketId, {
      lock_until: newLockUntil.toISOString(),
    });

    if (!updatedPocket) {
      throw new NotFoundException('Failed to extend lock');
    }

    // Create behavior event for the Insights activity log
    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: 'lock_extension',
      payload: {
        pocket_id: pocketId,
        days_added: additionalDays,
        points_added: disciplineBonus,
        reason: body.reason,
      },
    });

    // Apply the bonus through the shared discipline-score service (see
    // unlockPocket above and discipline-score.service.ts for why).
    const { previousScore, newScore } = await this.disciplineScore.applyDelta(userId, disciplineBonus);

    return {
      extension: {
        pocket_id: pocket.id,
        previous_lock_until: pocket.lock_until,
        new_lock_until: newLockUntil.toISOString(),
        days_added: additionalDays,
        total_lock_days: Math.ceil((newLockUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      },
      discipline_bonus: {
        points_added: disciplineBonus,
        previous_score: previousScore,
        new_score: newScore,
        reason: `lock_extension_${additionalDays}_days`,
      },
    };
  }
}