import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SpendCheckDto } from './dto/spend-check.dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { Pocket, IdempotencyScope } from '../../database/database.types';
import { getAllowedCategoriesForPocket, getBlockedCategoriesForPocket, isEssentialPocket, isReviewableBlock } from '../../common/pocket-rules';
import { getMerchantCategoryLabel, toCents, fromCents, formatWholeKsh } from '@financial-hub/shared';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { RunwayService } from '../runway/runway.service';
import { computeSpendableDailyCaps } from '../runway/runway.calculator';
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
import { utcDayBounds, effectiveDailyCap, previewDailyCapAfterSpend } from '../rollover/rollover-planner';

@Injectable()
export class SpendService {
  // H2: the old in-process `activeSpends` set was removed. commitSpend now
  // serialises through the atomic_commit_spend RPC (migration 034), which
  // re-verifies the ledger balance under pocket/family row locks — the guard
  // holds across API instances, not just on one process.
  private readonly logger = new Logger(SpendService.name);

  constructor(
    private readonly repository: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
    private readonly runway: RunwayService,
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
    // Discloses the discipline-score cost of overriding *before* the user
    // commits to it (mirrors real overdraft disclosure — see
    // recordEssentialOverride below for where this is actually applied).
    // Surfaced as a positive number of points ("this will cost you N
    // points") even though the applied delta is negative internally.
    override_points_cost?: number;
    // Emergency-overspend preview (block_reason: 'daily_cap_exceeded'):
    // this spend is fully covered by the pocket's available_balance, but
    // it would push today's spend past the daily cap. current_daily_cap /
    // adjusted_daily_cap / days_remaining let the client show "if you
    // continue, your cap for the rest of the month drops to X" before the
    // user commits. See previewDailyCapAfterSpend.
    current_daily_cap?: number;
    adjusted_daily_cap?: number;
    days_remaining?: number;
    reallocation_sources?: Array<{
      pocket_id: string;
      pocket_name: string;
      available_balance: number;
    }>;
    // Overflow/borrow flow context (subpocket-feature-spec.md §5)
    borrow_from_parent_available?: boolean;
    parent_pocket?: {
      id: string;
      name: string;
      available_balance: number;
    };
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

    // Savings pockets never enter the insufficient_funds override flow,
    // locked or not. is_time_locked only covers a pocket the user has
    // explicitly locked — an unlocked savings pocket would otherwise sail
    // straight through to the overridable insufficient_funds branch below
    // and let a "spend anyway" push real savings negative, which defeats
    // the entire purpose of a savings pocket (see emergency-unlock.service.ts,
    // which specifically depends on savings staying protected/available as
    // the last-resort reserve). This is a hard block, never overridable,
    // same as pocket_time_locked.
    if (pocket.kind === 'savings') {
      return {
        allowed: false,
        block_reason: 'savings_protected',
        message: `${pocket.name} is a savings pocket and can't be spent from directly. Use emergency unlock if you need to access it.`,
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
    let availableBalance = round2(summary.available);

    // Fence off parent's reserved balance from direct spending (subpocket-feature-spec.md §2)
    // If this pocket has sub-pockets, only the distributable portion is spendable
    const subPockets = await this.repository.getSubPocketsByParentId(dto.pocket_id);
    if (subPockets.length > 0) {
      const reservedBalance = round2(await this.repository.getParentReservedBalance(dto.pocket_id));
      // Distributable = total available - reserved
      availableBalance = Math.max(0, round2(availableBalance - reservedBalance));
    }

    // Check if spend exceeds available balance with small tolerance for floating point precision
    const amount = round2(dto.amount);
    const tolerance = 0.01; // 1 cent tolerance for floating point precision
    if (amount > availableBalance + tolerance) {
      const shortfall = round2(amount - availableBalance);
      
      // Overflow/borrow flow for sub-pockets (subpocket-feature-spec.md §5):
      // If this is a sub-pocket, check if parent has enough reserved balance to cover
      if (pocket.parent_pocket_id) {
        const parentReservedBalance = await this.repository.getParentReservedBalance(pocket.parent_pocket_id);
        
        if (parentReservedBalance >= shortfall) {
          // Parent has enough reserved balance - offer borrow option
          const parentPocket = await this.repository.getPocketById(pocket.parent_pocket_id);
          return {
            allowed: false,
            block_reason: 'insufficient_funds',
            message: `${pocket.name} is short ${shortfall} — pull from ${parentPocket?.name || 'parent pocket'}?`,
            shortfall,
            overridable: true,
            // Special flag to indicate this is an overflow/borrow situation
            borrow_from_parent_available: true,
            parent_pocket: parentPocket ? {
              id: parentPocket.id,
              name: parentPocket.name,
              available_balance: parentReservedBalance, // Only reserved portion is borrowable
            } : undefined,
            reallocation_sources: await this.getReallocationSources(pocket),
            pocket: {
              id: pocket.id,
              name: pocket.name,
              available_balance: availableBalance,
            },
          };
        }
        // Parent doesn't have enough reserved balance - fall through to standard insufficient funds
      }
      
      const reallocationSources = await this.getReallocationSources(pocket);
      return {
        allowed: false,
        block_reason: 'insufficient_funds',
        // Round to whole KSh for the message so it matches formatMoney()'s
        // default display everywhere else in the app — showing raw cents
        // here (e.g. "2165.72") while every other screen rounds the same
        // balance to "2,166" made the block look wrong/inconsistent.
        message: `Insufficient funds. Available: ${formatWholeKsh(availableBalance)}, Requested: ${formatWholeKsh(amount)}`,
        // Soft block, unlike blocked_category / pocket_time_locked: the
        // client can resubmit with `override: true` (see commitSpend) and
        // log it as a deliberate choice rather than being stuck at "no".
        shortfall,
        overridable: true,
        override_points_cost: -POINTS_ESSENTIAL_OVERRIDE, // e.g. 10, matches recordEssentialOverride's deduction
        reallocation_sources: reallocationSources,
        pocket: {
          id: pocket.id,
          name: pocket.name,
          available_balance: availableBalance,
        },
      };
    }

    // Emergency-overspend check: the pocket has the money (passed the
    // availableBalance check above), but spending it today would blow past
    // the daily cap that's meant to stretch it across the rest of the
    // cycle — e.g. a KSh 2,000 emergency on day 15 of a KSh 833/day plan.
    // Soft block (same overridable pattern as insufficient_funds) so the
    // client can show "spend anyway, your cap drops to X for the
    // remaining N days" instead of either silently allowing it or hard
    // -blocking a legitimate emergency. Skipped entirely on the
    // resubmission once the user has confirmed (dto.override_daily_cap).
    if (pocket.kind === 'spendable' && !dto.override_daily_cap) {
      const dailyCapPreview = await this.checkDailyCapExceeded(pocket, userId, amount, availableBalance);
      if (dailyCapPreview) {
        return dailyCapPreview;
      }
    }

    // Check merchant category against pocket type
    if (dto.category) {
      const blockedCategories = getBlockedCategoriesForPocket(pocket);
      if (blockedCategories.includes(dto.category)) {
        if (!isReviewableBlock(dto.category)) {
          await this.recordGamblingBlockedAttempt(pocket, userId, dto.category, dto.recipient_key, amount);
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
          try {
            await this.recordGamblingBlockedAttempt(
              pocket,
              userId,
              classification.category,
              dto.recipient_key,
              dto.amount,
            );
          } catch (error) {
            // Log the error but don't fail the spend check - the block should still work
            this.logger.error('Failed to record gambling blocked attempt', error instanceof Error ? error.stack : String(error));
          }
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
      overridden_daily_cap?: boolean;
      borrowed_from_parent?: boolean;
      pocket: {
        id: string;
        name: string;
        available_balance: number;
        daily_cap?: number;
        today_remaining?: number;
      };
    }
  > {
    if (dto.idempotency_key) {
      const scope = `spend:${dto.segment ?? 'individual'}` as IdempotencyScope;
      const existing = await this.repository.getIdempotencyRecord(
        userId,
        scope,
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

    // Overflow/borrow flow (subpocket-feature-spec.md §5): handle parent borrow confirmation
    const isBorrowFromParent = !result.allowed && result.borrow_from_parent_available === true && dto.borrow_from_parent === true;

    // Emergency-overspend confirmation: dto.override_daily_cap === true means
    // this is the resubmission after checkSpend already showed the user the
    // "your cap drops to X" preview and they chose to proceed. checkSpend
    // skips its own daily-cap check on this resubmission (see checkSpend's
    // `!dto.override_daily_cap` guard), so `result.allowed` is already true
    // here rather than a block to override — this flag is just how commit
    // knows to also shrink the pocket's daily_cap for the rest of the cycle.
    const isOverrideDailyCap = result.allowed && dto.override_daily_cap === true;

    if (!result.allowed && !isOverride && !isBorrowFromParent) {
      return result;
    }

    // H2 (034): commit the spend through the database. atomic_commit_spend
    // locks the pocket (and its parent family when a borrow is requested),
    // re-verifies the ledger balance under the lock, performs the parent-to-
    // child borrow for exactly the true gap, and writes the spend row in one
    // transaction — the cross-instance replacement for the old in-process
    // lock, and the guard against two instances double-debiting a pocket.
    const committed = await this.repository.atomicCommitSpend({
      pocketId: dto.pocket_id,
      amount: round2(dto.amount),
      merchant: dto.recipient_key || null,
      category: dto.category || null,
      borrowFromParent: Boolean(
        isBorrowFromParent && result.parent_pocket && result.shortfall,
      ),
      override: isOverride,
    });
    if (!committed) {
      // The DB guard rejected the commit: balance dropped below this amount
      // since checkSpend (a concurrent spend or borrow won the race), or the
      // parent reserve ran dry mid-borrow. Same conflict UX the old
      // in-process lock produced.
      throw new ConflictException(
        'This spend could not be committed — the pocket balance changed since the check. Please try again.',
      );
    }
    const transaction = { id: committed.transaction_id };

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

    // Emergency-overspend confirmed: shrink the daily cap for the rest of
    // the cycle now, using the *pre-spend* balance/spent-today figures
    // (result.pocket.available_balance is the balance checkSpend saw
    // before this transaction was written) so the math matches exactly
    // what the user was shown in the confirmation prompt.
    let adjustedDailyCap: number | undefined;
    if (isOverrideDailyCap && pocket) {
      const preview = await this.getDailyCapPreview(pocket, userId, dto.amount, result.pocket.available_balance);
      if (preview) {
        adjustedDailyCap = preview.adjustedDailyCap;
        await this.repository.updatePocket(pocket.id, { daily_cap: preview.adjustedDailyCap });
      }
    }

    // Batch 6: if this push a spendable pocket over its daily cap, emit
    // daily_overspend immediately so the heatmap/streak don't wait for
    // tomorrow's rollover catch-up. Skipped when we just confirmed an
    // emergency overspend — the cap was deliberately shrunk to absorb it,
    // not blown past by surprise, so penalizing it here would double up
    // with the user's own explicit choice.
    if (pocket && !isOverrideDailyCap) {
      await this.maybeRecordDailyOverspend(pocket, userId);
    }

    // The "Spend logged" confirmation (log-spend.tsx) reads pocket.available_balance
    // straight off this response — which is the whole-cycle ledger balance, not
    // "left today". For a daily-cap pocket that's the exact same conflation the
    // home screen had (a KSh 200 spend against a KSh 500 cap showing "now has
    // 14,300 left" instead of "now has 300 left today"). effectiveDailyCap
    // covers the override case, where the cap was just shrunk for the rest of
    // the cycle and pocket.daily_cap (read before the update above) is stale.
    let today_remaining: number | undefined;
    const effectiveDailyCapValue = isOverrideDailyCap ? adjustedDailyCap : pocket?.daily_cap ?? undefined;
    if (pocket && pocket.kind === 'spendable' && effectiveDailyCapValue && effectiveDailyCapValue > 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const { startIso, endIsoExclusive } = utcDayBounds(todayIso);
      const totals = await this.repository.getSpendTotalsByPocketBetween([pocket.id], startIso, endIsoExclusive);
      const spentToday = totals.get(pocket.id) ?? 0;
      const capLeft = Math.max(0, effectiveDailyCapValue - spentToday);
      today_remaining = Math.round(Math.min(capLeft, postSpendSummary.available) * 100) / 100;
    }

    const response = {
      ...result,
      allowed: true,
      block_reason: null,
      ...(isOverride ? { overridden: true } : {}),
      ...(isBorrowFromParent ? { borrowed_from_parent: true } : {}),
      ...(isOverrideDailyCap ? { overridden_daily_cap: true, adjusted_daily_cap: adjustedDailyCap } : {}),
      pocket: {
        ...result.pocket,
        available_balance: postSpendSummary.available,
        daily_cap: effectiveDailyCapValue,
        today_remaining,
      },
      transaction_id: transaction?.id,
    };

    if (dto.idempotency_key) {
      const scope = `spend:${dto.segment ?? 'individual'}` as IdempotencyScope;
      const saved = await this.repository.saveIdempotencyRecord({
        id: uuidv4(),
        user_id: userId,
        scope,
        idempotency_key: dto.idempotency_key,
        resource_id: transaction?.id ?? null,
        response: response as unknown as Record<string, unknown>,
      });
      if (!saved) {
        const raced = await this.repository.getIdempotencyRecord(
          userId,
          scope,
          dto.idempotency_key,
        );
        if (raced?.response) {
          return { ...(raced.response as any), idempotent_replay: true };
        }
      }
    }

      return response;
  }

  /**
   * Returns a `daily_cap_exceeded` soft-block response when this spend
   * would push a daily-plan pocket past today's cap, or null when it's
   * fine to proceed (structured plans, pockets with no cap yet, or the
   * amount fits within what's left of today's cap). Only spendable
   * pockets on 'daily' plans have a cap to exceed — structured plans and
   * fixed/savings pockets always return null here.
   */
  private async checkDailyCapExceeded(
    pocket: Pocket,
    userId: string,
    amount: number,
    availableBalance: number,
  ): Promise<Awaited<ReturnType<SpendService['checkSpend']>> | null> {
    const preview = await this.getDailyCapPreview(pocket, userId, amount, availableBalance);
    if (!preview || !preview.exceedsCap) return null;

    const daysWord = preview.daysRemaining === 1 ? 'day' : 'days';
    return {
      allowed: false,
      block_reason: 'daily_cap_exceeded',
      message:
        `This is above today's safe-to-spend cap of ${formatWholeKsh(preview.currentDailyCap)}. ` +
        `If you continue, your daily cap for the remaining ${preview.daysRemaining} ${daysWord} ` +
        `will drop to ${formatWholeKsh(preview.adjustedDailyCap)} so it still lasts the month.`,
      overridable: true,
      current_daily_cap: preview.currentDailyCap,
      adjusted_daily_cap: preview.adjustedDailyCap,
      days_remaining: preview.daysRemaining,
      pocket: {
        id: pocket.id,
        name: pocket.name,
        available_balance: availableBalance,
      },
    };
  }

  /**
   * Raw emergency-overspend math shared by checkDailyCapExceeded (the
   * pre-spend soft block) and commitSpend (persisting the recalculated cap
   * once the user has confirmed via override_daily_cap). Returns null for
   * structured plans, non-spendable pockets, or pockets without a cap yet
   * — the same "not applicable" cases checkDailyCapExceeded already
   * treated as pass-through.
   */
  private async getDailyCapPreview(
    pocket: Pocket,
    userId: string,
    amount: number,
    availableBalance: number,
  ): Promise<ReturnType<typeof previewDailyCapAfterSpend> | null> {
    if (pocket.kind !== 'spendable') return null;

    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan || plan.type !== 'daily') return null;

    const todayIso = new Date().toISOString().slice(0, 10);
    const { cap, daysRemaining } = await this.resolveLiveDailyCap(pocket, plan, userId, todayIso);
    if (cap <= 0) return null;

    const { startIso, endIsoExclusive } = utcDayBounds(todayIso);
    const totals = await this.repository.getSpendTotalsByPocketBetween([pocket.id], startIso, endIsoExclusive);
    const spentToday = totals.get(pocket.id) || 0;

    return previewDailyCapAfterSpend({
      dailyCap: cap,
      spentToday,
      requestedAmount: amount,
      availableBalance,
      dateIso: todayIso,
      daysRemainingOverride: daysRemaining,
    });
  }

  /**
   * BUG FIX (2026-08-27): "today's cap" for a spendable pocket on a
   * freelancer/daily plan. This must match the exact same live, runway-
   * based recompute PocketsService already applies on every display
   * surface (home list + pocket detail — see getAllForUser /
   * getPocketSummary, both of which call computeSpendableDailyCaps against
   * the *current* runway on every read and never persist the result).
   *
   * This method used to just read `pocket.daily_cap` via effectiveDailyCap
   * — the column as last persisted, which only gets rewritten when an
   * income event lands (IncomeService) or when an emergency-overspend
   * override shrinks it (commitSpend, below). Between those events, a
   * freelancer's runway keeps shrinking day by day, which *should* raise
   * their live daily cap (same money, fewer days left) — but the persisted
   * column doesn't move, so it drifts further out of sync with reality
   * every day that passes without new income.
   *
   * Net effect of the bug: the "safe to spend" cap shown in this
   * confirmation flow could be wildly lower than the cap the user was just
   * looking at on the pocket/home screen for the same pocket at the same
   * moment (e.g. a stale 989 here vs a live 4,286 on screen), making a
   * perfectly normal spend look like a dangerous overspend and offering a
   * nonsensical "adjusted cap" built on the wrong starting number.
   *
   * Also used by maybeRecordDailyOverspend so the discipline-score penalty
   * for "went over today's cap" is judged against the same live number,
   * not the stale one.
   */
  private async resolveLiveDailyCap(
    pocket: Pocket,
    plan: { type: string; income_pattern?: string | null },
    userId: string,
    todayIso: string,
  ): Promise<{ cap: number; daysRemaining?: number }> {
    // Freelancers don't have a fixed monthly cycle — their pacing is
    // "days until the next expected payment" (runwayDays), which is also
    // what drives their live daily_cap (see computeSpendableDailyCaps /
    // docs/FREELANCER_RUNWAY.md). Reusing effectiveDailyCap's persisted-
    // column-or-calendar-month math for them is wrong on both counts: the
    // cap itself is stale, and spreading an emergency spend over calendar
    // days remaining (e.g. "day 15 of 30") instead of runway days (e.g.
    // "3 days until next expected payment") divides by the wrong number.
    if (plan.income_pattern === 'freelancer') {
      const runwaySummary = await this.runway.getRunwayForPlan(userId, plan as any);
      if (runwaySummary.applicable && typeof runwaySummary.runwayDays === 'number') {
        const caps = computeSpendableDailyCaps([pocket], runwaySummary);
        const liveCap = caps.get(pocket.id);
        if (liveCap !== undefined) {
          return { cap: liveCap, daysRemaining: runwaySummary.runwayDays };
        }
      }
    }
    return { cap: effectiveDailyCap(pocket, todayIso, plan.type) };
  }

  private async maybeRecordDailyOverspend(pocket: Pocket, userId: string): Promise<void> {
    try {
      if (pocket.kind !== 'spendable') return;

      // Only enforce daily cap logic for daily budget plans
      const plan = await this.repository.getActivePlanByUserId(userId);
      if (!plan || plan.type !== 'daily') return;

      const todayIso = new Date().toISOString().slice(0, 10);

      // BUG FIX (2026-08-27): this used to read pocket.daily_cap directly —
      // the stale persisted column for freelancer plans (see
      // resolveLiveDailyCap above for the full explanation). That let this
      // scoring check judge "did they go over today's cap" against a
      // different number than the cap the user actually saw on screen,
      // either penalizing spends that were fine against the live cap, or
      // missing genuine overspends against it.
      const { cap } = await this.resolveLiveDailyCap(pocket, plan, userId, todayIso);
      if (cap <= 0) return;
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
      const apply = Math.max(
        POINTS_DAILY_OVERSPEND,
        Math.min(0, CAP_DAILY_OVERSPEND - earned),
      ); // Monthly cap; score itself is clamped in DisciplineScoreService
      if (apply !== 0) {
        await this.disciplineScore.applyDelta(userId, apply);
      }

      await this.repository.createBehaviorEvent({
        user_id: userId,
        type: EVENT_DAILY_OVERSPEND,
        payload: {
          date: todayIso,
          pocket_id: pocket.id,
          spent: round2(spentToday),
          daily_cap: round2(cap),
          points_deducted: apply < 0 ? -apply : 0,
        },
      });
    } catch (error) {
      this.logger.error('Error recording daily overspend', error instanceof Error ? error.stack : String(error));
      // Don't throw - the overspend check should still work
    }
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
    try {
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
      ); // Monthly cap; score itself is clamped in DisciplineScoreService
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
          amount: round2(amount),
          points_deducted: apply < 0 ? -apply : 0,
        },
      });
    } catch (error) {
      this.logger.error('Error recording gambling blocked attempt', error instanceof Error ? error.stack : String(error));
      // Don't throw - the block should still work even if logging fails
    }
  }

  /**
   * Fires when a user explicitly chooses to
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
    try {
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
      const apply = Math.max(
        POINTS_ESSENTIAL_OVERRIDE,
        Math.min(0, CAP_ESSENTIAL_OVERRIDE - earned),
      ); // Monthly cap; score itself is clamped in DisciplineScoreService
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
          amount: round2(amount),
          shortfall: round2(shortfall),
          reason: reason ?? null,
          points_deducted: apply < 0 ? -apply : 0,
        },
      });
    } catch (error) {
      this.logger.error('Error recording essential override', error instanceof Error ? error.stack : String(error));
      // Don't throw - the override should still work
    }
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

// Delegates to the shared integer-cents helper (packages/shared/src/money.ts)
// so every boundary-round in the app uses the same single conversion rule.
function round2(n: number): number {
  return fromCents(toCents(n));
}
