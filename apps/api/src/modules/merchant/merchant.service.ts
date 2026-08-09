import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ClassifyDto } from './dto/classify.dto';
import { SupabaseRepository } from '../../database/supabase.repository';
import { MerchantClassification, Pocket } from '../../database/database.types';

@Injectable()
export class MerchantService {
  constructor(private readonly repository: SupabaseRepository) {}

  async classify(dto: ClassifyDto, userId: string): Promise<{
    classification: MerchantClassification;
    transaction_updated?: { id: string; category: string };
  }> {
    // Verify pocket ownership
    const pocket = await this.repository.getPocketById(dto.pocket_id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertPocketOwnership(pocket, userId);

    // Create or update classification (note: pocket_id not in current schema, will be stored in context or updated separately)
    const classification = await this.repository.upsertMerchantClassification({
      user_id: userId,
      recipient_key: dto.recipient_key,
      category: dto.category,
      remember: dto.remember,
    });

    // Update transaction if provided
    let transactionUpdated;
    if (dto.transaction_id) {
      const transaction = await this.getTransactionForUser(dto.transaction_id, userId);
      if (transaction) {
        // Note: In a real implementation, you'd update the transaction category
        // For now, we'll just return the transaction reference
        transactionUpdated = {
          id: transaction.id,
          category: dto.category,
        };
      }
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
    search?: string
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
    let classifications = await this.repository.getMerchantClassificationsByUserId(userId);

    // Filter by search if provided
    if (search) {
      classifications = classifications.filter(c =>
        c.recipient_key.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedClassifications = classifications.slice(from, to);

    // Enrich with pocket names (note: pocket_id not in current schema, so we'll omit for now)
    const enrichedClassifications = paginatedClassifications.map((c) => ({
      id: c.id,
      recipient_key: c.recipient_key,
      category: c.category,
      pocket_id: null, // Not in current schema
      pocket_name: 'Not assigned', // Not in current schema
      remember: c.remember,
      usage_count: 0, // Would need to track usage in a real implementation
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

  private async assertPocketOwnership(pocket: Pocket, userId: string): Promise<void> {
    const plan = await this.repository.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this pocket');
    }
  }

  private async getTransactionForUser(transactionId: string, userId: string): Promise<any | null> {
    const transaction = await this.repository.getTransactionById(transactionId);
    if (!transaction) {
      return null;
    }

    // Verify user owns the transaction by checking pocket ownership
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