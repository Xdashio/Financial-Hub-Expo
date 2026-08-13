import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PocketUpdateInputSchema, SubPocketCreateInputSchema, RunwaySummary } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { RunwayService } from '../runway/runway.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';
import { Pocket, PocketUpdate, PocketInsert, Transaction, MerchantClassification } from '../../database/database.types';
import { getAllowedCategoriesForPocket, getBlockedCategoriesForPocket, isEssentialPocket } from '../../common/pocket-rules';
import { v4 as uuidv4 } from 'uuid';

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
    // Top-level pockets only — sub-pockets (audit_team.md item 10) share
    // the parent's plan_id but are surfaced via GET /pockets/:id/sub-pockets
    // instead, nested under their parent. Using the unfiltered
    // getPocketsByPlanId here would double-list them on the home screen and
    // double-count their allocation in the freelancer daily-cap math below.
    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);

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

  /**
   * Create a new pocket for the user's active plan.
   * Enforces max 6 pockets limit per plan to prevent cognitive overload.
   */
  async createForUser(userId: string, input: unknown): Promise<Pocket> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    // Check pocket count limit (max 6)
    const existingPockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    if (existingPockets.length >= 6) {
      throw new BadRequestException('Maximum of 6 pockets allowed. Delete or merge existing pockets first.');
    }

    // Basic validation for top-level pocket creation
    const data = input as any;
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      throw new BadRequestException('Pocket name is required');
    }

    // Default to spendable kind if not specified
    const kind = data.kind || 'spendable';
    const pocketId = uuidv4();

    const pocketData: PocketInsert = {
      id: pocketId,
      plan_id: plan.id,
      name: data.name,
      kind,
      category: data.category || null,
      monthly_allocation: data.monthlyAllocation || 0,
      daily_cap: kind === 'spendable' ? (data.dailyCap ?? null) : null,
      is_time_locked: false,
      lock_until: null,
      parent_pocket_id: null,
    };

    const created = await this.repository.createPocket(pocketData);
    if (!created) {
      throw new BadRequestException('Failed to create pocket');
    }

    return created;
  }

  /**
   * Delete a pocket with balance redistribution to other pockets.
   * - Cannot delete time-locked pockets
   * - Cannot delete if it has balance (must redistribute first)
   * - Cannot delete if it's the only pocket remaining
   */
  async deleteForUser(pocketId: string, userId: string): Promise<{ deleted: boolean; redistributed?: { toPocketId: string; amount: number }[] }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    // Cannot delete time-locked pockets
    if (pocket.is_time_locked) {
      throw new BadRequestException('Cannot delete a time-locked pocket. Unlock it first.');
    }

    // Cannot delete if it's the only pocket
    const plan = await this.repository.getPlanById(pocket.plan_id);
    const allPockets = await this.repository.getTopLevelPocketsByPlanId(pocket.plan_id);
    if (allPockets.length <= 1) {
      throw new BadRequestException('Cannot delete the only pocket. You need at least one pocket.');
    }

    // Check balance
    const summary = await this.repository.getPocketSummary(pocketId);
    if (summary.available > 0) {
      throw new BadRequestException('Pocket has balance. Reallocate the money to another pocket before deleting.');
    }

    // Delete the pocket
    await this.repository.deletePocket(pocketId);

    return { deleted: true };
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

  /**
   * Creates a sub-pocket nested one level under `parentId` (audit_team.md
   * item 10 — foundational layer for item 9's loan-purpose sub-pockets).
   * A sub-pocket is an ordinary pocket row with `parent_pocket_id` set, so
   * every existing ledger/cap/rollover/merchant-scope code path (which only
   * ever looks at `kind`/`category`) works on it unmodified.
   *
   * Rules enforced here (not in the DB, since they need sibling/parent
   * context a CHECK constraint can't see):
   * - Depth is capped at one level: you can't create a sub-pocket under a
   *   pocket that is itself already a sub-pocket.
   * - The sub-pocket inherits the parent's `kind` — a sub-pocket of a
   *   Savings pocket is itself `savings`, etc. — so pocket-rules.ts and
   *   spend checks treat it exactly like any other pocket of that kind.
   * - The new sub-pocket's monthlyAllocation, combined with existing
   *   siblings, cannot exceed the parent's own monthlyAllocation: siblings
   *   are meant to divide the parent's planning ceiling, not multiply it.
   */
  async createSubPocket(parentId: string, userId: string, input: unknown): Promise<Pocket> {
    const result = SubPocketCreateInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const parsed = result.data;

    const parent = await this.repository.getPocketById(parentId);
    if (!parent) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(parent, userId);

    if (parent.parent_pocket_id) {
      throw new BadRequestException('Sub-pockets cannot themselves have sub-pockets (max depth of one level)');
    }

    const siblings = await this.repository.getSubPocketsByParentId(parentId);
    const siblingTotal = siblings.reduce((sum, p) => sum + p.monthly_allocation, 0);
    if (siblingTotal + parsed.monthlyAllocation > parent.monthly_allocation + 0.01) {
      throw new BadRequestException(
        `Sub-pockets would total KSh ${round2(siblingTotal + parsed.monthlyAllocation)}, which exceeds the parent pocket's KSh ${parent.monthly_allocation} allocation`,
      );
    }

    const insert: PocketInsert = {
      plan_id: parent.plan_id,
      name: parsed.name,
      kind: parent.kind,
      category: parsed.category ?? null,
      is_time_locked: false,
      lock_until: null,
      monthly_allocation: parsed.monthlyAllocation,
      daily_cap: null,
      parent_pocket_id: parent.id,
    };

    const created = await this.repository.createPocket(insert);
    if (!created) {
      throw new Error('Failed to create sub-pocket');
    }
    return created;
  }

  async getSubPocketsForUser(parentId: string, userId: string): Promise<(Pocket & { available_balance: number })[]> {
    const parent = await this.repository.getPocketById(parentId);
    if (!parent) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(parent, userId);

    const children = await this.repository.getSubPocketsByParentId(parentId);
    return Promise.all(
      children.map(async (pocket) => {
        const summary = await this.repository.getPocketSummary(pocket.id);
        return { ...pocket, available_balance: summary.available };
      }),
    );
  }

  /**
   * Deletes a sub-pocket. Refuses to delete a top-level pocket through this
   * path (use plan retake for that) and refuses to delete a sub-pocket that
   * still holds ledger balance — money-safe by default, matching the rest
   * of the app (see plan-redistribution.ts): the caller must move the
   * balance out (a reallocation to the parent or a sibling) before the
   * sub-pocket itself can go away.
   */
  async deleteSubPocket(id: string, userId: string): Promise<void> {
    const pocket = await this.repository.getPocketById(id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    if (!pocket.parent_pocket_id) {
      throw new BadRequestException('Only sub-pockets can be deleted this way');
    }

    const summary = await this.repository.getPocketSummary(id);
    if (Math.abs(summary.available) > 0.01) {
      throw new BadRequestException(
        `This pocket still holds KSh ${round2(summary.available)} — move the balance out before deleting it`,
      );
    }

    await this.repository.deletePocket(id);
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
      pocket_id: string | null;
      remember: boolean;
      created_at: string;
    }>;
  }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    const allowedCategories = getAllowedCategoriesForPocket(pocket);
    const blockedCategories = getBlockedCategoriesForPocket(pocket);

    // Prefer classifications pinned to this pocket; fall back to category-
    // compatible ones so merchant-scope still shows useful history after
    // retakes that replaced pocket ids (ON DELETE SET NULL).
    const allClassifications = await this.repository.getMerchantClassificationsByUserId(userId);
    const classifications = allClassifications.filter(
      (c) =>
        c.pocket_id === pocket.id ||
        (c.pocket_id == null && allowedCategories.includes(c.category)),
    );

    return {
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      pocket_kind: pocket.kind,
      merchant_scope: {
        allowed_categories: allowedCategories,
        blocked_categories: blockedCategories,
        classification_mode: isEssentialPocket(pocket) ? 'strict' : 'permissive',
        unclassified_handling: 'ask_once'
      },
      saved_classifications: classifications.map(c => ({
        recipient_key: c.recipient_key,
        category: c.category,
        pocket_id: c.pocket_id,
        remember: c.remember,
        created_at: c.created_at
      }))
    };
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
        previous_score: previousScore === null ? 0 : previousScore,
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
        previous_score: previousScore === null ? 0 : previousScore,
        new_score: newScore,
        reason: `lock_extension_${additionalDays}_days`,
      },
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}