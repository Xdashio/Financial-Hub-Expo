import { Controller, Get, Post, Put, Patch, Param, Body, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectsService, ProjectSummary, ProjectCompleteResult, SpendingControls } from './projects.service';
import { parsePagination } from '../../common/pagination';

@ApiTags('MSME Projects')
@Controller('msme/projects')
@ApiBearerAuth()
export class MsmeProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's MSME projects — paginated" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Array (no pagination) or {data,total,page,totalPages} when page/limit set' })
  async getAll(@Request() req: any, @Query('page') page?: string, @Query('limit') limit?: string): Promise<any> {
    // M2: the old `Number(page)` passed NaN straight into the service when
    // ?page= garbage was supplied; sanitise with fallbacks instead.
    const { page: pg, limit: lim } = parsePagination(page, limit);
    return this.projectsService.getProjectsForUser(
      req.user.id,
      page !== undefined || limit !== undefined ? pg : undefined,
      page !== undefined || limit !== undefined ? lim : undefined,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new MSME project with funding tiers' })
  @ApiResponse({ status: 201, description: 'Project created with three tiers (Priorities, Needs, Wants)' })
  @ApiResponse({ status: 400, description: 'Invalid input or tier targets do not sum to contract value' })
  @ApiResponse({ status: 400, description: 'User must have an active MSME plan' })
  async create(
    @Body() input: unknown,
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.createProject(req.user.id, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed information about a specific project' })
  @ApiResponse({ status: 200, description: 'Project with tier details, funding status, and cascade info' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  async getById(@Param('id') id: string, @Request() req: any): Promise<ProjectSummary> {
    return this.projectsService.getProjectById(id, req.user.id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update project status (draft → active → completed/cancelled)' })
  @ApiResponse({ status: 200, description: 'Updated project summary' })
  @ApiResponse({ status: 400, description: 'Invalid state transition or cascade still active' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'draft' | 'active' | 'completed' | 'cancelled' },
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.updateProjectStatus(id, req.user.id, body.status);
  }

  // ── Phase 5: completion (§22) ──────────────────────────────────────────
  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete an active project — returns remaining-funds summary (§22)' })
  @ApiResponse({ status: 200, description: 'Project completed with remainingPerTier / suggestion' })
  @ApiResponse({ status: 400, description: 'Only active projects can be completed' })
  async completeProject(@Param('id') id: string, @Request() req: any): Promise<ProjectCompleteResult> {
    return this.projectsService.completeProject(id, req.user.id);
  }

  @Post(':id/complete/resolve')
  @ApiOperation({ summary: 'Resolve completed project remaining funds — savings requires confirmSavings:true (§22)' })
  @ApiResponse({ status: 200, description: 'Completion resolved, funds moved if target=savings' })
  @ApiResponse({ status: 400, description: 'Already resolved or missing confirmSavings' })
  async resolveCompletion(
    @Param('id') id: string,
    @Body() body: { target: 'savings' | 'keep'; confirmSavings?: boolean },
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.resolveProjectCompletion(id, req.user.id, body.target, body.confirmSavings);
  }

  // ── Phase 5: spending controls (§20) ───────────────────────────────────
  @Patch(':id/spending-controls')
  @ApiOperation({ summary: 'Update spending controls (Wants lock / warn) for a project (§20)' })
  @ApiResponse({ status: 200, description: 'Updated project with new spending controls' })
  async updateSpendingControls(
    @Param('id') id: string,
    @Body() body: Partial<SpendingControls>,
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.updateSpendingControls(id, req.user.id, body);
  }

  @Post(':id/activate-cascade')
  @ApiOperation({ summary: 'Activate the funding cascade for this project' })
  @ApiResponse({ status: 200, description: 'Cascade activated, project ready to receive income' })
  @ApiResponse({ status: 400, description: 'Project must be active, or user already has an active cascade' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  @ApiResponse({ status: 409, description: 'Another project already has active cascade' })
  async activateCascade(@Param('id') id: string, @Request() req: any): Promise<ProjectSummary> {
    return this.projectsService.activateCascade(id, req.user.id);
  }

  @Post(':id/deactivate-cascade')
  @ApiOperation({ summary: 'Deactivate the funding cascade for this project' })
  @ApiResponse({ status: 200, description: 'Cascade deactivated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  async deactivateCascade(@Param('id') id: string, @Request() req: any): Promise<ProjectSummary> {
    return this.projectsService.deactivateCascade(id, req.user.id);
  }

  @Post(':id/income')
  @ApiOperation({ summary: 'Record an income event and run cascade allocation' })
  @ApiResponse({ status: 200, description: 'Income recorded, cascade allocation completed, updated project returned' })
  @ApiResponse({ status: 400, description: 'Invalid input, cascade not active, or project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async recordIncome(
    @Param('id') id: string,
    @Body() input: unknown,
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.recordIncome(id, req.user.id, input);
  }

  @Post(':id/income/preview')
  @ApiOperation({ summary: 'Preview cascade allocation for a hypothetical income (no DB write)' })
  @ApiResponse({ status: 200, description: 'Projected per-tier allocations and excess' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  async previewIncome(
    @Param('id') id: string,
    @Body() input: unknown,
    @Request() req: any,
  ) {
    return this.projectsService.previewIncome(id, req.user.id, input);
  }

  @Post(':id/spend')
  @ApiOperation({ summary: 'Record spending against a specific tier (respects §20 Wants lock when enabled)' })
  @ApiResponse({ status: 200, description: 'Spend recorded, tier updated, updated project returned' })
  @ApiResponse({ status: 400, description: 'Invalid amount, insufficient cash, tier not found, or Wants locked' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  @ApiResponse({ status: 404, description: 'Project or tier not found' })
  async recordSpend(
    @Param('id') id: string,
    @Body() body: { tierId: string; subPocketId?: string; amount: number; merchant?: string; category?: string; note?: string; confirmRisky?: boolean },
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.recordSpend(
      id,
      req.user.id,
      body.tierId,
      body.amount,
      body.merchant,
      body.category,
      body.note,
      body.confirmRisky,
      body.subPocketId,
    );
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get paginated transactions (allocations + spends) for a project' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  async getTransactions(
    @Param('id') id: string,
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { page: pg, limit: lim } = parsePagination(page, limit);
    return this.projectsService.getProjectTransactions(id, req.user.id, pg, lim);
  }

  @Get(':id/excess-prompts')
  @ApiOperation({ summary: 'Get pending excess prompts for a project' })
  @ApiResponse({ status: 200, description: 'List of pending excess prompts' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  async getPendingExcessPrompts(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.getPendingExcessPrompts(id, req.user.id);
  }

  @Post(':id/excess-prompts/:promptId/resolve')
  @ApiOperation({ summary: 'Resolve an excess prompt with a chosen target — savings requires confirmSavings:true (§21)' })
  @ApiResponse({ status: 200, description: 'Excess resolved, project updated' })
  @ApiResponse({ status: 400, description: 'Invalid target, prompt already resolved, or missing confirmSavings for savings' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  @ApiResponse({ status: 404, description: 'Project or prompt not found' })
  async resolveExcessPrompt(
    @Param('id') id: string,
    @Param('promptId') promptId: string,
    @Body() body: { chosenTarget: 'needs' | 'wants' | 'savings' | 'keep'; confirmSavings?: boolean },
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.resolveExcessPrompt(id, req.user.id, promptId, body.chosenTarget, body.confirmSavings);
  }

  @Post(':id/excess-prompts/:promptId/dismiss')
  @ApiOperation({ summary: 'Dismiss an excess prompt (leave excess unallocated)' })
  @ApiResponse({ status: 200, description: 'Prompt dismissed' })
  @ApiResponse({ status: 400, description: 'Prompt already resolved or dismissed' })
  @ApiResponse({ status: 403, description: 'You do not have access to this project' })
  @ApiResponse({ status: 404, description: 'Project or prompt not found' })
  async dismissExcessPrompt(
    @Param('id') id: string,
    @Param('promptId') promptId: string,
    @Request() req: any,
  ): Promise<ProjectSummary> {
    return this.projectsService.dismissExcessPrompt(id, req.user.id, promptId);
  }
}
