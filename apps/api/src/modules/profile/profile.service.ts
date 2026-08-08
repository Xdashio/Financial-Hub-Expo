import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { User, Plan, FixedExpense } from '../../database/database.types';
import {
  FixedExpenseInputSchema,
  FixedExpenseInput,
  OnboardingInputSchema,
  OnboardingInput,
  OnboardingCommitResult,
} from '@financial-hub/shared';
import { OnboardingService } from '../onboarding/onboarding.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly supabaseRepo: SupabaseRepository,
    private readonly onboardingService: OnboardingService,
  ) {}

  async getProfile(userId: string): Promise<User | null> {
    return this.supabaseRepo.getUserById(userId);
  }

  async getActivePlan(userId: string): Promise<Plan | null> {
    return this.supabaseRepo.getActivePlanByUserId(userId);
  }

  async getFixedExpenses(userId: string): Promise<FixedExpense[]> {
    return this.supabaseRepo.getFixedExpensesByUserId(userId);
  }

  async createFixedExpense(userId: string, input: unknown): Promise<FixedExpense> {
    const parsed = this.parseFixedExpenseInput(input);
    const created = await this.supabaseRepo.createFixedExpense({
      user_id: userId,
      name: parsed.name,
      amount: parsed.amount,
      due_day: parsed.dueDay,
      category: parsed.category,
    });
    if (!created) {
      throw new BadRequestException('Failed to create fixed expense');
    }
    return created;
  }

  async updateFixedExpense(userId: string, id: string, input: unknown): Promise<FixedExpense> {
    const existing = await this.getOwnedFixedExpense(id, userId);
    const parsed = this.parseFixedExpenseInput(input, existing);
    const updated = await this.supabaseRepo.updateFixedExpense(id, {
      name: parsed.name,
      amount: parsed.amount,
      due_day: parsed.dueDay,
      category: parsed.category,
    });
    if (!updated) {
      throw new NotFoundException('Fixed expense not found');
    }
    return updated;
  }

  async deleteFixedExpense(userId: string, id: string): Promise<void> {
    await this.getOwnedFixedExpense(id, userId);
    await this.supabaseRepo.deleteFixedExpense(id);
  }

  async retakePlan(userId: string, input: unknown): Promise<OnboardingCommitResult> {
    const result = OnboardingInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map(i => i.message).join('; '));
    }
    // Re-runs the same rules engine + provisioning path as initial onboarding:
    // deactivates the current plan, creates a fresh one from the updated
    // answers, and logs a behavior event — see OnboardingService.commit.
    return this.onboardingService.commit(result.data as OnboardingInput, userId);
  }

  private async getOwnedFixedExpense(id: string, userId: string): Promise<FixedExpense> {
    const expense = await this.supabaseRepo.getFixedExpenseById(id);
    if (!expense) {
      throw new NotFoundException('Fixed expense not found');
    }
    if (expense.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this fixed expense');
    }
    return expense;
  }

  private parseFixedExpenseInput(input: unknown, existing?: FixedExpense): FixedExpenseInput {
    // Updates may be partial — fall back to the existing row's values so a
    // partial PUT doesn't fail validation on fields the caller didn't send.
    const candidate = existing
      ? { name: existing.name, amount: existing.amount, dueDay: existing.due_day, category: existing.category, ...(input as object) }
      : input;
    const result = FixedExpenseInputSchema.safeParse(candidate);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map(i => i.message).join('; '));
    }
    return result.data;
  }
}