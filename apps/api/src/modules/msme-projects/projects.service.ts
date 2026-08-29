import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { 
  ProjectCreateInputSchema, 
  ProjectIncomeInputSchema,
  ProjectKindSchema,
  FundingTierSchema,
  ProjectStatusSchema,
} from '@financial-hub/shared';
import { 
  MsmeProject,
  MsmeProjectInsert,
  MsmeProjectUpdate,
  MsmeProjectTier,
  MsmeProjectTierInsert,
  MsmeProjectTierUpdate,
  MsmeProjectIncomeEvent,
  MsmeProjectIncomeEventInsert,
  MsmeProjectAllocation,
  MsmeProjectAllocationInsert,
  MsmeProjectSpend,
  MsmeProjectSpendInsert,
  MsmeProjectExcessPrompt,
  MsmeProjectExcessPromptInsert,
  MsmeProjectExcessPromptUpdate,
} from '../../database/database.types';
import { SupabaseRepository } from '../../database/supabase.repository';
import { FundingCascadeService, TierState, AllocationResult, FundingTier } from './funding-cascade.service';

export interface ProjectSummary {
  id: string;
  name: string;
  kind: string;
  contractValue: number;
  status: string;
  isActiveCascade: boolean;
  tiers: Array<{
    id: string;
    tier: FundingTier;
    sortOrder: number;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingStatus: 'in_progress' | 'complete';
    fundingPercent: number;
  }>;
  nextIncomeGoesTo: FundingTier | null;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  excessPending: number | null;
}

