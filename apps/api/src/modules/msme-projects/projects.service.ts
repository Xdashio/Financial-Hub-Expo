import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { 
  ProjectCreateInputSchema, 
  ProjectIncomeInputSchema,
  ProjectKindSchema,
  FundingTierSchema,
  ProjectStatusSchema,
  SpendingControlsSchema,
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
  TransactionInsert,
} from '../../database/database.types';
import * as Sentry from '@sentry/node';
import { SupabaseRepository } from '../../database/supabase.repository';
import { assertMoneyAmount } from '../../common/money-limits';
import { parsePagination } from '../../common/pagination';
import { FundingCascadeService, TierState, AllocationResult, FundingTier } from './funding-cascade.service';
import { PushDeliveryService } from '../notifications/push-delivery.service';

export interface SpendingControls {
  lockWantsUntilPrioritiesAndNeedsFunded: boolean;
  warnOnLowPrioritySpend: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  kind: string;
  contractValue: number;
  status: string;
  isActiveCascade: boolean;
  spendingControls?: SpendingControls;
  completionResolvedAt?: string | null;
  completionResolvedTo?: 'savings' | 'keep' | null;
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

export interface ProjectCompleteResult {
  project: ProjectSummary;
  remainingPerTier: Array<{ tier: FundingTier; remainingCash: number; targetAmount: number; allocatedAmount: number }>;
  totalRemaining: number;
  suggestion: string;
  requiresResolution: boolean;
}

/**
 * Orchestration service for MSME Project Funding Cascade (§11–§15, §16–§21).
 * Phase 5 additions: excess savings confirm (§21:526), completion (§22), spending controls (§20).
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly repository: SupabaseRepository,
    private readonly cascade: FundingCascadeService,
    private readonly pushDelivery?: PushDeliveryService,
  ) {}

  private defaultSpendingControls(): SpendingControls {
    return { lockWantsUntilPrioritiesAndNeedsFunded: false, warnOnLowPrioritySpend: false };
  }

  private parseSpendingControls(project: MsmeProject): SpendingControls {
    const raw: any = (project as any).spending_controls;
    if (!raw || typeof raw !== 'object') return this.defaultSpendingControls();
    return {
      lockWantsUntilPrioritiesAndNeedsFunded: Boolean(raw.lockWantsUntilPrioritiesAndNeedsFunded),
      warnOnLowPrioritySpend: Boolean(raw.warnOnLowPrioritySpend),
    };
  }

  private round2(n: number): number { return Math.round(n * 100) / 100; }

  /**
   * Creates a new MSME project with three funding tiers.
   */
  async createProject(
    userId: string,
    input: unknown,
  ): Promise<ProjectSummary> {
    const result = ProjectCreateInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: any) => i.message).join('; '));
    }
    const parsed = result.data;

    const plan = await this.repository.getActivePlanByUserId(userId, 'msme');
    if (!plan) {
      throw new BadRequestException('User must have an active MSME plan to create a project');
    }

    const tierTargets = {
      priorities: parsed.tiers.priorities,
      needs: parsed.tiers.needs,
      wants: parsed.tiers.wants,
    };
    const totalTargets = tierTargets.priorities + tierTargets.needs + tierTargets.wants;
    if (Math.abs(totalTargets - parsed.contractValue) >= 0.01) {
      throw new BadRequestException('Tier targets must sum to contract value');
    }

    const subPocketsData: Record<string, Array<{ id: string; name: string; targetAmount: number; spentAmount: number }>> = {};
    for (const tierKey of ['priorities', 'needs', 'wants'] as const) {
      const subs = parsed.subPockets?.[tierKey] ?? [];
      subPocketsData[tierKey] = subs.map((s, idx) => ({
        id: s.id || `${tierKey}-${idx + 1}-${Date.now().toString(36)}`,
        name: s.name,
        targetAmount: Number(s.targetAmount),
        spentAmount: 0,
      }));
    }

    const projectInsert: MsmeProjectInsert = {
      user_id: userId,
      plan_id: plan.id,
      name: parsed.name,
      kind: parsed.kind,
      contract_value: parsed.contractValue,
      status: 'draft',
      is_active_cascade: false,
      spending_controls: {
        ...this.defaultSpendingControls(),
        subPockets: subPocketsData,
      } as any,
    };

    const project = await this.repository.createMsmeProject(projectInsert);
    if (!project) {
      throw new BadRequestException('Failed to create project');
    }

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

    return this.buildProjectSummary(project, createdTiers);
  }

  async getProjectsForUser(userId: string, page?: number, limit?: number): Promise<any> {
    const projects = await this.repository.getMsmeProjectsByUserId(userId);
    const summaries: ProjectSummary[] = [];
    for (const project of projects) {
      const tiers = await this.repository.getMsmeProjectTiersByProjectId(project.id);
      summaries.push(await this.buildProjectSummary(project, tiers));
    }
    if (page != null || limit != null) {
      // M2: controllers sanitise, but sanitise again — the old
      // `Number(page) || 1` still let Infinity through uncapped.
      const { page: p, limit: l } = parsePagination(page, limit);
      const total = summaries.length;
      const totalPages = Math.ceil(total / l);
      const from = (p - 1) * l;
      return { data: summaries.slice(from, from + l), total, page: p, totalPages };
    }
    return summaries;
  }

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

    const existingActive = await this.repository.getActiveCascadeByUserId(userId);
    if (existingActive && existingActive.id !== projectId) {
      throw new ConflictException('You already have an active cascade on another project. Deactivate it first.');
    }

    const updated = await this.repository.updateMsmeProject(projectId, { is_active_cascade: true });
    if (!updated) {
      throw new BadRequestException('Failed to activate cascade');
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updated, tiers);
  }

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

  async recordIncome(
    projectId: string,
    userId: string,
    input: unknown,
  ): Promise<ProjectSummary> {
    const result = ProjectIncomeInputSchema.safeParse(input);
    if (!result.success) {
      throw new BadRequestException(result.error.issues.map((i: any) => i.message).join('; '));
    }
    const parsed = result.data;

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

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    if (tiers.length !== 3) {
      throw new BadRequestException('Project must have exactly 3 tiers');
    }

    const tierStates: TierState[] = tiers.map(t => ({
      tier: t.tier as FundingTier,
      targetAmount: Number(t.target_amount),
      allocatedAmount: Number(t.allocated_amount),
      spentAmount: Number(t.spent_amount),
    }));

    const allocationResult = this.cascade.allocateIncome(parsed.amount, tierStates);

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

    for (const alloc of allocationResult.allocations) {
      const tier = tiers.find(t => t.tier === alloc.tier);
      if (!tier) continue;

      const allocationInsert: MsmeProjectAllocationInsert = {
        project_id: projectId,
        tier_id: tier.id,
        income_event_id: incomeEvent.id,
        amount: alloc.amount,
      };
      await this.repository.createMsmeProjectAllocation(allocationInsert);

      const newAllocated = Number(tier.allocated_amount) + alloc.amount;
      await this.repository.updateMsmeProjectTier(tier.id, { allocated_amount: newAllocated });
    }

    if (this.cascade.shouldCreateExcessPrompt(allocationResult)) {
      await this.createExcessPrompt(projectId, incomeEvent.id, allocationResult.excessAmount);
      // Fire-and-forget push for excess (§21) — log + Sentry breadcrumb (B-08)
      if (this.pushDelivery) {
        void this.pushDelivery.notifyProjectExcess(userId, projectId, project.name, allocationResult.excessAmount, incomeEvent.id).catch(err => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`project excess push failed: ${msg}`);
          try { Sentry.addBreadcrumb({ category: 'push', level: 'warning', message: `excess push failed ${projectId}`, data: { userId, excessAmount: allocationResult.excessAmount, error: msg } }); } catch {}
        });
      }
    }

    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, updatedTiers);
  }

  async recordSpend(
    projectId: string,
    userId: string,
    tierId: string,
    amount: number,
    merchant?: string,
    category?: string,
    note?: string,
    confirmRisky?: boolean,
    subPocketId?: string,
  ): Promise<ProjectSummary> {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Spend amount must be a positive finite number');
    }
    // M1: finite is not enough — cap single spends at the money ceiling.
    assertMoneyAmount(amount, 'amount', { min: 0.01 });

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

    // Phase 5 spending controls §20 — Wants lock
    if ((tier.tier as FundingTier) === 'wants') {
      const controls = this.parseSpendingControls(project);
      if (controls.lockWantsUntilPrioritiesAndNeedsFunded) {
        const allTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
        const pri = allTiers.find(t => t.tier === 'priorities');
        const needs = allTiers.find(t => t.tier === 'needs');
        const priComplete = pri ? Number(pri.allocated_amount) >= Number(pri.target_amount) : false;
        const needsComplete = needs ? Number(needs.allocated_amount) >= Number(needs.target_amount) : false;
        if (!priComplete || !needsComplete) {
          if (confirmRisky !== true) {
            throw new BadRequestException(
              'Wants locked until Priorities and Needs are fully funded — pass confirmRisky:true to override. Spending on Wants before higher priorities is discouraged (see §20).',
            );
          }
        }
      }
    }

    const availableCash = Number(tier.allocated_amount) - Number(tier.spent_amount);
    if (amount > availableCash) {
      throw new BadRequestException(
        `Spend amount ${amount} exceeds available cash ${availableCash} in ${tier.tier} tier`
      );
    }

    const spendInsert: MsmeProjectSpendInsert = {
      tier_id: tierId,
      project_id: projectId,
      amount,
      merchant: merchant || null,
      category: category || null,
      note: note || null,
    };
    await this.repository.createMsmeProjectSpend(spendInsert);

    const newSpent = Number(tier.spent_amount) + amount;
    await this.repository.updateMsmeProjectTier(tierId, { spent_amount: newSpent });

    // If a sub-pocket was targeted, record spend in spending_controls.subPockets
    let updatedProject = project;
    if (subPocketId) {
      const controls: any = (project as any).spending_controls || {};
      const subPocketsMap = controls.subPockets || {};
      const tierSubs: any[] = subPocketsMap[tier.tier] || [];
      const sub = tierSubs.find((s: any) => s.id === subPocketId);
      if (sub) {
        sub.spentAmount = (Number(sub.spentAmount) || 0) + amount;
        const updatedControls = {
          ...controls,
          subPockets: {
            ...subPocketsMap,
            [tier.tier]: tierSubs,
          },
        };
        const res = await this.repository.updateMsmeProject(projectId, {
          spending_controls: updatedControls,
        });
        if (res) updatedProject = res;
      }
    }

    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updatedProject, updatedTiers);
  }

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

  async resolveExcessPrompt(
    projectId: string,
    userId: string,
    promptId: string,
    chosenTarget: 'needs' | 'wants' | 'savings' | 'keep',
    confirmSavings?: boolean,
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

    // §21:525 — Savings requires explicit confirmation
    if (chosenTarget === 'savings' && confirmSavings !== true) {
      throw new BadRequestException('Moving excess to Savings requires explicit confirmation (confirmSavings: true). Confirm the move to Savings on a second tap.');
    }

    const excessAmount = Number(prompt.excess_amount);

    if (chosenTarget === 'needs' || chosenTarget === 'wants') {
      const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
      const targetTier = tiers.find(t => t.tier === chosenTarget);
      
      if (!targetTier) {
        throw new BadRequestException(`Target tier ${chosenTarget} not found`);
      }
      // Validate not already complete — if complete, suggest savings instead
      if (Number(targetTier.allocated_amount) >= Number(targetTier.target_amount)) {
        throw new BadRequestException(
          `Target tier ${chosenTarget} is already fully funded (Allocated ${targetTier.allocated_amount} / Target ${targetTier.target_amount}). Choose savings or keep instead.`,
        );
      }
      const allocationInsert: MsmeProjectAllocationInsert = {
        project_id: projectId,
        tier_id: targetTier.id,
        income_event_id: prompt.income_event_id,
        amount: excessAmount,
      };
      await this.repository.createMsmeProjectAllocation(allocationInsert);

      const newAllocated = Number(targetTier.allocated_amount) + excessAmount;
      await this.repository.updateMsmeProjectTier(targetTier.id, { allocated_amount: newAllocated });
    } else if (chosenTarget === 'savings') {
      // Move excess to user's MSME savings pocket(s)
      await this.moveProjectFundsToMsmeSavings(userId, excessAmount, `Project excess: ${project.name}`);
    }
    // 'keep' — no tier allocation, just mark resolved

    const promptUpdate: MsmeProjectExcessPromptUpdate = {
      chosen_target: chosenTarget,
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    };
    await this.repository.updateMsmeProjectExcessPrompt(promptId, promptUpdate);

    const updatedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(project, updatedTiers);
  }

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

    if (project.status === 'completed' || project.status === 'cancelled') {
      throw new BadRequestException(`Cannot change status from ${project.status}`);
    }

    if (status === 'active' && project.status !== 'draft') {
      throw new BadRequestException('Can only activate draft projects');
    }

    if ((status === 'completed' || status === 'cancelled') && project.status !== 'active') {
      throw new BadRequestException('Can only complete/cancel active projects');
    }

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
   * Phase 5 §22 — Complete project with remaining-funds summary.
   * Unlike updateProjectStatus, this handles cascade deactivation internally
   * and returns the UX-required remainingPerTier/totalRemaining/suggestion.
   */
  async completeProject(projectId: string, userId: string): Promise<ProjectCompleteResult> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException('You do not have access to this project');
    if (project.status !== 'active') throw new BadRequestException('Only active projects can be completed');
    
    // Auto-deactivate cascade if still active — mobile previously did this in two calls.
    let workingProject: MsmeProject = project;
    if (project.is_active_cascade) {
      const deactivated = await this.repository.updateMsmeProject(projectId, { is_active_cascade: false });
      if (!deactivated) throw new BadRequestException('Failed to deactivate cascade before completion');
      workingProject = deactivated;
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    const remainingPerTier = tiers.map(t => ({
      tier: t.tier as FundingTier,
      remainingCash: Math.max(0, Number(t.allocated_amount) - Number(t.spent_amount)),
      targetAmount: Number(t.target_amount),
      allocatedAmount: Number(t.allocated_amount),
    }));
    const totalRemaining = remainingPerTier.reduce((s, r) => s + r.remainingCash, 0);
    const requiresResolution = totalRemaining > 0;

    const update: MsmeProjectUpdate = {
      status: 'completed',
      completed_at: new Date().toISOString(),
      // reset completion resolution audit until user acts
      completion_resolved_at: null,
      completion_resolved_to: null,
    };
    const completed = await this.repository.updateMsmeProject(projectId, update);
    if (!completed) throw new BadRequestException('Failed to mark project completed');

    if (this.pushDelivery) {
      void this.pushDelivery.notifyProjectCompleted(userId, projectId, project.name, totalRemaining).catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`project completed push failed: ${msg}`);
        try { Sentry.addBreadcrumb({ category: 'push', level: 'warning', message: `completed push failed ${projectId}`, data: { userId, totalRemaining, error: msg } }); } catch {}
      });
    }

    const summary = await this.buildProjectSummary(completed, tiers);
    const suggestion = requiresResolution
      ? `Project completed — KSh ${this.round2(totalRemaining).toLocaleString('en-KE')} unused. Keep in project or move to Savings? Confirm with target:savings + confirmSavings:true.`
      : 'Project completed — no remaining funds.';
    return {
      project: summary,
      remainingPerTier,
      totalRemaining: this.round2(totalRemaining),
      suggestion,
      requiresResolution,
    };
  }

  /**
   * Phase 5 §22 — Resolve completed project remaining funds.
   */
  async resolveProjectCompletion(
    projectId: string,
    userId: string,
    target: 'savings' | 'keep',
    confirmSavings?: boolean,
  ): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException('You do not have access to this project');
    if (project.status !== 'completed') throw new BadRequestException('Only completed projects can resolve remaining funds');
    if ((project as any).completion_resolved_to) throw new BadRequestException('Project completion already resolved');
    if (target !== 'savings' && target !== 'keep') throw new BadRequestException('Invalid completion target — use savings or keep');
    if (target === 'savings' && confirmSavings !== true) {
      throw new BadRequestException('Moving remaining to Savings requires explicit confirmation (confirmSavings: true)');
    }

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    const totalRemaining = tiers.reduce((s, t) => s + Math.max(0, Number(t.allocated_amount) - Number(t.spent_amount)), 0);

    if (target === 'savings' && totalRemaining > 0) {
      await this.moveProjectFundsToMsmeSavings(userId, this.round2(totalRemaining), `Project completed: ${project.name}`);
    }

    const updated = await this.repository.updateMsmeProject(projectId, {
      completion_resolved_at: new Date().toISOString(),
      completion_resolved_to: target,
    });
    if (!updated) throw new BadRequestException('Failed to resolve completion');

    const refreshedTiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updated, refreshedTiers);
  }

  /**
   * Phase 5 §20 — Update spending controls for a project.
   */
  async updateSpendingControls(
    projectId: string,
    userId: string,
    patch: Partial<SpendingControls>,
  ): Promise<ProjectSummary> {
    const project = await this.repository.getMsmeProjectById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.user_id !== userId) throw new ForbiddenException('You do not have access to this project');

    const parsed = SpendingControlsSchema.partial().safeParse(patch);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    }

    const current = this.parseSpendingControls(project);
    const merged: SpendingControls = {
      lockWantsUntilPrioritiesAndNeedsFunded: parsed.data.lockWantsUntilPrioritiesAndNeedsFunded ?? current.lockWantsUntilPrioritiesAndNeedsFunded,
      warnOnLowPrioritySpend: parsed.data.warnOnLowPrioritySpend ?? current.warnOnLowPrioritySpend,
    };
    const updated = await this.repository.updateMsmeProject(projectId, {
      spending_controls: merged,
    });
    if (!updated) throw new BadRequestException('Failed to update spending controls');
    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    return this.buildProjectSummary(updated, tiers);
  }

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

    // M2: cap limit at 50, fall back on NaN — same rule as every other list.
    ({ page, limit } = parsePagination(page, limit));

    const [allocations, spends] = await Promise.all([
      this.repository.getMsmeProjectAllocationsByProjectId(projectId),
      this.repository.getMsmeProjectSpendsByProjectId(projectId),
    ]);

    const tiers = await this.repository.getMsmeProjectTiersByProjectId(projectId);
    const tierMap = new Map(tiers.map(t => [t.id, t.tier]));

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
        source: a.income_event_id,
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

  private async buildProjectSummary(project: MsmeProject, tiers: MsmeProjectTier[]): Promise<ProjectSummary> {
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

    const rawControls: any = (project as any).spending_controls || {};
    const subPocketsMap: Record<string, any[]> = rawControls.subPockets || {};

    return {
      ...summary,
      spendingControls: this.parseSpendingControls(project),
      completionResolvedAt: (project as any).completion_resolved_at ?? null,
      completionResolvedTo: (project as any).completion_resolved_to ?? null,
      excessPending,
      tiers: summary.tiers.map((t, i) => {
        const tierEntity = tiers[i];
        const subs = (subPocketsMap[t.tier] ?? []) as Array<{ id: string; name: string; targetAmount: number; spentAmount?: number }>;
        const tierTarget = Number(t.targetAmount);
        const tierAllocated = Number(t.allocatedAmount);
        const subPocketsSummary = subs.map(s => {
          const target = Number(s.targetAmount) || 0;
          const allocated = tierTarget > 0 ? this.round2((target / tierTarget) * tierAllocated) : 0;
          const spent = Number(s.spentAmount) || 0;
          const remaining = Math.max(0, this.round2(allocated - spent));
          const percent = target > 0 ? Math.min(100, Math.round((allocated / target) * 100)) : 0;
          return {
            id: s.id,
            name: s.name,
            targetAmount: target,
            allocatedAmount: allocated,
            spentAmount: spent,
            remainingCash: remaining,
            fundingPercent: percent,
          };
        });

        return {
          ...t,
          id: tierEntity?.id || '',
          subPockets: subPocketsSummary.length > 0 ? subPocketsSummary : undefined,
        };
      }),
    };
  }

  private async moveProjectFundsToMsmeSavings(userId: string, amount: number, contextLabel: string): Promise<void> {
    if (amount <= 0) return;
    const plan = await this.repository.getActivePlanByUserId(userId, 'msme');
    if (!plan) {
      throw new BadRequestException('No active MSME plan found to receive savings transfer');
    }
    const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
    const savingsPockets = pockets.filter(p => p.kind === 'savings');
    if (savingsPockets.length === 0) {
      throw new BadRequestException('No MSME savings pocket found — create a savings pocket before moving project funds to savings');
    }

    let allocations: Array<{ pocket_id: string; amount: number }>;
    const rounded = this.round2(amount);
    if (savingsPockets.length === 1) {
      allocations = [{ pocket_id: savingsPockets[0].id, amount: rounded }];
    } else {
      const totalAlloc = savingsPockets.reduce((s, p) => s + (Number(p.monthly_allocation) || 0), 0);
      if (totalAlloc > 0) {
        allocations = savingsPockets.map(p => ({
          pocket_id: p.id,
          amount: this.round2((rounded * (Number(p.monthly_allocation) || 0)) / totalAlloc),
        }));
        const sum = allocations.reduce((s, a) => s + a.amount, 0);
        const remainder = this.round2(rounded - sum);
        if (remainder !== 0 && allocations.length > 0) {
          const largest = allocations.reduce((max, a) => (a.amount > max.amount ? a : max), allocations[0]);
          largest.amount = this.round2(largest.amount + remainder);
        }
      } else {
        const per = this.round2(rounded / savingsPockets.length);
        allocations = savingsPockets.map((p, i) => ({
          pocket_id: p.id,
          amount: i === savingsPockets.length - 1 ? this.round2(rounded - per * (savingsPockets.length - 1)) : per,
        }));
      }
    }

    const transactions: TransactionInsert[] = allocations
      .filter(a => a.amount > 0)
      .map(a => ({
        pocket_id: a.pocket_id,
        amount: a.amount,
        type: 'allocation' as const,
        merchant: contextLabel.slice(0, 100),
        category: null,
      }));
    if (transactions.length === 0) throw new BadRequestException('No savings allocation computed');
    await this.repository.createTransactions(transactions);
  }

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
