import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { User, Plan, FixedExpense } from '../../database/database.types';
import {
  FixedExpenseInputSchema,
  FixedExpenseInput,
  OnboardingInputSchema,
  OnboardingInput,
  PlanRetakeResult,
  RetakeEligibility,
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

  async retakePlan(userId: string, input: unknown): Promise<PlanRetakeResult> {
    const result = OnboardingInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    // Money-preserving retake: re-runs the rules engine, creates a new plan
    // + pockets, migrates ledger balances from the previous active plan, and
    // enforces the once-per-calendar-month gate. See OnboardingService.retake.
    return this.onboardingService.retake(result.data as OnboardingInput, userId);
  }

  async getRetakeEligibility(userId: string): Promise<RetakeEligibility> {
    return this.onboardingService.getRetakeEligibility(userId);
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
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    return result.data;
  }

  async getFixedExpenseSuggestions(userId: string): Promise<{
    suggestions: Array<{
      name: string;
      category: string;
      suggested_amount: number;
      suggested_due_day: number;
      description: string;
    }>;
    total_monthly_suggestion: number;
  }> {
    // Common fixed expense suggestions based on typical Kenyan spending patterns.
    // Categories must match PocketCategorySchema (housing/family added in Batch 2).
    const suggestions = [
      {
        name: 'Rent',
        category: 'housing',
        suggested_amount: 15000,
        suggested_due_day: 1,
        description: 'Monthly rent payment',
      },
      {
        name: 'Electricity',
        category: 'utilities',
        suggested_amount: 2000,
        suggested_due_day: 15,
        description: 'KPLC electricity bill',
      },
      {
        name: 'Water',
        category: 'utilities',
        suggested_amount: 500,
        suggested_due_day: 15,
        description: 'Water bill',
      },
      {
        name: 'Internet',
        category: 'utilities',
        suggested_amount: 1500,
        suggested_due_day: 10,
        description: 'Monthly internet subscription',
      },
      {
        name: 'Mobile Data',
        category: 'utilities',
        suggested_amount: 1000,
        suggested_due_day: 1,
        description: 'Monthly mobile data bundle',
      },
      {
        name: 'Netflix/Streaming',
        category: 'leisure',
        suggested_amount: 800,
        suggested_due_day: 5,
        description: 'Streaming subscription',
      },
      {
        name: 'Gym Membership',
        category: 'leisure',
        suggested_amount: 2000,
        suggested_due_day: 15,
        description: 'Monthly gym membership',
      },
      {
        name: 'School Fees',
        category: 'education',
        suggested_amount: 5000,
        suggested_due_day: 5,
        description: 'Monthly school fees installment',
      },
    ];

    const totalMonthlySuggestion = suggestions.reduce((sum, s) => sum + s.suggested_amount, 0);

    return {
      suggestions,
      total_monthly_suggestion: totalMonthlySuggestion,
    };
  }

  async bulkCreateFixedExpenses(userId: string, input: unknown): Promise<{
    created: FixedExpense[];
    failed: Array<{ index: number; error: string }>;
    total_monthly: number;
  }> {
    const result = FixedExpenseInputSchema.array().safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }

    const expenses = result.data;
    const created: FixedExpense[] = [];
    const failed: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < expenses.length; i++) {
      try {
        const createdExpense = await this.supabaseRepo.createFixedExpense({
          user_id: userId,
          name: expenses[i].name,
          amount: expenses[i].amount,
          due_day: expenses[i].dueDay,
          category: expenses[i].category,
        });
        if (createdExpense) {
          created.push(createdExpense);
        } else {
          failed.push({ index: i, error: 'Failed to create expense' });
        }
      } catch (error) {
        failed.push({ index: i, error: (error as Error).message });
      }
    }

    const totalMonthly = created.reduce((sum, e) => sum + e.amount, 0);

    return {
      created,
      failed,
      total_monthly: totalMonthly,
    };
  }

  async updateFixedExpenseStatus(userId: string, id: string, input: unknown): Promise<FixedExpense> {
    await this.getOwnedFixedExpense(id, userId);

    // Parse status from input
    const status = (input as { status?: string }).status;
    if (!status || (status !== 'active' && status !== 'inactive')) {
      throw new BadRequestException('Invalid status. Must be "active" or "inactive"');
    }

    const updated = await this.supabaseRepo.updateFixedExpense(id, { status });

    if (!updated) {
      throw new NotFoundException('Fixed expense not found');
    }

    return updated;
  }
}