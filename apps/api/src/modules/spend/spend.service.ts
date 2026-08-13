import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SpendCheckDto } from './dto/spend-check.dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { Pocket } from '../../database/database.types';
import { getAllowedCategoriesForPocket, getBlockedCategoriesForPocket, isEssentialPocket, isReviewableBlock } from '../../common/pocket-rules';
import { getMerchantCategoryLabel } from '@financial-hub/shared';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import {
  CAP_DAILY_OVERSPEND,
  CAP_ESSENTIAL_OVERRIDE,
  CAP_GAMBLING_BLOCKED_ATTEMPT,
  EVENT_DAILY_OVERSPEND,
  EVENT_ESSENTIAL_OVERRIDE,
  EVENT_GAMBLING_BLOCKED_ATTEMPT,
  POINTS_DAILY_OVERSPEND,
  POINTS_ESSENTIAL_OVERRIDE,
  POINTS_GAMBLING_BLOCKED_ATTEMPT,
} from '../rollover/rollover.constants';
import { utcDayBounds } from '../rollover/rollover-planner';

@Injectable()
export class SpendService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
  ) {}

  async checkSpend(dto: SpendCheckDto, userId: string): Promise<{
    allowed: boolean;
    block_reason: string | null;
    blocked_category?: string;
    pocket_type?: string;
    message?: string;
    review_available?: boolean;
    suggested_category?: string;
    requires_classification?: boolean;
    recipient_key?: string;
    suggested_categories?: Array<{
      category: string;
      pocket_id: string;
      pocket_name: string;
      confidence: number;
    }>;
    // insufficient_funds context (audit_team.md item 4/5): lets the client
    // offer "adjust this pocket's allocation" and "spend anyway" alongside
    // "cancel", instead of the block being a dead end.
    shortfall?: number;
    overridable?: boolean;
    reallocation_sources?: Array<{
      pocket_id: string;
      pocket_name: string;
      available_balance: number;
    }>;
    pocket: {
      id: string;
      name: string;
      available_balance: number;
    };
  }> {
    const pocket = await this.repository.getPocketById(dto.pocket_id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertPocketOwnership(pocket, userId);

    // Time-locked pockets (e.g. a savings pocket the user locked to resist
    // impulse spending) must block spend the same way ReallocationsService
    // already blocks using one as a reallocation source. Without this check
    // spend completely bypassed the lock — the lock/unlock endpoints existed
    // and updated is_time_locked/lock_until, but nothing here ever read them.
    if (this.isTimeLocked(pocket)) {
      return {
        allowed: false,
        block_reason: 'pocket_time_locked',
        message: `${pocket.name} is time-locked and can't be spent from until it unlocks.`,
        pocket: {
          id: pocket.id,
          name: pocket.name,
          available_balance: (await this.repository.getPocketSummary(dto.pocket_id)).available,
        },
      };
    }

    // Available balance is derived purely from the ledger: allocation credits
    // minus spend debits and reallocation outflows. monthly_allocation is the
    // planning ceiling only and is never used for balance checks.
    const summary = await this.repository.getPocketSummary(dto.pocket_id);
    const availableBalance = summary.available;

    // Check if spend exceeds available balance
    if (dto.amount > availableBalance) {
      const shortfall = round2(dto.amount - availableBalance);
      const reallocationSources = await this.getReallocationSources(pocket);
      return {
        allowed: false,
        block_reason: 'insufficient_funds',
        message: `Insufficient funds. Available: ${availableBalance}, Requested: ${dto.amount}`,
        // Soft block, unlike blocked_category / pocket_time_locked: the
        // client can resubmit with `override: true` (see commitSpend) and
        // log it as a deliberate choice rather than being stuck at "no".
        shortfall,
        overridable: true,
        reallocation_sources: reallocationSources,
        pocket: {
          id: pocket.id,
          name: pocket.name,
          available_balance: availableBalance,
        },
      };
    }

    // Check merchant category against pocket type
    if (dto.category) {
      const blockedCategories = getBlockedCategoriesForPocket(pocket);
      if (blockedCategories.includes(dto.category)) {
        if (!isReviewableBlock(dto.category)) {
          await this.recordGamblingBlockedAttempt(pocket, userId, dto.category, dto.recipient_key, dto.amount);
        }
        return {
          allowed: false,
          block_reason: 'blocked_category',
          blocked_category: dto.category,
          pocket_type: pocket.kind,
          message: `${this.getCategoryDisplayName(dto.category)} can't be paid from ${pocket.name}`,
          // Bug fix (2026-08-12): this used to be `!isEssentialPocket(pocket)`,
          // which is about the POCKET (is it food/rent/etc.) and says nothing
          // about whether the CATEGORY can ever be resolved via review. That
          // made "Review and classify" a dead-end button for Savings and any
          // other non-essential, non-leisure spendable pocket (personal,
          // utilities, healthcare, education, other) whenever the blocked
          // category was gambling_betting — always-blocked, so review could
          // never actually unblock it there. isReviewableBlock checks the
          // category itself, which is what determines whether review can
          // ever succeed, independent of which pocket triggered the block.
          review_available: isReviewableBlock(dto.category),
          pocket: {
            id: pocket.id,
            name: pocket.name,
            available_balance: availableBalance,
          },
        };
      }
    }

    // If no category provided and recipient_key exists, check if classification is needed
    if (!dto.category && dto.recipient_key) {
      const classification = await this.repository.getMerchantClassification(userId, dto.recipient_key);
      if (!classification) {
        // Suggest categories based on pocket type
        const suggestedCategories = this.getSuggestedCategories(pocket);
        return {
          allowed: false,
          block_reason: 'unclassified_merchant',
          requires_classification: true,
          recipient_key: dto.recipient_key,
          suggested_categories: suggestedCategories,
          message: 'We need to sort this payment into the right pocket',
          pocket: {
            id: pocket.id,
            name: pocket.name,
            available_balance: availableBalance,
          },
        };
      }

      // Use saved classification to check if allowed
      const blockedCategories = getBlockedCategoriesForPocket(pocket);
      if (blockedCategories.includes(classification.category)) {
        if (!isReviewableBlock(classification.category)) {
          await this.recordGamblingBlockedAttempt(
            pocket,
            userId,
            classification.category,
            dto.recipient_key,
            dto.amount,
          );
        }
        return {
          allowed: false,
          block_reason: 'blocked_category',
          blocked_category: classification.category,
          pocket_type: pocket.kind,
          message: `${this.getCategoryDisplayName(classification.category)} can't be paid from ${pocket.name}`,
          review_available: isReviewableBlock(classification.category),
          pocket: {
            id: pocket.id,
            name: pocket.name,
            available_balance: availableBalance,
          },
        };
      }
    }

    // Spend is allowed
    return {
      allowed: true,
      block_reason: null,
      pocket: {
        id: pocket.id,
        name: pocket.name,
        available_balance: availableBalance,
      },
    };
  }

  // Records a simulated spend attempt. There's no PSP in this MVP, so this
  // is the closest thing to a real "spend" event: it re-runs the same
  // checkSpend validation, and only if the result is allowed does it write
  // a 'spend' transaction (the type already exists in the schema — see
  // transactions.type). This is what gives the blocked-spend screen and
  // the merchant self-classify prompt a real trigger point instead of the
  // dead-end the roadmap flagged (no UI flow ever called /spend/check).
  async commitSpend(dto: SpendCheckDto, userId: string): Promise<
    Awaited<ReturnType<SpendService['checkSpend']>> & {
      transaction_id?: string;
      idempotent_replay?: boolean;
      overridden?: boolean;
    }
  > {
    if (dto.idempotency_key) {
      const existing = await this.repository.getIdempotencyRecord(
        userId,
        'spend',
        dto.idempotency_key,
      );
      if (existing?.response) {
        return {
          ...(existing.response as any),
          idempotent_replay: true,
        };
      }
    }

    const result = await this.checkSpend(dto, userId);

    // audit_team.md item 4/5: `insufficient_funds` is a soft block — the
    // client shows "adjust allocation" / "cancel" / "spend anyway" instead
    // of a dead end (see checkSpend's `overridable`/`reallocation_sources`).
    // Only this specific block reason can be overridden; blocked_category
    // and pocket_time_locked ignore `dto.override` entirely and stay hard
    // blocks no matter what the client sends.
    const isOverride = !result.allowed && result.block_reason === 'insufficient_funds' && dto.override === true;

    if (!result.allowed && !isOverride) {
      return result;
    }

    const transaction = await this.repository.createTransaction({
      pocket_id: dto.pocket_id,
      amount: dto.amount,
      type: 'spend',
      merchant: dto.recipient_key || null,
      category: dto.category || null,
    });

    // result.pocket.available_balance was computed by checkSpend() *before*
    // this transaction was written, so it's the pre-spend balance. Re-read
    // the ledger now so the caller (and the "Spend logged" confirmation
    // modal) gets the true post-spend balance instead of a stale figure.
    // Note: the ledger clamps available balance at 0 (see
    // SupabaseRepository.getPocketSummary) rather than going negative, so
    // an overridden spend's shortfall won't show up as a negative number
    // here — it shows as 0 until the pocket is topped up by a reallocation.
    const postSpendSummary = await this.repository.getPocketSummary(dto.pocket_id);

    const pocket = await this.repository.getPocketById(dto.pocket_id);

    if (isOverride && pocket) {
      await this.recordEssentialOverride(pocket, userId, dto.amount, result.shortfall ?? 0, dto.override_reason);
    }

    // Batch 6: if this push a spendable pocket over its daily cap, emit
    // daily_overspend immediately so the heatmap/streak don't wait for
    // tomorrow's rollover catch-up.
    if (pocket) {
      await this.maybeRecordDailyOverspend(pocket, userId);
    }

    const response = {
      ...result,
      allowed: true,
      block_reason: null,
      ...(isOverride ? { overridden: true } : {}),
      pocket: {
        ...result.pocket,
        available_balance: postSpendSummary.available,
      },
      transaction_id: transaction?.id,
    };

    if (dto.idempotency_key) {
      const saved = await this.repository.saveIdempotencyRecord({
        id: uuidv4(),
        user_id: userId,
        scope: 'spend',
        idempotency_key: dto.idempotency_key,
        resource_id: transaction?.id ?? null,
        response: response as unknown as Record<string, unknown>,
      });
      if (!saved) {
        const raced = await this.repository.getIdempotencyRecord(
          userId,
          'spend',
          dto.idempotency_key,
        );
        if (raced?.response) {
          return { ...(raced.response as any), idempotent_replay: true };
        }
      }
    }

    return response;
  }

  private async maybeRecordDailyOverspend(pocket: Pocket, userId: string): Promise<void> {
    if (pocket.kind !== 'spendable') return;
    const cap = pocket.daily_cap;
    if (cap == null || cap <= 0) return;

    const todayIso = new Date().toISOString().slice(0, 10);
    const { startIso, endIsoExclusive } = utcDayBounds(todayIso);
    const existing = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_DAILY_OVERSPEND],
      startIso,
    );
    if (existing.some((e) => (e.payload as any)?.date === todayIso)) return;

    const totals = await this.repository.getSpendTotalsByPocketBetween(
      [pocket.id],
      startIso,
      endIsoExclusive,
    );
    const spentToday = totals.get(pocket.id) || 0;
    if (spentToday <= cap) return;

    // Cap monthly penalty the same way rollover does.
    const monthStart = `${todayIso.slice(0, 7)}-01T00:00:00.000Z`;
    const monthEvents = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_DAILY_OVERSPEND],
      monthStart,
    );
    let earned = 0;
    for (const event of monthEvents) {
      const deducted = (event.payload as any)?.points_deducted;
      if (typeof deducted === 'number') earned -= deducted;
    }
    const apply = Math.max(POINTS_DAILY_OVERSPEND, Math.min(0, CAP_DAILY_OVERSPEND - earned));
    if (apply !== 0) {
      await this.disciplineScore.applyDelta(userId, apply);
    }

    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: EVENT_DAILY_OVERSPEND,
      payload: {
        date: todayIso,
        pocket_id: pocket.id,
        spent: spentToday,
        daily_cap: cap,
        points_deducted: apply < 0 ? -apply : 0,
      },
    });
  }

  /**
   * Option 3 from the 2026-08-12 reconciliation: the gambling block stays
   * absolute — this never unblocks the spend, it only logs the attempt and
   * costs discipline-score points, mirroring how daily-overspend logging
   * works. Unlike overspend, we don't dedupe to once/day: every distinct
   * blocked gambling attempt is a real, low-noise signal (gambling
   * recipients are registered paybills/tills, not fuzzy-matched, so this
   * isn't going to fire on false positives), and each one should be
   * visible in the behavior_events history even if the score deduction for
   * the month is already capped out.
   */
  private async recordGamblingBlockedAttempt(
    pocket: Pocket,
    userId: string,
    category: string,
    recipientKey: string | undefined,
    amount: number,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const monthStart = `${nowIso.slice(0, 7)}-01T00:00:00.000Z`;
    const monthEvents = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_GAMBLING_BLOCKED_ATTEMPT],
      monthStart,
    );
    let earned = 0;
    for (const event of monthEvents) {
      const deducted = (event.payload as any)?.points_deducted;
      if (typeof deducted === 'number') earned -= deducted;
    }
    const apply = Math.max(
      POINTS_GAMBLING_BLOCKED_ATTEMPT,
      Math.min(0, CAP_GAMBLING_BLOCKED_ATTEMPT - earned),
    );
    if (apply !== 0) {
      await this.disciplineScore.applyDelta(userId, apply);
    }

    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: EVENT_GAMBLING_BLOCKED_ATTEMPT,
      payload: {
        date: nowIso,
        pocket_id: pocket.id,
        pocket_kind: pocket.kind,
        category,
        recipient_key: recipientKey ?? null,
        amount,
        points_deducted: apply < 0 ? -apply : 0,
      },
    });
  }

  /**
   * Ported from Flutter's discipline-score rule set (FLUTTER_TO_EXPO_PORT_GUIDE.md
   * §3, audit_team.md item 4/5): fires when a user explicitly chooses to
   * spend past a pocket's available balance instead of adjusting allocation
   * or cancelling. Capped per calendar month using the same "sum this
   * event's deductions since month start" pattern as
   * maybeRecordDailyOverspend / recordGamblingBlockedAttempt, so a genuinely
   * rough month doesn't spiral the score to zero.
   */
  private async recordEssentialOverride(
    pocket: Pocket,
    userId: string,
    amount: number,
    shortfall: number,
    reason: string | undefined,
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const monthStart = `${nowIso.slice(0, 7)}-01T00:00:00.000Z`;
    const monthEvents = await this.repository.getBehaviorEventsByTypesSince(
      userId,
      [EVENT_ESSENTIAL_OVERRIDE],
      monthStart,
    );
    let earned = 0;
    for (const event of monthEvents) {
      const deducted = (event.payload as any)?.points_deducted;
      if (typeof deducted === 'number') earned -= deducted;
    }
    const apply = Math.max(POINTS_ESSENTIAL_OVERRIDE, Math.min(0, CAP_ESSENTIAL_OVERRIDE - earned));
    if (apply !== 0) {
      await this.disciplineScore.applyDelta(userId, apply);
    }

    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: EVENT_ESSENTIAL_OVERRIDE,
      payload: {
        date: nowIso,
        pocket_id: pocket.id,
        pocket_kind: pocket.kind,
        amount,
        shortfall,
        reason: reason ?? null,
        points_deducted: apply < 0 ? -apply : 0,
      },
    });
  }

  async getBlockedReasons(pocketId: string, userId: string): Promise<{
    pocket_id: string;
    pocket_name: string;
    pocket_kind: string;
    blocked_categories: Array<{
      category: string;
      reason: string;
      can_override: boolean;
    }>;
    allowed_categories: string[];
  }> {
    const pocket = await this.repository.getPocketById(pocketId);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertPocketOwnership(pocket, userId);

    const blockedCategories = getBlockedCategoriesForPocket(pocket);
    const allowedCategories = getAllowedCategoriesForPocket(pocket);

    return {
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      pocket_kind: pocket.kind,
      blocked_categories: blockedCategories.map(category => ({
        category,
        // Same bug as review_available above: reason/can_override need to
        // account for the CATEGORY (is it always-blocked, e.g.
        // gambling_betting) as well as the pocket. Previously this only
        // branched on isEssentialPocket, which mislabeled every
        // always-blocked category from Savings/personal/utilities/
        // healthcare/education/other as "Savings protection, can override"
        // when it's actually a permanent, category-level block.
        reason: !isReviewableBlock(category)
          ? 'Blocked category — no override'
          : isEssentialPocket(pocket)
            ? 'Essential pocket protection'
            : pocket.kind === 'savings'
              ? 'Savings protection'
              : 'Discretionary category restriction',
        can_override: isReviewableBlock(category),
      })),
      allowed_categories: allowedCategories,
    };
  }

  private async assertPocketOwnership(pocket: Pocket, userId: string): Promise<void> {
    const plan = await this.repository.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this pocket');
    }
  }

  // Mirrors ReallocationsService.isTimeLocked — kept as a private duplicate
  // rather than shared for now since these two services already duplicate
  // getBlockedCategoriesForPocket the same way; worth extracting both into
  // a shared pocket-rules helper in a follow-up.
  private isTimeLocked(pocket: Pocket): boolean {
    if (!pocket.is_time_locked) return false;
    if (!pocket.lock_until) return true;
    return new Date(pocket.lock_until).getTime() > Date.now();
  }

  /**
   * Other top-level pockets in the same plan that could cover a shortfall
   * (audit_team.md item 4/5) — surfaced on `insufficient_funds` so the
   * client's "adjust allocation" option can suggest a source instead of
   * sending the user in blind to POST /reallocations. Excludes the pocket
   * itself, locked pockets (can't be a reallocation source — see
   * ReallocationsService.isTimeLocked), and anything with a zero balance.
   * Sorted richest-first and capped to a handful so the UI isn't listing
   * every pocket. A pocket holding less than the full shortfall is still
   * included — the client can combine sources or use one partially — this
   * only decides what's a plausible source at all, not how to spend it.
   */
  private async getReallocationSources(
    sourcePocket: Pocket,
  ): Promise<Array<{ pocket_id: string; pocket_name: string; available_balance: number }>> {
    const siblings = await this.repository.getTopLevelPocketsByPlanId(sourcePocket.plan_id);
    const candidates = siblings.filter(
      (p) => p.id !== sourcePocket.id && !this.isTimeLocked(p),
    );

    const withBalances = await Promise.all(
      candidates.map(async (p) => {
        const summary = await this.repository.getPocketSummary(p.id);
        return { pocket_id: p.id, pocket_name: p.name, available_balance: summary.available };
      }),
    );

    return withBalances
      .filter((p) => p.available_balance > 0)
      .sort((a, b) => b.available_balance - a.available_balance)
      .slice(0, 3)
      .map((p) => ({ ...p, available_balance: round2(p.available_balance) }));
  }

  private getCategoryDisplayName(category: string): string {
    return getMerchantCategoryLabel(category);
  }

  private getSuggestedCategories(pocket: Pocket): Array<{
    category: string;
    pocket_id: string;
    pocket_name: string;
    confidence: number;
  }> {
    // Suggest categories based on pocket type
    const suggestedCategories = getAllowedCategoriesForPocket(pocket);
    return suggestedCategories.slice(0, 3).map(category => ({
      category,
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      confidence: 0.8, // Default confidence for suggestions
    }));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}