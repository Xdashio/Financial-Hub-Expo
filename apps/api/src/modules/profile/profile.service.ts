import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseRepository } from '../../database/supabase.repository';
import { User, Plan, FixedExpense, Pocket, PocketInsert } from '../../database/database.types';
import {
  FixedExpenseInputSchema,
  FixedExpenseInput,
  OnboardingInputSchema,
  OnboardingInput,
  PlanRetakeResult,
  RetakeEligibility,
} from '@financial-hub/shared';
import { OnboardingService } from '../onboarding/onboarding.service';
import { nextDueDateIso } from '../onboarding/pocket-provisioning';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

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
    // Homepage lists pockets, not fixed_expenses rows. A post-onboarding
    // add used to save the bill without a matching fixed pocket, so the
    // new name never appeared under Fixed & Protected.
    await this.syncFixedPocketFromExpense(userId, null, parsed);
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
    await this.syncFixedPocketFromExpense(userId, existing, parsed);
    return updated;
  }

  async deleteFixedExpense(userId: string, id: string): Promise<void> {
    const existing = await this.getOwnedFixedExpense(id, userId);
    // Refuse while the matching homepage pocket still holds money — same
    // money-safe rule as pocket delete. Caller must reallocate first.
    await this.assertFixedPocketEmptyOrMissing(userId, existing);
    await this.supabaseRepo.deleteFixedExpense(id);
    await this.removeFixedPocketForExpense(userId, existing);
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
    const body = this.normalizeFixedExpenseBody(input);
    const candidate = existing
      ? { name: existing.name, amount: existing.amount, dueDay: existing.due_day, category: existing.category, ...(body as object) }
      : body;
    const result = FixedExpenseInputSchema.safeParse(candidate);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    return result.data;
  }

  /**
   * The mobile form historically posted snake_case `due_day` (matching the
   * DB column) while FixedExpenseInputSchema expects `dueDay`. Without this
   * mapping, creates 400'd and edits silently kept the previous due day.
   */
  private normalizeFixedExpenseBody(input: unknown): unknown {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
    const raw = input as Record<string, unknown>;
    if (raw.dueDay === undefined && typeof raw.due_day === 'number') {
      const { due_day: dueDay, ...rest } = raw;
      return { ...rest, dueDay };
    }
    return input;
  }

  /**
   * Keep the itemized fixed pocket (homepage "Fixed & Protected") in
   * lockstep with the bill the user just saved. Matching prefers the
   * *previous* expense name (so a rename still finds the onboarding
   * pocket), then falls back to category / single-fixed-pocket cases —
   * e.g. expense "UTILITIES" vs pocket "Utilities".
   */
  private async syncFixedPocketFromExpense(
    userId: string,
    previous: Pick<FixedExpense, 'name' | 'category'> | null,
    next: FixedExpenseInput,
  ): Promise<void> {
    const plan = await this.supabaseRepo.getActivePlanByUserId(userId);
    if (!plan) return;

    const pockets = await this.supabaseRepo.getTopLevelPocketsByPlanId(plan.id);
    const matchName = previous?.name ?? next.name;
    const matchCategory = previous?.category ?? next.category;
    const existingPocket = this.findMatchingFixedPocket(pockets, matchName, matchCategory);

    const pocketFields = {
      name: next.name,
      category: next.category,
      monthly_allocation: next.amount,
      lock_until: nextDueDateIso(next.dueDay),
      is_time_locked: true,
    };

    try {
      if (existingPocket) {
        const updated = await this.supabaseRepo.updatePocket(existingPocket.id, pocketFields);
        if (!updated) {
          throw new Error(`updatePocket returned null for ${existingPocket.id}`);
        }
        return;
      }

      // Already have a pocket under the *new* name (e.g. earlier case-only
      // mismatch left both "UTILITIES" expense and "Utilities" pocket).
      const byNextName = this.findMatchingFixedPocket(pockets, next.name, next.category);
      if (byNextName) {
        const updated = await this.supabaseRepo.updatePocket(byNextName.id, pocketFields);
        if (!updated) {
          throw new Error(`updatePocket returned null for ${byNextName.id}`);
        }
        return;
      }

      const insert: PocketInsert = {
        plan_id: plan.id,
        name: next.name,
        kind: 'fixed',
        category: next.category,
        is_time_locked: true,
        lock_until: pocketFields.lock_until,
        monthly_allocation: next.amount,
        daily_cap: null,
        parent_pocket_id: null,
      };
      const created = await this.supabaseRepo.createPocket(insert);
      if (!created) {
        throw new Error('createPocket returned null');
      }
    } catch (err) {
      this.logger.warn(
        `fixed-pocket sync failed for "${next.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private findMatchingFixedPocket(
    pockets: Pocket[],
    name: string,
    category: string,
  ): Pocket | undefined {
    const fixed = pockets.filter((p) => p.kind === 'fixed');
    if (fixed.length === 0) return undefined;

    const normalized = name.trim().toLowerCase();
    const sameName = fixed.filter((p) => p.name.trim().toLowerCase() === normalized);

    if (sameName.length === 1) return sameName[0];
    if (sameName.length > 1) {
      const sameNameAndCat = sameName.filter((p) => p.category === category);
      return sameNameAndCat[0] ?? sameName[0];
    }

    // No name hit — common when the bill was renamed in Fixed Expenses
    // history, or the pocket was titled differently at onboarding
    // ("Internet") while the expense row says "UTILITIES". Prefer a unique
    // pocket in that category over creating a duplicate.
    const sameCategory = fixed.filter((p) => p.category === category);
    if (sameCategory.length === 1) return sameCategory[0];

    // Legacy lumped plan: one "Fixed Expenses" pocket for everything.
    if (fixed.length === 1) return fixed[0];

    return undefined;
  }

  /**
   * Drop the homepage pocket that corresponded to a deleted fixed expense.
   * Unlocks first (fixed pockets are time-locked by default). Balance must
   * already be zero — see assertFixedPocketEmptyOrMissing.
   */
  private async removeFixedPocketForExpense(
    userId: string,
    expense: Pick<FixedExpense, 'name' | 'category'>,
  ): Promise<void> {
    const plan = await this.supabaseRepo.getActivePlanByUserId(userId);
    if (!plan) return;

    const pockets = await this.supabaseRepo.getTopLevelPocketsByPlanId(plan.id);
    const match = this.findMatchingFixedPocket(pockets, expense.name, expense.category);
    if (!match) return;

    if (pockets.length <= 1) {
      this.logger.warn(`skipped pocket delete for "${expense.name}": only pocket left on plan`);
      return;
    }

    try {
      if (match.is_time_locked) {
        await this.supabaseRepo.updatePocket(match.id, {
          is_time_locked: false,
          lock_until: null,
        });
      }
      await this.supabaseRepo.deletePocket(match.id);
    } catch (err) {
      this.logger.warn(
        `fixed-pocket delete sync failed for "${expense.name}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async assertFixedPocketEmptyOrMissing(
    userId: string,
    expense: Pick<FixedExpense, 'name' | 'category'>,
  ): Promise<void> {
    const plan = await this.supabaseRepo.getActivePlanByUserId(userId);
    if (!plan) return;

    const pockets = await this.supabaseRepo.getTopLevelPocketsByPlanId(plan.id);
    const match = this.findMatchingFixedPocket(pockets, expense.name, expense.category);
    if (!match) return;

    const summary = await this.supabaseRepo.getPocketSummary(match.id);
    if (Math.abs(summary.available) > 0.01) {
      throw new BadRequestException(
        `"${expense.name}" still has KSh ${Math.round(summary.available).toLocaleString()} in its pocket. ` +
          `Move that money to another pocket before deleting this fixed expense.`,
      );
    }
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