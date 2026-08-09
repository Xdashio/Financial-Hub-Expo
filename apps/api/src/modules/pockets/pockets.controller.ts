import { Controller, Get, Put, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PocketsService } from './pockets.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

@ApiTags('Pockets')
@Controller('pockets')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class PocketsController {
  constructor(private readonly pocketsService: PocketsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's pockets for their active plan" })
  @ApiResponse({ status: 200, description: 'List of pockets' })
  getAll(@Request() req: any) {
    return this.pocketsService.getAllForUser(req.user.id);
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
}