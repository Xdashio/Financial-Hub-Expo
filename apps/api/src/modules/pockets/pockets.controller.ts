import { Controller, Get, Put, Post, Delete, Param, Body, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PocketsService } from './pockets.service';

@ApiTags('Pockets')
@Controller('pockets')
@ApiBearerAuth()
export class PocketsController {
  constructor(private readonly pocketsService: PocketsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's pockets for their active plan" })
  @ApiResponse({ status: 200, description: 'List of pockets' })
  getAll(@Request() req: any) {
    return this.pocketsService.getAllForUser(req.user.id);
  }

  @Get('runway')
  @ApiOperation({ summary: "Get the current user's freelancer runway summary (days until next expected payment)" })
  @ApiResponse({ status: 200, description: 'Runway summary; { applicable: false } for salaried/mix or structured plans' })
  getRunway(@Request() req: any) {
    return this.pocketsService.getRunwaySummaryForUser(req.user.id);
  }

  @Get('allocation-summary')
  @ApiOperation({ summary: "Get the active plan's allocation integrity summary (income vs. total pocket allocation)" })
  @ApiResponse({ status: 200, description: 'Allocation summary: total allocated, unallocated, over/fully-allocated flags' })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  getAllocationSummary(@Request() req: any) {
    return this.pocketsService.getAllocationSummaryForUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single pocket by id' })
  @ApiResponse({ status: 200, description: 'The pocket' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  getById(@Param('id') id: string, @Request() req: any) {
    return this.pocketsService.getByIdForUser(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a pocket (name, category, dailyCap)' })
  @ApiResponse({ status: 200, description: 'The updated pocket' })
  @ApiResponse({ status: 400, description: 'Invalid or non-updatable fields' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  update(@Param('id') id: string, @Body() updates: unknown, @Request() req: any) {
    return this.pocketsService.updateForUser(id, req.user.id, updates);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new pocket for the active plan (max 6 pockets)' })
  @ApiResponse({ status: 201, description: 'The created pocket' })
  @ApiResponse({ status: 400, description: 'Invalid input or max pockets reached' })
  @ApiResponse({ status: 404, description: 'No active plan found' })
  create(@Body() input: unknown, @Request() req: any) {
    return this.pocketsService.createForUser(req.user.id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a pocket with balance redistribution to other pockets' })
  @ApiResponse({ status: 200, description: 'Pocket deleted with redistribution details' })
  @ApiResponse({ status: 400, description: 'Cannot delete - locked, has balance, or only pocket remaining' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  async delete(@Param('id') id: string, @Request() req: any) {
    return await this.pocketsService.deleteForUser(id, req.user.id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get transaction history for a specific pocket with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated transaction history' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of transactions per page' })
  getTransactions(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Request() req: any
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.pocketsService.getTransactionsForUser(id, req.user.id, pageNum, limitNum);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: 'Get pocket summary including available balance, spending, and allocation details' })
  @ApiResponse({ status: 200, description: 'Pocket summary with spending metrics' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
  getSummary(@Param('id') id: string, @Request() req: any) {
    return this.pocketsService.getPocketSummary(id, req.user.id);
  }

  @Get(':id/merchant-scope')
  @ApiOperation({ summary: 'Get merchant scope (allowed/blocked categories) for a specific pocket' })
  @ApiResponse({ status: 200, description: 'Merchant scope with saved classifications' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
  getMerchantScope(@Param('id') id: string, @Request() req: any) {
    return this.pocketsService.getMerchantScope(id, req.user.id);
  }

  @Post(':id/unlock')
  @ApiOperation({ summary: 'Request early unlock of a time-locked pocket with discipline cost' })
  @ApiResponse({ status: 200, description: 'Unlock successful with discipline cost applied' })
  @ApiResponse({ status: 400, description: 'Pocket not locked or invalid request' })
  @ApiResponse({ status: 403, description: 'Biometric confirmation required' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  unlock(@Param('id') id: string, @Body() body: { reason?: string; biometric_confirmed: boolean }, @Request() req: any) {
    return this.pocketsService.unlockPocket(id, req.user.id, body);
  }

  @Get(':id/lock-status')
  @ApiOperation({ summary: 'Get lock status and remaining time for a pocket' })
  @ApiResponse({ status: 200, description: 'Lock status information' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  getLockStatus(@Param('id') id: string, @Request() req: any) {
    return this.pocketsService.getLockStatus(id, req.user.id);
  }

  @Post(':id/extend-lock')
  @ApiOperation({ summary: 'Extend the lock period for a time-locked pocket' })
  @ApiResponse({ status: 200, description: 'Lock extended with discipline bonus applied' })
  @ApiResponse({ status: 400, description: 'Invalid extension request' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  extendLock(@Param('id') id: string, @Body() body: { additional_days: number; reason?: string }, @Request() req: any) {
    return this.pocketsService.extendLock(id, req.user.id, body);
  }

  @Post(':id/sub-pockets')
  @ApiOperation({ summary: 'Create a sub-pocket nested under this pocket (audit_team.md item 10)' })
  @ApiResponse({ status: 201, description: 'The created sub-pocket' })
  @ApiResponse({ status: 400, description: 'Invalid input, parent already a sub-pocket, or split exceeds the parent allocation' })
  @ApiResponse({ status: 404, description: 'Parent pocket not found' })
  createSubPocket(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    return this.pocketsService.createSubPocket(id, req.user.id, body);
  }

  @Get(':id/sub-pockets')
  @ApiOperation({ summary: 'List sub-pockets nested under this pocket, each with its ledger-derived available balance' })
  @ApiResponse({ status: 200, description: 'List of sub-pockets' })
  @ApiResponse({ status: 404, description: 'Parent pocket not found' })
  getSubPockets(@Param('id') id: string, @Request() req: any) {
    return this.pocketsService.getSubPocketsForUser(id, req.user.id);
  }

  @Delete(':id/sub-pocket')
  @ApiOperation({ summary: 'Delete a sub-pocket (top-level pockets cannot be deleted this way; balance must be zero first)' })
  @ApiResponse({ status: 200, description: 'Sub-pocket deleted' })
  @ApiResponse({ status: 400, description: 'Not a sub-pocket, or it still holds a balance' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  async deleteSubPocket(@Param('id') id: string, @Request() req: any) {
    await this.pocketsService.deleteSubPocket(id, req.user.id);
    return { deleted: true, id };
  }
}