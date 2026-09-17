import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ClassifyDto } from './dto/classify.dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { MerchantClassification, Pocket, Transaction } from '../../database/database.types';
import { getBlockedCategoriesForPocket } from '../../common/pocket-rules';
import { parsePagination } from '../../common/pagination';

@Injectable()
export class MerchantService {
  constructor(private readonly repository: SupabaseRepository) {}

  async classify(dto: ClassifyDto, userId: string): Promise<{
    classification: MerchantClassification;
    transaction_updated?: { id: string; category: string; pocket_id: string };
  }> {
    const pocket = await this.repository.getPocketById(dto.pocket_id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertPocketOwnership(pocket, userId);

    const blockedCategories = getBlockedCategoriesForPocket(pocket);
    if (blockedCategories.includes(dto.category)) {
      throw new BadRequestException(
        `${dto.category} payments can't be classified into ${pocket.name} — this pocket blocks that category.`,
      );
    }

    const classification = await this.repository.upsertMerchantClassification({
      user_id: userId,
      recipient_key: dto.recipient_key,
      category: dto.category,
      pocket_id: dto.pocket_id,
      remember: dto.remember,
    });

    let transactionUpdated: { id: string; category: string; pocket_id: string } | undefined;
    if (dto.transaction_id) {
      transactionUpdated = await this.reclassifyTransaction(dto, userId, pocket);
    }

    return {
      classification: classification!,
      transaction_updated: transactionUpdated,
    };
  }

  async getClassifications(
    userId: string,
    page: number = 1,
    limit: number = 50,
    search?: string,
  ): Promise<{
    classifications: Array<{
      id: string;
      recipient_key: string;
      category: string;
      pocket_id: string | null;
      pocket_name: string;
      remember: boolean;
      usage_count: number;
      last_used: string;
      created_at: string;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // M2: the old slice math trusted the controller; sanitise here too so a
    // direct service call with ?limit=1e9 can never page unbounded memory.
    ({ page, limit } = parsePagination(page, limit, 50));
    let classifications = await this.repository.getMerchantClassificationsByUserId(userId);

    if (search) {
      classifications = classifications.filter((c) =>
        c.recipient_key.toLowerCase().includes(search.toLowerCase()),
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedClassifications = classifications.slice(from, to);

    const pocketIds = [
      ...new Set(paginatedClassifications.map((c) => c.pocket_id).filter((id): id is string => !!id)),
    ];
    const pocketNameById = new Map<string, string>();
    await Promise.all(
      pocketIds.map(async (id) => {
        const pocket = await this.repository.getPocketById(id);
        if (pocket) pocketNameById.set(id, pocket.name);
      }),
    );

    const enrichedClassifications = paginatedClassifications.map((c) => ({
      id: c.id,
      recipient_key: c.recipient_key,
      category: c.category,
      pocket_id: c.pocket_id,
      pocket_name: c.pocket_id
        ? pocketNameById.get(c.pocket_id) ?? 'Pocket removed'
        : 'Not assigned',
      remember: c.remember,
      usage_count: 0,
      last_used: c.created_at,
      created_at: c.created_at,
    }));

    const total = classifications.length;
    const totalPages = Math.ceil(total / limit);

    return {
      classifications: enrichedClassifications,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async deleteClassification(id: string, userId: string): Promise<void> {
    const classification = await this.repository.getMerchantClassificationById(id);
    if (!classification) {
      throw new NotFoundException('Classification not found');
    }

    if (classification.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this classification');
    }

    await this.repository.deleteMerchantClassification(id);
  }

  /**
   * Persist category (and pocket when the user picked a different one) onto
   * an existing ledger row. Balances are ledger-derived, so moving a spend
   * to another pocket_id is enough to re-home the debit — no separate
   * reallocation rows needed.
   */
  private async reclassifyTransaction(
    dto: ClassifyDto,
    userId: string,
    targetPocket: Pocket,
  ): Promise<{ id: string; category: string; pocket_id: string }> {
    const transaction = await this.getTransactionForUser(dto.transaction_id!, userId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.type !== 'spend') {
      throw new BadRequestException('Only spend transactions can be reclassified');
    }

    const movingPocket = transaction.pocket_id !== targetPocket.id;
    if (movingPocket) {
      const summary = await this.repository.getPocketSummary(targetPocket.id);
      if (summary.available < transaction.amount) {
        throw new BadRequestException(
          `${targetPocket.name} only has KES ${Math.round(summary.available).toLocaleString()} available — not enough to take this KES ${Math.round(transaction.amount).toLocaleString()} spend.`,
        );
      }
    }

    const updated = await this.repository.updateTransaction(transaction.id, {
      category: dto.category,
      pocket_id: targetPocket.id,
    });

    if (!updated) {
      throw new BadRequestException('Failed to update transaction');
    }

    return {
      id: updated.id,
      category: updated.category ?? dto.category,
      pocket_id: updated.pocket_id,
    };
  }

  private async assertPocketOwnership(pocket: Pocket, userId: string): Promise<void> {
    const plan = await this.repository.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this pocket');
    }
  }

  private async getTransactionForUser(
    transactionId: string,
    userId: string,
  ): Promise<Transaction | null> {
    const transaction = await this.repository.getTransactionById(transactionId);
    if (!transaction) {
      return null;
    }

    const pocket = await this.repository.getPocketById(transaction.pocket_id);
    if (!pocket) {
      return null;
    }

    const plan = await this.repository.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      return null;
    }

    return transaction;
  }
}