/**
 * Orchestration service for MSME Project Funding Cascade (§11–§15, §16–§21).
 * 
 * Responsibilities:
 * - Project CRUD (create, get, update status, activate cascade)
 * - Tier management (auto-created with project)
 * - Income event recording + cascade allocation (calls FundingCascadeService)
 * - Spending against tiers
 * - Excess prompt handling
 * - Ensures exactly one active cascade per user (via DB constraint + check)
 * - Segment-aware: only operates on MSME segment plans
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: SupabaseRepository,
    private readonly cascade: FundingCascadeService,
  ) {}

  /**
   * Creates a new MSME project with three funding tiers.
   * 
   * Flow:
   * 1. Validates input (tier targets sum to contract value)
   * 2. Gets user's active MSME plan
   * 3. Creates project (status='draft', is_active_cascade=false)
   * 4. Creates three tiers: Priorities(1), Needs(2), Wants(3)
   * 5. Returns project summary
   */
  async createProject(
    userId: string,
    input: unknown,
  ): Promise<ProjectSummary> {
    // Validate input
    const result = ProjectCreateInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: any) => i.message).join('; '));
    }
    const parsed = result.data;

    // Get user's active MSME plan
    const plan = await this.repository.getActivePlanByUserId(userId, 'msme');
    if (!plan) {
      throw new BadRequestException('User must have an active MSME plan to create a project');
    }

    // Validate tier targets sum to contract value
    const tierTargets = {
      priorities: parsed.tiers.priorities,
      needs: parsed.tiers.needs,
      wants: parsed.tiers.wants,
    };
    const totalTargets = tierTargets.priorities + tierTargets.needs + tierTargets.wants;
    if (Math.abs(totalTargets - parsed.contractValue) >= 0.01) {
      throw new BadRequestException('Tier targets must sum to contract value');
    }

    // Create project
    const projectInsert: MsmeProjectInsert = {
      user_id: userId,
      plan_id: plan.id,
      name: parsed.name,
      kind: parsed.kind,
      contract_value: parsed.contractValue,
      status: 'draft',
      is_active_cascade: false,
    };

    const project = await this.repository.createMsmeProject(projectInsert);
    if (!project) {
      throw new BadRequestException('Failed to create project');
    }

    // Create three tiers
    const tierConfigs: Array<{ tier: FundingTier; sortOrder: number; target: number }> = [
      { tier: 'priorities', sortOrder: 1, target: parsed.tiers.priorities },
      { tier: 'needs', sortOrder: 2, target: parsed.tiers.needs },
      { tier: 'wants', sortOrder: 3, target: parsed.tiers.wants },
    ];

    const createdTiers: MsmeProjectTier[] = [];
    for (const config of tierConfigs) {
      const tierInsert: MsmeProjectTierInsert = {
        project_id: project.id,
        tier: config.tier,
        sort_order: config.sortOrder,
        target_amount: config.target,
        allocated_amount: 0,
        spent_amount: 0,
      };
      const tier = await this.repository.createMsmeProjectTier(tierInsert);
      if (!tier) {
        throw new BadRequestException(`Failed to create ${config.tier} tier`);
      }
      createdTiers.push(tier);
    }

    // Return summary
    return this.buildProjectSummary(project, createdTiers);
  }

  /**
   * Gets all projects for a user (MSME segment only).
   */
  async getProjectsForUser(userId: string): Promise<ProjectSummary[]> {
    const projects = await this.repository.getMsmeProjectsByUserId(userId);
    const summaries: ProjectSummary[] = [];

    for (const project of projects) {
      const tiers = await this.repository.getMsmeProjectTiersByProjectId(project.id);
      summaries.push(await this.buildProjectSummary(project, tiers));
    }

    return summaries;
  }

  /**
   * Gets a single project by ID with full tier details.
   * Validates ownership.
   */
  async getProjectById(projectId: string, userId: string): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, tiers);
  }

  /**
   * Activates the cascade for a project.
   * 
   * Rules:
   * - Only one active cascade per user (enforced by DB unique partial index)
   * - Project must be in 'active' status
   * - Sets is_active_cascade = true
   */
  async activateCascade(projectId: string, userId: string): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (project.status !== 'active') {
      throw new BadRequestException('Only active projects can have cascade activated');
    }

    if (project.is_active_cascade) {
      return this.getProjectById(projectId, userId);
    }

    // Check if user already has an active cascade (DB constraint will also catch this)
    const existingActive = await this.repository.getActiveCascadeByUserId(userId);
    if (existingActive && existingActive.id !== projectId) {
      throw new ConflictException('You already have an active cascade on another project. Deactivate it first.');
    }

    // Activate cascade
    const updated = await this.repository.updateMsmeProject(projectId, { is_active_cascade: true });
    if (!updated) {
      throw new BadRequestException('Failed to activate cascade');
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updated, tiers);
  }

  /**
   * Deactivates the cascade for a project.
   */
  async deactivateCascade(projectId: string, userId: string): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (!project.is_active_cascade) {
      return this.getProjectById(projectId, userId);
    }

    const updated = await this.repository.updateMsmeProject(projectId, { is_active_cascade: false });
    if (!updated) {
      throw new BadRequestException('Failed to deactivate cascade');
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updated, tiers);
  }

  /**
   * Records an income event and runs the funding cascade allocation.
   * 
   * Flow (§16–§17):
   * 1. Validates income input
   * 2. Checks project ownership and active cascade
   * 3. Creates income_event record
   * 4. Gets current tier states
   * 5. Calls FundingCascadeService.allocateIncome()
   * 6. Creates allocation records for each tier
   * 7. Updates tier allocated_amount
   * 8. If excess -> creates excess prompt
   * 9. Returns updated project summary
   */
  async recordIncome(
    projectId: string,
    userId: string,
    input: unknown,
  ): Promise<ProjectSummary> {
    // Validate input
    const result = ProjectIncomeInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: any) => i.message).join('; '));
    }
    const parsed = result.data;

    // Get project and validate
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (!project.is_active_cascade) {
      throw new BadRequestException('Cascade must be active to record income');
    }

    // Get current tiers
    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    if (tiers.length !== 3) {
      throw new BadRequestException('Project must have exactly 3 tiers');
    }

    // Convert to TierState for cascade service
    const tierStates: TierState[] = tiers.map(t => ({
      tier: t.tier as FundingTier,
      targetAmount: Number(t.target_amount),
      allocatedAmount: Number(t.allocated_amount),
      spentAmount: Number(t.spent_amount),
    }));

    // Run cascade allocation
    const allocationResult = this.cascade.allocateIncome(parsed.amount, tierStates);

    // Create income event
    const incomeEventInsert: MsmeProjectIncomeEventInsert = {
      project_id: projectId,
      user_id: userId,
      amount: parsed.amount,
      source: parsed.source,
      label: parsed.label || null,
      date: parsed.date,
    };
    const incomeEvent = await this.repository.createMsmeProjectIncomeEvent(incomeEventInsert);
    if (!incomeEvent) {
      throw new BadRequestException('Failed to create income event');
    }

    // Create allocation records and update tiers
    for (const alloc of allocationResult.allocations) {
      const tier = tiers.find(t => t.tier === alloc.tier);
      if (!tier) continue;

      // Create allocation record
      const allocationInsert: MsmeProjectAllocationInsert = {
        project_id: projectId,
        tier_id: tier.id,
        income_event_id: incomeEvent.id,
        amount: alloc.amount,
      };
      await this.repository.createMsmeProjectAllocation(allocationInsert);

      // Update tier allocated_amount
      const newAllocated = Number(tier.allocated_amount) + alloc.amount;
      await this.repository.updateMsmeProjectTier(tier.id, { allocated_amount: newAllocated });
    }

    // Handle excess
    if (this.cascade.shouldCreateExcessPrompt(allocationResult)) {
      await this.createExcessPrompt(projectId, incomeEvent.id, allocationResult.excessAmount);
    }

    // Return updated summary
    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, updatedTiers);
  }

  /**
   * Records spending against a tier.
   * 
   * Flow (§14):
   * 1. Validates tier exists and belongs to project
   * 2. Checks available cash (allocated - spent)
   * 3. Creates spend record
   * 4. Updates tier spent_amount
   * 5. Returns updated project summary
   */
  async recordSpend(
    projectId: string,
    userId: string,
    tierId: string,
    amount: number,
    merchant?: string,
    category?: string,
    note?: string,
  ): Promise<ProjectSummary> {
    if (amount <= 0) {
      throw new BadRequestException('Spend amount must be positive');
    }

    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const tier = await this.repository.getMsmeProjectTierById(tierId);
    if (!tier) {
      throw new NotFoundException('Tier not found');
    }

    if (tier.project_id !== projectId) {
      throw new ForbiddenException('Tier does not belong to this project');
    }

    // Validate available cash
    const availableCash = Number(tier.allocated_amount) - Number(tier.spent_amount);
    if (amount > availableCash) {
      throw new BadRequestException(
        `Spend amount ${amount} exceeds available cash ${availableCash} in ${tier.tier} tier`
      );
    }

    // Create spend record
    const spendInsert: MsmeProjectSpendInsert = {
      tier_id: tierId,
      project_id: projectId,
      amount,
      merchant: merchant || null,
      category: category || null,
      note: note || null,
    };
    await this.repository.createMsmeProjectSpend(spendInsert);

    // Update tier spent_amount
    const newSpent = Number(tier.spent_amount) + amount;
    await this.repository.updateMsmeProjectTier(tierId, { spent_amount: newSpent });

    // Return updated summary
    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, updatedTiers);
  }

  /**
   * Dry-run cascade preview — no DB writes (§13 preview analogue to income.service allocatePreview).
   * Returns what allocateIncome WOULD do for a given amount.
   */
  async previewIncome(
    projectId: string,
    userId: string,
    input: unknown,
  ): Promise<{ allocations: { tier: FundingTier; amount: number }[]; excess: number; nextIncomeGoesTo: FundingTier | null }> {
    const result = ProjectIncomeInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: any) => i.message).join('; '));
    }
    const parsed = result.data;

    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException('You do not have access to this project');

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    if (tiers.length !== 3) throw new BadRequestException('Project must have exactly 3 tiers');

    const tierStates: TierState[] = tiers.map(t => ({
      tier: t.tier as FundingTier,
      targetAmount: Number(t.target_amount),
      allocatedAmount: Number(t.allocated_amount),
      spentAmount: Number(t.spent_amount),
    }));

    const allocation = this.cascade.previewAllocation(parsed.amount, tierStates);
    const nextIncomeGoesTo = this.cascade.getNextIncomeTier(
      // simulate post-allocation state for next pointer
      tierStates.map(ts => {
        const alloc = allocation.allocations.find(a => a.tier === ts.tier);
        return alloc ? { ...ts, allocatedAmount: ts.allocatedAmount + alloc.amount } : ts;
      }),
    );

    return {
      allocations: allocation.allocations,
      excess: allocation.excessAmount,
      nextIncomeGoesTo: allocation.allTiersComplete ? null : nextIncomeGoesTo,
    };
  }

  /**
   * Resolves an excess prompt with user's choice.
   * 
   * Flow (§21):
   * 1. Gets pending excess prompt for project
   * 2. Validates chosen target
   * 3. If 'needs' or 'wants': allocates excess to that tier
   * 4. If 'savings': creates excess_prompt record with chosen_target='savings'
   * 5. If 'keep': leaves as unallocated buffer
   * 6. Marks prompt as resolved
   */
  async resolveExcessPrompt(
    projectId: string,
    userId: string,
    promptId: string,
    chosenTarget: 'needs' | 'wants' | 'savings' | 'keep',
  ): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const prompt = await this.repository.getMsmeProjectExcessPromptById(promptId);
    if (!prompt) {
      throw new NotFoundException('Excess prompt not found');
    }

    if (prompt.project_id !== projectId) {
      throw new ForbiddenException('Prompt does not belong to this project');
    }

    if (prompt.status !== 'pending') {
      throw new BadRequestException('Prompt already resolved or dismissed');
    }

    if (!this.cascade.validateExcessTarget(chosenTarget)) {
      throw new BadRequestException('Invalid excess target');
    }

    const excessAmount = Number(prompt.excess_amount);

    // Handle different targets
    if (chosenTarget === 'needs' || chosenTarget === 'wants') {
      // Allocate excess to the chosen tier
      const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
      const targetTier = tiers.find(t => t.tier === chosenTarget);
      
      if (targetTier) {
        // Create allocation record
        const allocationInsert: MsmeProjectAllocationInsert = {
          project_id: projectId,
          tier_id: targetTier.id,
          income_event_id: prompt.income_event_id,
          amount: excessAmount,
        };
        await this.repository.createMsmeProjectAllocation(allocationInsert);

        // Update tier allocated_amount
        const newAllocated = Number(targetTier.allocated_amount) + excessAmount;
        await this.repository.updateMsmeProjectTier(targetTier.id, { allocated_amount: newAllocated });
      }
    }
    // For 'savings' and 'keep', we just record the choice - no tier allocation

    // Mark prompt as resolved
    const promptUpdate: MsmeProjectExcessPromptUpdate = {
      chosen_target: chosenTarget,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    };
    await this.repository.updateMsmeProjectExcessPrompt(promptId, promptUpdate);

    // Return updated summary
    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, updatedTiers);
  }

  /**
   * Dismisses an excess prompt (user chooses not to allocate excess).
   */
  async dismissExcessPrompt(
    projectId: string,
    userId: string,
    promptId: string,
  ): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const prompt = await this.repository.getMsmeProjectExcessPromptById(promptId);
    if (!prompt) {
      throw new NotFoundException('Excess prompt not found');
    }

    if (prompt.project_id !== projectId) {
      throw new ForbiddenException('Prompt does not belong to this project');
    }

    if (prompt.status !== 'pending') {
      throw new BadRequestException('Prompt already resolved or dismissed');
    }

    const promptUpdate: MsmeProjectExcessPromptUpdate = {
      status: 'dismissed',
      resolved_at: new Date().toISOString(),
    };
    await this.repository.updateMsmeProjectExcessPrompt(promptId, promptUpdate);

    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, updatedTiers);
  }

  /**
   * Updates project status (draft -> active, active -> completed/cancelled).
   * Validates state transitions.
   */
  async updateProjectStatus(
    projectId: string,
    userId: string,
    status: 'draft' | 'active' | 'completed' | 'cancelled',
  ): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Validate state transitions
    if (project.status === 'completed' || project.status === 'cancelled') {
      throw new BadRequestException(`Cannot change status from ${project.status}`);
    }

    if (status === 'active' && project.status !== 'draft') {
      throw new BadRequestException('Can only activate draft projects');
    }

    if ((status === 'completed' || status === 'cancelled') && project.status !== 'active') {
      throw new BadRequestException('Can only complete/cancel active projects');
    }

    // If deactivating, must turn off cascade first
    if (project.is_active_cascade && status !== 'active') {
      throw new BadRequestException('Must deactivate cascade before changing project status');
    }

    const update: MsmeProjectUpdate = { status };
    if (status === 'completed') update.completed_at = new Date().toISOString();
    if (status === 'cancelled') update.cancelled_at = new Date().toISOString();

    const updated = await this.repository.updateMsmeProject(projectId, update);
    if (!updated) {
      throw new BadRequestException('Failed to update project status');
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updated, tiers);
  }

  /**
   * Gets pending excess prompts for a project.
   */
  async getPendingExcessPrompts(projectId: string, userId: string): Promise<MsmeProjectExcessPrompt[]> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return this.repository.getMsmeProjectExcessPromptsByProjectId(projectId, 'pending');
  }

  /**
   * Gets paginated transactions (allocations + spends) for a project.
   */
  async getProjectTransactions(
    projectId: string,
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Array<{
      id: string;
      type: 'allocation' | 'spend';
      amount: number;
      tier: 'priorities' | 'needs' | 'wants';
      date: string;
      source?: string;
      merchant?: string;
      category?: string;
      note?: string;
    }>;
    page: number;
    limit: number;
    total: number;
  }> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const [allocations, spends] = await Promise.all([
      this.repository.getMsmeProjectAllocationsByProjectId(projectId),
      this.repository.getMsmeProjectSpendsByProjectId(projectId),
    ]);

    // Get tier info for each allocation/spend
    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    const tierMap = new Map(tiers.map(t => [t.id, t.tier]));

    // Combine and format transactions
    const allTransactions: Array<{
      id: string;
      type: 'allocation' | 'spend';
      amount: number;
      tier: 'priorities' | 'needs' | 'wants';
      date: string;
      source?: string;
      merchant?: string;
      category?: string;
      note?: string;
    }> = [
      ...allocations.map(a => ({
        id: a.id,
        type: 'allocation' as const,
        amount: Number(a.amount),
        tier: (tierMap.get(a.tier_id) as 'priorities' | 'needs' | 'wants') || 'priorities',
        date: a.created_at,
        source: a.income_event_id, // Could be enriched with income event source
      })),
      ...spends.map(s => ({
        id: s.id,
        type: 'spend' as const,
        amount: Number(s.amount),
        tier: (tierMap.get(s.tier_id) as 'priorities' | 'needs' | 'wants') || 'priorities',
        date: s.created_at,
        merchant: s.merchant ?? undefined,
        category: s.category ?? undefined,
        note: s.note ?? undefined,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = allTransactions.length;
    const start = (page - 1) * limit;
    const data = allTransactions.slice(start, start + limit);

    return { data, page, limit, total };
  }

  /**
   * Builds a ProjectSummary from project and tiers.
   * Checks for pending excess prompts to include excessPending.
   */
  private async buildProjectSummary(project: MsmeProject, tiers: MsmeProjectTier[]): Promise<ProjectSummary> {
    // Check for pending excess prompts
    const pendingPrompts = await this.repository.getMsmeProjectExcessPromptsByProjectId(project.id, 'pending');
    const excessPending = pendingPrompts.length > 0 
      ? pendingPrompts.reduce((sum, p) => sum + Number(p.excess_amount), 0)
      : null;

    const tierStates: TierState[] = tiers.map(t => ({
      tier: t.tier as FundingTier,
      targetAmount: Number(t.target_amount),
      allocatedAmount: Number(t.allocated_amount),
      spentAmount: Number(t.spent_amount),
    }));

    const summary = this.cascade.calculateProjectSummary(
      project.id,
      project.name,
      project.kind,
      Number(project.contract_value),
      project.status,
      project.is_active_cascade,
      tierStates
    );

    return {
      ...summary,
      excessPending,
      tiers: summary.tiers.map((t, i) => ({
        ...t,
        id: tiers[i]?.id || '',
      })),
    };
  }

  /**
   * Creates an excess prompt record.
   */
  private async createExcessPrompt(
    projectId: string,
    incomeEventId: string,
    excessAmount: number,
  ): Promise<void> {
    const promptInsert: MsmeProjectExcessPromptInsert = {
      project_id: projectId,
      income_event_id: incomeEventId,
      excess_amount: excessAmount,
      chosen_target: null,
      status: 'pending',
    };
    await this.repository.createMsmeProjectExcessPrompt(promptInsert);
  }
}