import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PocketUpdateInputSchema, SubPocketCreateInputSchema, SubPocketRebalanceInputSchema, RunwaySummary } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { RunwayService } from '../runway/runway.service';
import { DailyAllocationService } from '../daily-allocation/daily-allocation.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';
import { utcDayBounds } from '../rollover/rollover-planner';
import { Pocket, PocketUpdate, PocketInsert, Transaction, MerchantClassification } from '../../database/database.types';
import { getAllowedCategoriesForPocket, getBlockedCategoriesForPocket, isEssentialPocket } from '../../common/pocket-rules';
import { v4 as uuidv4 } from 'uuid';
import { toCamelCaseResponse, toCamelCaseResponseArray } from '../../common/case-transform';

// A pocket's lock may be extended at most once per lock term — from when it
// was locked (pocket.created_at, since pockets are locked at creation) up
// until EXTENSION_BLACKOUT_DAYS days before it unlocks. Without this bound,
// extendLock could be called repeatedly (additional_days has no upper
// limit) to farm unlimited discipline bonus, or called in the final days
// before maturity purely to bank a bonus with no real added commitment.
const EXTENSION_BLACKOUT_DAYS = 7;

@Injectable()
export class PocketsService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
    private readonly runway: RunwayService,
    private readonly dailyAllocation: DailyAllocationService,
  ) {}

  async getAllForUser(
    userId: string,
  ): Promise<(Pocket & { available_balance: number; has_sub_pockets: boolean; today_remaining?: number; spent: number })[]> {
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
    // spent is exposed directly from the ledger (sum of type: 'spend' rows
    // only) rather than left for callers to back-compute as
    // monthly_allocation - available_balance — that subtraction silently
    // folds in the nightly rollover sweep too (which drains available_balance
    // without any real spend happening), so a disciplined daily-cap saver
    // whose rollover credits have been quietly banking to Savings would
    // read as having "spent" money they never touched. See insights.tsx's
    // budget-comparison chart, which was doing exactly that subtraction.
    const enriched = await Promise.all(
      pockets.map(async (pocket) => {
        const summary = await this.repository.getPocketSummary(pocket.id);
        const subPockets = await this.repository.getSubPocketsByParentId(pocket.id);
        return { 
          ...pocket, 
          available_balance: summary.available,
          spent: summary.spent,
          has_sub_pockets: subPockets.length > 0
        };
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

    // Daily-budget plans (including freelancer): available_balance is a
    // whole-cycle ledger figure — allocation lands as one lump sum and
    // only drains toward "today's slice" as nightly rollover sweeps run
    // (see rollover.service.ts), so right after income lands, or mid-cycle
    // before rollover has caught up, available_balance can sit far above
    // daily_cap. Home and any other "today" surface must not present that
    // whole-cycle number as if it were today's spendable amount — they
    // need spend actually made *today* to work out what's left of today's
    // cap specifically. Computed here (not on the client) so every surface
    // agrees with the same number spend.service.ts's cap-check already
    // uses (see getDailyCapPreview).
    if (plan.type === 'daily') {
      const cappedPocketIds = enriched
        .filter((p) => p.kind === 'spendable' && (p.daily_cap ?? 0) > 0)
        .map((p) => p.id);
      if (cappedPocketIds.length > 0) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const { startIso, endIsoExclusive } = utcDayBounds(todayIso);
        const spentTodayByPocket = await this.repository.getSpendTotalsByPocketBetween(
          cappedPocketIds,
          startIso,
          endIsoExclusive,
        );
        for (const pocket of enriched) {
          if (pocket.kind !== 'spendable' || !((pocket.daily_cap ?? 0) > 0)) continue;
          const spentToday = spentTodayByPocket.get(pocket.id) ?? 0;
          const capLeft = Math.max(0, (pocket.daily_cap ?? 0) - spentToday);
          // Never show "today" money the pocket doesn't actually have —
          // if the ledger balance has already run dry this cycle, today's
          // remaining can't exceed it even though the cap math alone
          // would allow more.
          (pocket as any).today_remaining = Math.round(Math.min(capLeft, pocket.available_balance) * 100) / 100;
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
    const monthlyAllocation = data.monthlyAllocation || 0;
    const pocketId = uuidv4();

    // Allocation integrity (audit_team.md item 4/5, part 1): nothing
    // previously checked that a newly created pocket's allocation, added to
    // every existing top-level pocket's allocation, still fits within the
    // plan's income. onboarding builds a set of pockets that sums correctly
    // by construction (see pocket-provisioning.ts), but this endpoint let a
    // user silently push the plan's total allocation past 100% of income
    // with no warning anywhere — the "you're overspending" case Viktor's
    // audit note called out, just at plan-allocation level rather than at
    // spend time.
    this.assertAllocationWithinPlan(plan, existingPockets, monthlyAllocation);

    const pocketData: PocketInsert = {
      id: pocketId,
      plan_id: plan.id,
      name: data.name,
      kind,
      category: data.category || null,
      monthly_allocation: monthlyAllocation,
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
   * Rejects a pocket allocation that would push the plan's total top-level
   * allocation past its known income. `plan.expected_income_amount` is set
   * from `OnboardingInput.incomeAmount` for every plan (see
   * onboarding.service.ts), so it's a reliable ceiling — not just a surplus-
   * detection convenience field (item 1) — even though this is the first
   * place that reads it for that purpose. No-op if the plan predates that
   * field (`null`) rather than blocking pocket creation on old data.
   */
  private assertAllocationWithinPlan(
    plan: { expected_income_amount: number | null },
    existingPockets: Pocket[],
    proposedAllocation: number,
  ): void {
    if (plan.expected_income_amount == null) return;

    const currentTotal = existingPockets.reduce((sum, p) => sum + p.monthly_allocation, 0);
    const newTotal = currentTotal + proposedAllocation;
    const EPSILON = 0.01;

    if (newTotal > plan.expected_income_amount + EPSILON) {
      const over = round2(newTotal - plan.expected_income_amount);
      throw new BadRequestException(
        `This pocket would push your plan's total allocation to KSh ${round2(newTotal)}, ` +
        `KSh ${over} over your income of KSh ${round2(plan.expected_income_amount)}. ` +
        `Reduce this pocket's amount or lower another pocket's allocation first.`,
      );
    }
  }

  /**
   * Allocation summary for the active plan (audit_team.md item 4/5, part 1):
   * how much of the user's income is currently assigned to pockets, and how
   * much is left over. `isFullyAllocated` is true once every shilling of
   * income has a pocket — under-allocation is fine (unassigned surplus),
   * this only exists to let the client show "KSh X still unallocated"
   * rather than the plan silently drifting away from 100%.
   */
  async getAllocationSummaryForUser(userId: string): Promise<{
    plan_income: number | null;
    total_allocated: number;
    unallocated: number;
    is_fully_allocated: boolean;
    is_over_allocated: boolean;
  }> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const totalAllocated = round2(pockets.filter(p => p.kind !== 'loan').reduce((sum, p) => sum + p.monthly_allocation, 0));
    const planIncome = plan.expected_income_amount;
    const unallocated = planIncome != null ? round2(planIncome - totalAllocated) : 0;

    return {
      plan_income: planIncome,
      total_allocated: totalAllocated,
      unallocated,
      is_fully_allocated: planIncome != null && Math.abs(unallocated) <= 0.01,
      is_over_allocated: planIncome != null && unallocated < -0.01,
    };
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
   * - `splitPercentage` (010_sub_pocket_split_percentage.sql), combined
   *   with existing siblings, cannot exceed 100 — siblings divide the
   *   parent's allocation, not multiply it. `monthly_allocation` is a
   *   derived cache (parent's * splitPercentage / 100), recomputed here
   *   and again whenever a rebalance changes the percentage.
   *
   * A freshly created sub-pocket starts at a zero ledger balance — money
   * only flows in via the next income event's auto-split (income.service.ts
   * calculateAllocationsBasedOnProportions) or an explicit rebalance
   * (rebalanceSubPockets below). Creation itself doesn't move money, so it
   * never needs the shortfall/partial-fill confirmation a rebalance can.
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

    // Sub-pockets are only allowed for spendable and loan pockets
    if (parent.kind === 'savings' || parent.kind === 'fixed') {
      throw new BadRequestException(`Sub-pockets are not supported for ${parent.kind} pockets`);
    }

    const siblings = await this.repository.getSubPocketsByParentId(parentId);
    const siblingPercentTotal = siblings.reduce((sum, p) => sum + (p.split_percentage || 0), 0);
    if (siblingPercentTotal + parsed.splitPercentage > 100 + 0.01) {
      throw new BadRequestException(
        `Sub-pockets would total ${round2(siblingPercentTotal + parsed.splitPercentage)}% of the parent pocket, which exceeds 100%`,
      );
    }

    const insert: PocketInsert = {
      plan_id: parent.plan_id,
      name: parsed.name,
      kind: parent.kind,
      category: parsed.category ?? null,
      is_time_locked: false,
      lock_until: null,
      split_percentage: parsed.splitPercentage,
      monthly_allocation: round2((parent.monthly_allocation * parsed.splitPercentage) / 100),
      daily_cap: null,
      parent_pocket_id: parent.id,
    };

    let created: Pocket | null;
    try {
      created = await this.repository.createPocket(insert);
    } catch (err) {
      // Translate a DB-level constraint violation into a clear 400 instead
      // of letting Nest's default filter turn the raw Postgres error into
      // an opaque 500 — this is what was happening for sub-pockets of a
      // Loan pocket before 012_loan_subpocket_constraint_fix.sql (kind
      // inherited as 'loan' but no repayment_schedule/due_day, tripping
      // loan_schedule_only_for_loans / loan_due_day_only_for_loans). Any
      // other future CHECK/FK violation on this insert now surfaces the
      // same way instead of 500ing.
      const code = (err as { code?: string })?.code;
      if (code === '23514' || code === '23503' || code === '23502') {
        throw new BadRequestException('Could not create sub-pocket: the request conflicts with a database rule for this pocket type.');
      }
      throw err;
    }
    if (!created) {
      throw new Error('Failed to create sub-pocket');
    }
    return created;
  }

  /**
   * Bulk-adjusts a sibling set's `splitPercentage` in one call — backs the
   * mobile rebalance bottom sheet's multi-slider UI. `anchorPocketId` is any
   * pocket in the family (the parent itself, or one of its sub-pockets);
   * the shared parent is resolved from it.
   *
   * Unlike creation, a rebalance moves real ledger money immediately (per
   * product decision — editing a split reshuffles current balances, not
   * just future income events):
   * - Siblings whose percentage is *decreasing* are processed first: the
   *   difference between their current balance and their new target
   *   (parent's monthly_allocation * newPct / 100) flows back to the
   *   parent's reserved balance.
   * - Siblings whose percentage is *increasing* are funded from whatever
   *   the parent now has available (its own reserved balance, topped up by
   *   any money just freed by the decreases above in this same call).
   * - If that's not enough to fully fund every increase, the shortfall is
   *   returned (`applied: false`) so the client can show "needs KSh X more
   *   than available — apply what we can now and catch up next income
   *   event?" without the caller needing a second round-trip to compute the
   *   number itself. Passing `confirmPartial: true` accepts that: increases
   *   are funded proportionally up to what's available, the *requested*
   *   percentages are still saved as the new target either way, and the
   *   remaining gap closes naturally over subsequent income events (each
   *   one auto-splits toward the stored percentage, same as any other
   *   sub-pocket funding).
   */
  async rebalanceSubPockets(
    anchorPocketId: string,
    userId: string,
    input: unknown,
  ): Promise<
    | { applied: true; partial: boolean; fundedAmount: number; shortfall: number; pockets: (Pocket & { available_balance: number })[] }
    | { applied: false; shortfall: number; requiresConfirmation: true }
  > {
    const result = SubPocketRebalanceInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const parsed = result.data;

    const anchor = await this.repository.getPocketById(anchorPocketId);
    if (!anchor) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(anchor, userId);

    const parent = anchor.parent_pocket_id ? await this.repository.getPocketById(anchor.parent_pocket_id) : anchor;
    if (!parent) {
      throw new NotFoundException('Parent pocket not found');
    }

    const siblings = await this.repository.getSubPocketsByParentId(parent.id);
    const siblingIds = new Set(siblings.map((s) => s.id));
    for (const split of parsed.splits) {
      if (!siblingIds.has(split.pocketId)) {
        throw new BadRequestException(`${split.pocketId} is not a sub-pocket of this parent`);
      }
    }

    const requestedByPocketId = new Map(parsed.splits.map((s) => [s.pocketId, s.splitPercentage]));
    const newPercentages = siblings.map((s) => ({
      pocket: s,
      oldPercentage: s.split_percentage || 0,
      newPercentage: requestedByPocketId.get(s.id) ?? (s.split_percentage || 0),
    }));

    const totalPercentage = newPercentages.reduce((sum, p) => sum + p.newPercentage, 0);
    if (totalPercentage > 100 + 0.01) {
      throw new BadRequestException(
        `Sub-pockets would total ${round2(totalPercentage)}% of the parent pocket, which exceeds 100%`,
      );
    }

    // Current ledger balances, fetched once up front.
    const [parentSummary, siblingSummaries] = await Promise.all([
      this.repository.getPocketSummary(parent.id),
      Promise.all(newPercentages.map((p) => this.repository.getPocketSummary(p.pocket.id))),
    ]);
    const balanceByPocketId = new Map(newPercentages.map((p, i) => [p.pocket.id, siblingSummaries[i].available]));

    const decreasing = newPercentages.filter((p) => p.newPercentage < p.oldPercentage - 0.001);
    const increasing = newPercentages.filter((p) => p.newPercentage > p.oldPercentage + 0.001);

    // Free up money from shrinking siblings first.
    let parentAvailable = parentSummary.available;
    const transactions: { pocket_id: string; amount: number; type: 'reallocation_in' | 'reallocation_out' }[] = [];
    for (const p of decreasing) {
      const target = round2((parent.monthly_allocation * p.newPercentage) / 100);
      const currentBalance = balanceByPocketId.get(p.pocket.id) || 0;
      const freed = Math.max(0, round2(currentBalance - target));
      if (freed > 0) {
        transactions.push({ pocket_id: p.pocket.id, amount: -freed, type: 'reallocation_out' });
        transactions.push({ pocket_id: parent.id, amount: freed, type: 'reallocation_in' });
        parentAvailable = round2(parentAvailable + freed);
      }
    }

    // Fund growing siblings from what the parent now has available.
    const growthNeeds = increasing.map((p) => {
      const target = round2((parent.monthly_allocation * p.newPercentage) / 100);
      const currentBalance = balanceByPocketId.get(p.pocket.id) || 0;
      return { pocket: p.pocket, needed: Math.max(0, round2(target - currentBalance)) };
    });
    const totalNeeded = round2(growthNeeds.reduce((sum, g) => sum + g.needed, 0));

    if (totalNeeded > parentAvailable + 0.01 && !parsed.confirmPartial) {
      // Nothing committed yet — this is a dry-run check, so it's safe to
      // return without writing any of the `decreasing` transfers computed
      // above either. The client re-sends the same request with
      // confirmPartial: true once the user accepts the partial-fill offer.
      return { applied: false, shortfall: round2(totalNeeded - parentAvailable), requiresConfirmation: true };
    }

    const fundingScale = totalNeeded > 0 ? Math.min(1, parentAvailable / totalNeeded) : 1;
    for (const g of growthNeeds) {
      const funded = round2(g.needed * fundingScale);
      if (funded > 0) {
        transactions.push({ pocket_id: parent.id, amount: -funded, type: 'reallocation_out' });
        transactions.push({ pocket_id: g.pocket.id, amount: funded, type: 'reallocation_in' });
      }
    }

    if (transactions.length > 0) {
      await this.repository.createTransactions(transactions);
    }

    // Persist the requested percentages (and refreshed cache) regardless of
    // whether funding was full or partial — a partial fill's remaining gap
    // closes over subsequent income events, which always split toward the
    // stored percentage (see income.service.ts).
    await Promise.all(
      newPercentages
        .filter((p) => Math.abs(p.newPercentage - p.oldPercentage) > 0.001)
        .map((p) =>
          this.repository.updatePocket(p.pocket.id, {
            split_percentage: p.newPercentage,
            monthly_allocation: round2((parent.monthly_allocation * p.newPercentage) / 100),
          }),
        ),
    );

    const updatedSiblings = await this.repository.getSubPocketsByParentId(parent.id);
    const enriched = await Promise.all(
      updatedSiblings.map(async (pocket) => {
        const summary = await this.repository.getPocketSummary(pocket.id);
        return { ...pocket, available_balance: summary.available };
      }),
    );

    return {
      applied: true,
      partial: totalNeeded > parentAvailable + 0.01,
      fundedAmount: round2(Math.min(totalNeeded, parentAvailable)),
      shortfall: Math.max(0, round2(totalNeeded - parentAvailable)),
      pockets: enriched,
    };
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
      today_remaining?: number;
      spent_today?: number;
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

    // Freelancer + daily plans recompute the spendable daily_cap LIVE against
    // the current runway (see docs/FREELANCER_RUNWAY.md and getAllForUser).
    // The home screen already does this, so a detail screen that reads the
    // raw stored pocket.daily_cap would show a *different* cap for the very
    // same pocket — e.g. home says "KSh 6,429 daily cap" while this screen
    // says "KSh 1,484 daily budget" on the identical pocket. Apply the exact
    // same adaptive cap here so every surface agrees on the one number that
    // drives today's pacing (and the today_remaining math below inherits it).
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (plan && plan.income_pattern === 'freelancer' && plan.type === 'daily' && pocket.kind === 'spendable') {
      const runwaySummary = await this.runway.getRunwayForPlan(userId, plan);
      const caps = computeSpendableDailyCaps([pocket], runwaySummary);
      const adaptiveCap = caps.get(pocket.id);
      if (adaptiveCap !== undefined) {
        pocket.daily_cap = adaptiveCap;
      }
    }

    const summary = await this.repository.getPocketSummary(pocketId);
    // Balance is purely ledger-derived: sum of allocation credits minus spend
    // debits (and reallocation flows). monthly_allocation is the planning
    // ceiling — used here only for the percentage display, not for the balance.
    const remaining = summary.available;

    // Daily-budget spendable pockets (pocket.daily_cap set) roll unspent
    // balance to Savings every midnight, so `remaining` *trends toward*
    // "left today" over the course of a cycle — but right after income
    // lands, or on any day before that night's rollover has run, it can
    // still hold the whole cycle's money. It is never a reliable stand-in
    // for "left today" on its own. today_remaining computes that
    // explicitly from what's actually been spent today (same math
    // pockets.service.ts getAllForUser and spend.service.ts's cap-check
    // already use), clamped to what's actually left in the ledger.
    let todayRemaining: number | undefined;
    let spentToday: number | undefined;
    const hasDailyCap = (pocket.daily_cap ?? 0) > 0;
    if (hasDailyCap && pocket.kind === 'spendable') {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { startIso, endIsoExclusive } = utcDayBounds(todayIso);
      const totals = await this.repository.getSpendTotalsByPocketBetween([pocketId], startIso, endIsoExclusive);
      spentToday = totals.get(pocketId) ?? 0;
      const capLeft = Math.max(0, (pocket.daily_cap ?? 0) - spentToday);
      todayRemaining = Math.round(Math.min(capLeft, remaining) * 100) / 100;
    }

    // Use today_remaining as the percentage-bar numerator whenever this
    // pocket has a daily cap — dividing the whole-cycle `remaining` by the
    // monthly ceiling produced a near-empty-looking bar even on a day the
    // user is comfortably on pace (e.g. $45 left of a $60 daily cap showed
    // as ~2.5% instead of 75%) — the opposite signal a daily-cap UX needs
    // to reinforce good pacing. monthly_allocation remains correct for
    // structured pockets (no cap, no today_remaining).
    const percentageBase = pocket.daily_cap ?? pocket.monthly_allocation;
    const percentageNumerator = hasDailyCap ? (todayRemaining ?? remaining) : remaining;
    const percentage_remaining = percentageBase > 0
      ? Math.round((percentageNumerator / percentageBase) * 100)
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
        daily_average_spend: Math.round(dailyAverageSpend * 100) / 100,
        today_remaining: todayRemaining,
        spent_today: spentToday,
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
    body: { reason?: string; biometric_confirmed: boolean; goal_reached?: boolean }
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
    // Goal-reached waiver: no discipline cost if user has reached their savings goal
    const disciplineCost = body.goal_reached ? 0 : Math.ceil(daysRemaining * 0.5); // 0.5 points per day

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
      type: body.goal_reached ? 'goal_reached_unlock' : 'early_unlock',
      payload: {
        pocket_id: pocketId,
        days_remaining: daysRemaining,
        points_deducted: disciplineCost,
        reason: body.reason,
        goal_reached: body.goal_reached,
      },
    });

    // Apply the cost through the shared discipline-score service — the same
    // `discipline_scores` table ReallocationsService/InsightsService use, so
    // this unlock and a reallocation skip-cooldown both move the one score
    // the user sees everywhere (see discipline-score.service.ts).
    // If goal_reached is true, no cost is applied (disciplineCost is 0).
    let previousScore: number | null = null;
    let newScore: number | null = null;
    if (disciplineCost > 0) {
      const result = await this.disciplineScore.applyDelta(userId, -disciplineCost);
      previousScore = result.previousScore;
      newScore = result.newScore;
    } else {
      // Still fetch current score for response consistency
      const currentScore = await this.disciplineScore.getCurrentScore(userId);
      previousScore = currentScore ?? 0;
      newScore = currentScore ?? 0;
    }

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

    // Reject rather than silently zero-bonus, so the response is honest
    // about why nothing happened — mirrors the "Already retaken this
    // month" pattern used for the behavior check-in.
    if (pocket.lock_until) {
      const blackoutStart = new Date(
        new Date(pocket.lock_until).getTime() - EXTENSION_BLACKOUT_DAYS * 24 * 60 * 60 * 1000
      );
      if (Date.now() >= blackoutStart.getTime()) {
        throw new BadRequestException(
          `This lock can only be extended more than ${EXTENSION_BLACKOUT_DAYS} days before it unlocks (${pocket.lock_until}).`
        );
      }
    }

    const priorExtensions = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      ['lock_extension'],
      pocket.created_at,
    );
    const alreadyExtended = priorExtensions.some((e) => (e.payload as any)?.pocket_id === pocketId);
    if (alreadyExtended) {
      throw new BadRequestException('This lock has already been extended once. It can only be extended once per lock term.');
    }

    const currentLockUntil = pocket.lock_until ? new Date(pocket.lock_until) : new Date();
    const newLockUntil = new Date(currentLockUntil.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    // Extend the lock
    const updatedPocket = await this.repository.updatePocket(pocketId, {
      lock_until: newLockUntil.toISOString(),
    });

    if (!updatedPocket) {
      throw new NotFoundException('Failed to extend lock');
    }

    // Create behavior event for the Insights activity log. Extending a lock
    // is still worth recording (it's a real thing the user did), but it no
    // longer carries a discipline_score bonus — see discipline_bonus below.
    // points_added stays 0 in the payload rather than being omitted, so any
    // historical event scanning code doesn't have to special-case its shape.
    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: 'lock_extension',
      payload: {
        pocket_id: pocketId,
        days_added: additionalDays,
        points_added: 0,
        reason: body.reason,
      },
    });

    // Intentionally no disciplineScore.applyDelta call here. Extending a
    // lock ahead of time doesn't demonstrate the same restraint that not
    // touching a pocket during its lock term does, and it costs the user
    // nothing to do — awarding points for it was a free-points incentive
    // that didn't map to any real discipline being shown. The score stays
    // untouched; we still return a discipline_bonus object with a 0 delta
    // (rather than dropping the field) so the existing mobile response
    // shape / success message keeps working without a breaking change.
    const currentScore = await this.disciplineScore.getCurrentScore(userId);

    return {
      extension: {
        pocket_id: pocket.id,
        previous_lock_until: pocket.lock_until,
        new_lock_until: newLockUntil.toISOString(),
        days_added: additionalDays,
        total_lock_days: Math.ceil((newLockUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      },
      discipline_bonus: {
        points_added: 0,
        previous_score: currentScore === null ? 0 : currentScore,
        new_score: currentScore === null ? 0 : currentScore,
        reason: `lock_extension_${additionalDays}_days_no_bonus`,
      },
    };
  }

  // ============================================================================
  // Daily Allocation (Freelancer Runway)
  // ============================================================================

  /**
   * Get today's daily allocation for the active plan.
   * Returns the allocation with spend progress and runway info.
   */
  async getTodayDailyAllocation(userId: string): Promise<{
    allocation: any | null;
    runway: RunwaySummary;
    spendablePockets: any[];
  }> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      return {
        allocation: null,
        runway: { applicable: false },
        spendablePockets: [],
      };
    }

    const today = new Date();
    const allocation = await this.dailyAllocation.getTodayAllocation(plan.id);

    // Get runway summary
    const runway = await this.runway.getRunwayForPlan(userId, plan);

    // Get spendable pockets with their current daily caps
    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const spendablePockets = pockets.filter(p => p.kind === 'spendable');

    const caps = computeSpendableDailyCaps(spendablePockets, runway);
    const todayIso = new Date().toISOString().slice(0, 10);
    const { startIso, endIsoExclusive } = utcDayBounds(todayIso);
    const spentTodayByPocket = await this.repository.getSpendTotalsByPocketBetween(
      spendablePockets.map((p) => p.id),
      startIso,
      endIsoExclusive,
    );
    const enrichedSpendable = await Promise.all(
      spendablePockets.map(async (p) => {
        const summary = await this.repository.getPocketSummary(p.id);
        const daily_cap = caps.get(p.id) ?? p.daily_cap;
        // Same today_remaining logic as getAllForUser: available_balance is
        // a whole-cycle ledger figure, not "left today" — don't let this
        // screen's per-pocket progress bars treat it that way either.
        const spentToday = spentTodayByPocket.get(p.id) ?? 0;
        const capLeft = Math.max(0, (daily_cap ?? 0) - spentToday);
        return {
          ...p,
          daily_cap,
          available_balance: summary.available,
          today_remaining: daily_cap ? Math.round(Math.min(capLeft, summary.available) * 100) / 100 : undefined,
        };
      })
    );

    return toCamelCaseResponse({
      allocation,
      runway,
      spendablePockets: enrichedSpendable,
    });
  }

  /**
   * Get daily allocation history for a date range.
   */
  async getDailyAllocationHistory(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    const allocations = await this.repository.getDailyAllocationsByPlanIdAndDateRange(plan.id, startDate, endDate);
    return toCamelCaseResponseArray(allocations);
  }

  /**
   * Manually trigger today's daily allocation (for testing/debugging).
   */
  async triggerDailyAllocation(userId: string): Promise<any> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    if (plan.income_pattern !== 'freelancer' || plan.type !== 'daily') {
      throw new BadRequestException('Daily allocation only applies to freelancer daily plans');
    }

    const dailyBudget = await this.dailyAllocation.getDailyBudget(plan.id);
    const today = new Date();
    const result = await this.dailyAllocation.createDailyAllocation(userId, plan.id, dailyBudget, today);
    return toCamelCaseResponse(result);
  }

  /**
   * Manually close today's daily allocation (for testing/debugging).
   */
  async closeDailyAllocation(userId: string, actualSpend?: number): Promise<any> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      throw new NotFoundException('No active plan found');
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const allocation = await this.repository.getDailyAllocationByPlanIdAndDate(plan.id, dateStr);

    if (!allocation) {
      throw new NotFoundException('No daily allocation found for today');
    }

    if (allocation.status === 'closed') {
      throw new BadRequestException('Daily allocation already closed');
    }

    // If actualSpend not provided, calculate from transactions
    let spend = actualSpend;
    if (spend === undefined) {
      spend = await this.repository.getActualSpendForAllocation(allocation.id);
    }

    const result = await this.dailyAllocation.closeDailyAllocation(allocation.id, spend);
    return toCamelCaseResponse(result);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}