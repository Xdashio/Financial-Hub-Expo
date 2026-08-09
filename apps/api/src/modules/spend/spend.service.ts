import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SpendCheckDto } from './dto/spend-check.dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { Pocket, MerchantClassification } from '../../database/database.types';

@Injectable()
export class SpendService {
  constructor(private readonly repository: SupabaseRepository) {}

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
      return {
        allowed: false,
        block_reason: 'insufficient_funds',
        message: `Insufficient funds. Available: ${availableBalance}, Requested: ${dto.amount}`,
        pocket: {
          id: pocket.id,
          name: pocket.name,
          available_balance: availableBalance,
        },
      };
    }

    // Check merchant category against pocket type
    if (dto.category) {
      const blockedCategories = this.getBlockedCategoriesForPocket(pocket);
      if (blockedCategories.includes(dto.category)) {
        return {
          allowed: false,
          block_reason: 'blocked_category',
          blocked_category: dto.category,
          pocket_type: pocket.kind,
          message: `${this.getCategoryDisplayName(dto.category)} can't be paid from ${pocket.name}`,
          review_available: pocket.kind !== 'fixed',
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
      const blockedCategories = this.getBlockedCategoriesForPocket(pocket);
      if (blockedCategories.includes(classification.category)) {
        return {
          allowed: false,
          block_reason: 'blocked_category',
          blocked_category: classification.category,
          pocket_type: pocket.kind,
          message: `${this.getCategoryDisplayName(classification.category)} can't be paid from ${pocket.name}`,
          review_available: pocket.kind !== 'fixed',
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
    Awaited<ReturnType<SpendService['checkSpend']>> & { transaction_id?: string }
  > {
    const result = await this.checkSpend(dto, userId);

    if (!result.allowed) {
      return result;
    }

    const transaction = await this.repository.createTransaction({
      pocket_id: dto.pocket_id,
      amount: dto.amount,
      type: 'spend',
      merchant: dto.recipient_key || null,
      category: dto.category || null,
    });

    return {
      ...result,
      transaction_id: transaction?.id,
    };
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

    const blockedCategories = this.getBlockedCategoriesForPocket(pocket);
    const allowedCategories = this.getAllowedCategoriesForPocket(pocket);

    return {
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      pocket_kind: pocket.kind,
      blocked_categories: blockedCategories.map(category => ({
        category,
        reason: pocket.kind === 'fixed' ? 'Essential pocket protection' : 'Savings protection',
        can_override: pocket.kind !== 'fixed',
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

  private getBlockedCategoriesForPocket(pocket: Pocket): string[] {
    if (pocket.kind === 'fixed') {
      return ['gambling_betting', 'entertainment'];
    }
    return ['gambling_betting'];
  }

  private getAllowedCategoriesForPocket(pocket: Pocket): string[] {
    if (pocket.kind === 'fixed') {
      return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education'];
    }
    return ['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education', 'entertainment', 'personal_care', 'other'];
  }

  private getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      grocery: 'Groceries',
      landlord_rent: 'Rent',
      utility: 'Utilities',
      transport: 'Transport',
      healthcare: 'Healthcare',
      education: 'Education',
      entertainment: 'Entertainment',
      gambling_betting: 'Betting & gambling',
      personal_care: 'Personal care',
      other: 'Other',
      unclassified: 'Unclassified',
    };
    return displayNames[category] || category;
  }

  private getSuggestedCategories(pocket: Pocket): Array<{
    category: string;
    pocket_id: string;
    pocket_name: string;
    confidence: number;
  }> {
    // Suggest categories based on pocket type
    const suggestedCategories = this.getAllowedCategoriesForPocket(pocket);
    return suggestedCategories.slice(0, 3).map(category => ({
      category,
      pocket_id: pocket.id,
      pocket_name: pocket.name,
      confidence: 0.8, // Default confidence for suggestions
    }));
  }
}