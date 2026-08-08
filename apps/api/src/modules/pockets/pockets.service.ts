import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PocketUpdateInputSchema } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { Pocket, PocketUpdate } from '../../database/database.types';

@Injectable()
export class PocketsService {
  constructor(private readonly repository: SupabaseRepository) {}

  async getAllForUser(userId: string): Promise<Pocket[]> {
    const plan = await this.repository.getActivePlanByUserId(userId);
    if (!plan) {
      return [];
    }
    return this.repository.getPocketsByPlanId(plan.id);
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
      throw new BadRequestException(result.error.issues.map(i => i.message).join('; '));
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
}