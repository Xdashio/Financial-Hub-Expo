import { Injectable } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { User, Plan, FixedExpense } from '../../database/database.types';

@Injectable()
export class ProfileService {
  constructor(private readonly supabaseRepo: SupabaseRepository) {}

  async getProfile(userId: string): Promise<User | null> {
    return this.supabaseRepo.getUserById(userId);
  }

  async getActivePlan(userId: string): Promise<Plan | null> {
    return this.supabaseRepo.getActivePlanByUserId(userId);
  }

  async getFixedExpenses(userId: string): Promise<FixedExpense[]> {
    return this.supabaseRepo.getFixedExpensesByUserId(userId);
  }
}