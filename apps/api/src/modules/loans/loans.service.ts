import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { 
  LoanCreateInputSchema, 
  LoanUpdateInputSchema, 
  LoanPurposePocketInputSchema,
  RepaymentCadenceSchema 
} from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { DisciplineScoreService } from '../discipline-score/discipline-score.service';
import { Pocket, PocketInsert, TransactionInsert } from '../../database/database.types';

/**
 * Loans Service - audit_team.md item 9
 * 
 * Manages loan pockets with repayment schedules and sub-pockets:
 * - Creates loan pockets with repayment schedules
 * - Manages system-created Repayment sub-pocket (locked, single-purpose)
 * - Manages user-defined purpose sub-pockets
 * - Integrates with discipline-score for behavioral signals
 * - Enforces due-day locking mechanism
 */
@Injectable()
export class LoansService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly disciplineScore: DisciplineScoreService,
  ) {}

  /**
   * Creates a new loan pocket with repayment schedule
   * - Validates repayment schedule math
   * - Creates loan pocket with kind='loan'
   * - Creates system-created Repayment sub-pocket
   * - Returns the complete loan detail with sub-pockets
   */
  async createLoan(
    userId: string,
    input: unknown,
    segment: 'individual' | 'msme' = 'individual',
  ): Promise<any> {
    const result = LoanCreateInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const parsed = result.data;

    // Validate repayment schedule math
    const schedule = this.buildRepaymentSchedule(parsed);
    this.validateRepaymentSchedule(schedule);

    // Get user's active plan — segment-aware for MSME Loan Plan (§10)
    const plan = await this.repository.getActivePlanByUserId(userId, segment);
    if (!plan) {
      throw new BadRequestException(`User must have an active ${segment} plan to create a loan`);
    }

    // Create loan pocket
    const loanPocketInsert: PocketInsert = {
      plan_id: plan.id,
      name: parsed.name,
      kind: 'loan',
      category: null, // Loan pockets don't have categories
      is_time_locked: false,
      lock_until: null,
      monthly_allocation: parsed.totalAmount, // Total loan amount as allocation
      daily_cap: null,
      repayment_schedule: schedule as any,
      loan_provider: parsed.loanProvider || null,
      loan_purpose: parsed.loanPurpose || null,
      due_day: parsed.dueDay,
    };

    const loanPocket = await this.repository.createPocket(loanPocketInsert);
    if (!loanPocket) {
      throw new BadRequestException('Failed to create loan pocket');
    }

    // Create system-created Repayment sub-pocket
    await this.createRepaymentSubPocket(
      loanPocket.id, 
      schedule.repaymentAmount
    );

    // Record loan creation as positive behavioral event
    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: 'loan_created',
      payload: {
        loan_id: loanPocket.id,
        loan_name: parsed.name,
        total_amount: parsed.totalAmount,
        provider: parsed.loanProvider,
      } as any,
    });

    // Return loan detail with sub-pockets
    return this.getLoanDetail(loanPocket.id, userId);
  }

  /**
   * Gets all loans for a user — segment-aware so MSME loans do not leak into
   * Individual queries and vice-versa (§10).
   */
  async getLoansForUser(
    userId: string,
    segment: 'individual' | 'msme' = 'individual',
  ): Promise<any[]> {
    const plan = await this.repository.getActivePlanByUserId(userId, segment);
    if (!plan) {
      return [];
    }

    // Top-level pockets only. Repayment/purpose sub-pockets inherit the
    // parent's kind ('loan') so they'd pass a bare `kind === 'loan'` filter
    // too — using the unfiltered getPocketsByPlanId here made every loan's
    // own Repayment sub-pocket (and any purpose sub-pockets) show up as a
    // separate top-level loan in this list. Same failure mode as the
    // getAllForUser sub-pocket leak fixed earlier for regular pockets.
    const topLevelPockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const loans = topLevelPockets.filter(p => p.kind === 'loan');

    // Enrich each loan with sub-pockets and repayment status
    return Promise.all(
      loans.map(loan => this.enrichLoanDetail(loan))
    );
  }

  /**
   * Gets detailed information about a specific loan
   */
  async getLoanDetail(loanId: string, userId: string): Promise<any> {
    const loan = await this.repository.getPocketById(loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    
    if (loan.kind !== 'loan' || (loan as any).parent_pocket_id) {
      throw new BadRequestException('Pocket is not a loan');
    }

    // Check ownership
    const plan = await this.repository.getPlanById(loan.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this loan');
    }

    return this.enrichLoanDetail(loan);
  }

  /**
   * Updates loan details (schedule, provider, purpose)
   */
  async updateLoan(loanId: string, userId: string, updates: unknown): Promise<any> {
    const result = LoanUpdateInputSchema.safeParse(updates);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const parsed = result.data;

    const loan = await this.repository.getPocketById(loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.kind !== 'loan') {
      throw new BadRequestException('Pocket is not a loan');
    }

    // Check ownership
    const plan = await this.repository.getPlanById(loan.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this loan');
    }

    // If repayment schedule is being updated, validate it
    if (parsed.repaymentSchedule) {
      const existingSchedule = loan.repayment_schedule as any;
      const updatedSchedule = { ...existingSchedule, ...parsed.repaymentSchedule };
      this.validateRepaymentSchedule(updatedSchedule);
      
      // Update next due date if schedule changed
      const nextDueDate = this.calculateNextDueDate(updatedSchedule);
      updatedSchedule.nextDueDate = nextDueDate;
    }

    const updateData: any = {};
    if (parsed.repaymentSchedule) updateData.repayment_schedule = parsed.repaymentSchedule;
    if (parsed.loanProvider !== undefined) updateData.loan_provider = parsed.loanProvider;
    if (parsed.loanPurpose !== undefined) updateData.loan_purpose = parsed.loanPurpose;

    const updated = await this.repository.updatePocket(loanId, updateData);
    if (!updated) {
      throw new NotFoundException('Failed to update loan');
    }

    return this.getLoanDetail(loanId, userId);
  }

  /**
   * Creates a purpose sub-pocket under a loan
   * - User-defined sub-pockets for loan purpose (school fees, business stock, etc.)
   * - Single-purpose merchant enforcement applies
   */
  async createPurposeSubPocket(loanId: string, userId: string, input: unknown): Promise<Pocket> {
    const result = LoanPurposePocketInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: { message: string }) => i.message).join('; '));
    }
    const parsed = result.data;

    const loan = await this.repository.getPocketById(loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.kind !== 'loan') {
      throw new BadRequestException('Can only create purpose sub-pockets under loan pockets');
    }

    // Check ownership
    const plan = await this.repository.getPlanById(loan.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this loan');
    }

    // Validate that purpose sub-pocket split percentage doesn't exceed available space
    const currentSubPockets = await this.repository.getSubPocketsByParentId(loanId);
    const currentPurposeSplits = currentSubPockets
      .filter(p => p.name !== 'Repayment') // Exclude the system repayment sub-pocket
      .reduce((sum, p) => sum + (p.split_percentage || 0), 0);
    
    const repaymentSubPocket = currentSubPockets.find(p => p.name === 'Repayment');
    const currentRepaymentSplit = repaymentSubPocket?.split_percentage || 100;

    // Calculate new split percentages
    const newPurposeSplit = currentPurposeSplits + parsed.splitPercentage;
    const newRepaymentSplit = 100 - newPurposeSplit;

    if (newPurposeSplit > 100) {
      throw new BadRequestException(
        `Purpose sub-pocket split (${parsed.splitPercentage}%) would exceed available loan amount (${100 - currentPurposeSplits}%)`
      );
    }

    // Create the purpose sub-pocket with split_percentage
    const purposeSubPocketInsert: PocketInsert = {
      plan_id: loan.plan_id,
      name: parsed.name,
      kind: loan.kind, // Inherit parent's kind
      category: parsed.category,
      is_time_locked: false,
      lock_until: null,
      monthly_allocation: 0, // Will be calculated by system based on split_percentage
      daily_cap: null,
      parent_pocket_id: loanId,
      split_percentage: parsed.splitPercentage,
    };

    const purposeSubPocket = await this.repository.createPocket(purposeSubPocketInsert);
    if (!purposeSubPocket) {
      throw new BadRequestException('Failed to create purpose sub-pocket');
    }

    // Update the repayment sub-pocket split percentage to maintain 100% total
    if (repaymentSubPocket) {
      await this.repository.updatePocket(repaymentSubPocket.id, {
        split_percentage: newRepaymentSplit,
      });
    }

    return purposeSubPocket;
  }

  /**
   * Funds the repayment sub-pocket for a loan
   * - Records repayment transaction
   * - Updates repayment schedule progress
   * - Triggers behavioral events based on timing
   */
  async fundRepayment(loanId: string, userId: string, amount: number): Promise<any> {
    if (amount <= 0) {
      throw new BadRequestException('Repayment amount must be positive');
    }

    const loan = await this.repository.getPocketById(loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (loan.kind !== 'loan') {
      throw new BadRequestException('Can only fund repayment for loan pockets');
    }

    // Check ownership
    const plan = await this.repository.getPlanById(loan.plan_id);
    if (!plan || plan.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this loan');
    }

    const schedule = loan.repayment_schedule as any;
    if (!schedule) {
      throw new BadRequestException('Loan has no repayment schedule');
    }

    // Find the repayment sub-pocket
    const subPockets = await this.repository.getSubPocketsByParentId(loanId);
    const repaymentSubPocket = subPockets.find(p => p.name === 'Repayment');
    
    if (!repaymentSubPocket) {
      throw new BadRequestException('Repayment sub-pocket not found');
    }

    // Check if repayment amount matches schedule
    if (amount !== schedule.repaymentAmount) {
      throw new BadRequestException(
        `Repayment amount (${amount}) must match scheduled repayment amount (${schedule.repaymentAmount})`
      );
    }

    // Record the repayment transaction
    const transactionInsert: TransactionInsert = {
      pocket_id: repaymentSubPocket.id,
      amount: amount, // Credit to repayment sub-pocket
      type: 'allocation',
      merchant: 'Loan Repayment',
      category: 'other',
    };

    await this.repository.createTransaction(transactionInsert);

    // Update repayment schedule progress. Schedule keys are camelCase
    // throughout (see RepaymentScheduleSchema / buildRepaymentSchedule) —
    // using payments_made here previously read/wrote a key that didn't
    // exist, so paymentsMade never actually advanced (see code review,
    // 2026-08-13): NaN broke the "is fully repaid" and "advance due date"
    // checks below, and silently persisted as `null` once round-tripped
    // through JSON into the JSONB column.
    const updatedSchedule = {
      ...schedule,
      paymentsMade: schedule.paymentsMade + 1,
    };

    // Calculate next due date
    if (updatedSchedule.paymentsMade < updatedSchedule.totalPayments) {
      updatedSchedule.nextDueDate = this.calculateNextDueDate(updatedSchedule);
    }

    await this.repository.updatePocket(loanId, {
      repayment_schedule: updatedSchedule as any,
    });

    // Check if repayment is on time or late
    const today = new Date().toISOString().split('T')[0];
    const isLate = today > schedule.nextDueDate;

    // Record behavioral event. Single source of truth for the point swing
    // — the payload below and the applyDelta call after it both derive
    // from this instead of each hardcoding their own +5/-3, which is what
    // let them drift apart before (payload had no points at all).
    const eventType = isLate ? 'loan_repayment_late' : 'loan_repayment_ontime';
    const scoreChange = isLate ? -3 : 5; // Negative for late, positive for on-time


    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: eventType,
      payload: {
        loan_id: loanId,
        loan_name: loan.name,
        amount: amount,
        due_date: schedule.nextDueDate,
        paid_date: today,
        is_late: isLate,
        // points_added/points_deducted follow the same convention every
        // other scoring event's payload uses (see InsightsService.
        // sumPeriodDisciplinePoints) so this event's real score movement
        // is readable generically instead of needing a bespoke reader.
        // Previously omitted, which — combined with these two event types
        // never being in sumPeriodDisciplinePoints' type list either —
        // meant on-time/late loan repayments silently never showed up in
        // "pts this period" despite genuinely moving the score below via
        // applyDelta.
        ...(isLate ? { points_deducted: -scoreChange } : { points_added: scoreChange }),
      } as any,
    });

    // Update discipline score
    await this.disciplineScore.applyDelta(userId, scoreChange);

    // Check if loan is fully repaid
    if (updatedSchedule.paymentsMade >= updatedSchedule.totalPayments) {
      await this.markLoanFullyRepaid(loanId, userId);
    }

    return this.getLoanDetail(loanId, userId);
  }

  /**
   * Creates the system-created Repayment sub-pocket
   * - Locked, single-purpose pocket for loan repayments
   * - Inherits parent's kind for merchant-scope rules
   */
  private async createRepaymentSubPocket(
    loanId: string, 
    repaymentAmount: number
  ): Promise<Pocket> {
    // Get the loan pocket to use its plan_id
    const loan = await this.repository.getPocketById(loanId);
    if (!loan) {
      throw new NotFoundException('Loan pocket not found');
    }

    // Calculate split percentage for repayment sub-pocket
    // It should take 100% of the loan by default (unless purpose sub-pockets are created)
    const repaymentSplitPercentage = 100;

    // Create the repayment sub-pocket directly using repository
    // to bypass the ownership check since this is a system-created pocket
    const repaymentSubPocketInsert: PocketInsert = {
      plan_id: loan.plan_id,
      name: 'Repayment',
      kind: loan.kind, // Inherit parent's kind
      category: 'other',
      is_time_locked: true, // Lock immediately
      lock_until: null,
      monthly_allocation: 0, // Will be calculated by system based on split_percentage
      daily_cap: null,
      parent_pocket_id: loanId,
      split_percentage: repaymentSplitPercentage,
    };

    const repaymentSubPocket = await this.repository.createPocket(repaymentSubPocketInsert);
    if (!repaymentSubPocket) {
      throw new BadRequestException('Failed to create repayment sub-pocket');
    }

    return repaymentSubPocket;
  }

  /**
   * Builds repayment schedule from loan creation input
   */
  private buildRepaymentSchedule(input: any): any {
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    
    // Calculate total number of payments based on cadence
    const totalPayments = this.calculateTotalPayments(startDate, endDate, input.cadence);
    
    return {
      totalAmount: input.totalAmount,
      repaymentAmount: input.repaymentAmount,
      cadence: input.cadence,
      startDate: input.startDate,
      endDate: input.endDate,
      nextDueDate: this.calculateNextDueDate({
        startDate: input.startDate,
        cadence: input.cadence,
      }),
      totalPayments,
      paymentsMade: 0,
    };
  }

  /**
   * Validates repayment schedule math
   */
  private validateRepaymentSchedule(schedule: any): void {
    // Validate that total payments * repayment amount equals total amount
    const expectedTotal = schedule.totalPayments * schedule.repaymentAmount;
    const tolerance = 0.01; // Small tolerance for floating point math
    
    if (Math.abs(expectedTotal - schedule.totalAmount) > tolerance) {
      throw new BadRequestException(
        `Repayment schedule invalid: ${schedule.totalPayments} payments of ${schedule.repaymentAmount} = ${expectedTotal}, but loan total is ${schedule.totalAmount}`
      );
    }

    // Validate dates
    if (new Date(schedule.startDate) >= new Date(schedule.endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate cadence
    RepaymentCadenceSchema.parse(schedule.cadence);
  }

  /**
   * Calculates total number of payments based on cadence
   */
  private calculateTotalPayments(startDate: Date, endDate: Date, cadence: string): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    switch (cadence) {
      case 'weekly':
        return Math.ceil(diffDays / 7);
      case 'biweekly':
        return Math.ceil(diffDays / 14);
      case 'monthly':
        return Math.ceil(diffDays / 30); // Approximate month as 30 days
      default:
        throw new BadRequestException(`Invalid cadence: ${cadence}`);
    }
  }

  /**
   * Calculates next due date based on cadence
   */
  private calculateNextDueDate(schedule: any): string {
    const lastPaymentDate = schedule.paymentsMade > 0
      ? new Date(schedule.nextDueDate)
      : new Date(schedule.startDate);

    switch (schedule.cadence) {
      case 'weekly':
        lastPaymentDate.setDate(lastPaymentDate.getDate() + 7);
        break;
      case 'biweekly':
        lastPaymentDate.setDate(lastPaymentDate.getDate() + 14);
        break;
      case 'monthly':
        lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);
        break;
    }

    return lastPaymentDate.toISOString().split('T')[0];
  }

  /**
   * Enriches loan detail with sub-pockets and repayment status
   */
  private async enrichLoanDetail(loan: Pocket): Promise<any> {
    const subPockets = await this.repository.getSubPocketsByParentId(loan.id);
    
    // Enrich sub-pockets with available balances
    const enrichedSubPockets = await Promise.all(
      subPockets.map(async (pocket) => {
        const summary = await this.repository.getPocketSummary(pocket.id);
        return { ...pocket, available_balance: summary.available };
      })
    );

    const schedule = loan.repayment_schedule as any;

    // Calculate repayment progress
    const progress = schedule ? {
      paymentsMade: schedule.paymentsMade,
      totalPayments: schedule.totalPayments,
      percentagePaid: (schedule.paymentsMade / schedule.totalPayments) * 100,
      amountPaid: schedule.paymentsMade * schedule.repaymentAmount,
      amountRemaining: (schedule.totalPayments - schedule.paymentsMade) * schedule.repaymentAmount,
      nextDueDate: schedule.nextDueDate,
      isOverdue: new Date() > new Date(schedule.nextDueDate),
    } : null;

    return {
      ...loan,
      repaymentSchedule: schedule,
      loanProvider: loan.loan_provider,
      loanPurpose: loan.loan_purpose,
      dueDay: loan.due_day,
      subPockets: enrichedSubPockets,
      progress,
    };
  }

  /**
   * Marks a loan as fully repaid
   */
  private async markLoanFullyRepaid(loanId: string, userId: string): Promise<void> {
    // Bonus for completing a loan — single source of truth for both the
    // event payload and the applyDelta call right below, same reasoning
    // as loan_repayment_ontime/late above.
    const bonus = 10;

    // Record completion event
    await this.repository.createBehaviorEvent({
      user_id: userId,
      type: 'loan_fully_repaid',
      payload: {
        loan_id: loanId,
        points_added: bonus,
      } as any,
    });

    // Award bonus discipline score for completing loan
    await this.disciplineScore.applyDelta(userId, bonus);
  }
}