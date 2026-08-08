import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  async updateForUser(id: string, userId: string, updates: PocketUpdate): Promise<Pocket> {
    const pocket = await this.repository.getPocketById(id);
    if (!pocket) {
      throw new NotFoundException('Pocket not found');
    }
    await this.assertOwnership(pocket, userId);

    const updated = await this.repository.updatePocket(id, updates);
    if (!updated) {
      throw new NotFoundException('Pocket not found');
    }
    return updated;
  }

  private async assertOwnership(pocket: Pocket, userId: string): Promise<void> {
    const plan = await this.repository.getPlanById(pocket.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this pocket');
    }
  }
}