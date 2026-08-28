import { Controller, Get, Post, Put, Param, Body, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';

@ApiTags('Loans')
@Controller('loans')
@ApiBearerAuth()
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's loans" })
  @ApiResponse({ status: 200, description: 'List of loans with repayment progress' })
  getAll(@Request() req: any, @Query('segment') segment?: 'individual' | 'msme') {
    return this.loansService.getLoansForUser(req.user.id, segment ?? 'individual');
  }

  @Post()
  @ApiOperation({ summary: 'Create a new loan pocket with repayment schedule' })
  @ApiResponse({ status: 201, description: 'Loan created with Repayment sub-pocket' })
  @ApiResponse({ status: 400, description: 'Invalid loan input or repayment schedule' })
  @ApiResponse({ status: 400, description: 'User must have an active plan' })
  create(
    @Body() input: unknown,
    @Request() req: any,
    @Query('segment') segment?: 'individual' | 'msme',
  ) {
    return this.loansService.createLoan(req.user.id, input, segment ?? 'individual');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed information about a specific loan' })
  @ApiResponse({ status: 200, description: 'Loan detail with sub-pockets and repayment progress' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 400, description: 'Pocket is not a loan' })
  getById(@Param('id') id: string, @Request() req: any) {
    return this.loansService.getLoanDetail(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update loan details (schedule, provider, purpose)' })
  @ApiResponse({ status: 200, description: 'Updated loan detail' })
  @ApiResponse({ status: 400, description: 'Invalid update or repayment schedule math' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  update(@Param('id') id: string, @Body() updates: unknown, @Request() req: any) {
    return this.loansService.updateLoan(id, req.user.id, updates);
  }

  @Post(':id/purpose-sub-pockets')
  @ApiOperation({ summary: 'Create a purpose sub-pocket under a loan (e.g., school fees, business stock)' })
  @ApiResponse({ status: 201, description: 'Purpose sub-pocket created' })
  @ApiResponse({ status: 400, description: 'Invalid input or allocation exceeds available loan amount' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 400, description: 'Can only create purpose sub-pockets under loan pockets' })
  createPurposeSubPocket(@Param('id') id: string, @Body() input: unknown, @Request() req: any) {
    return this.loansService.createPurposeSubPocket(id, req.user.id, input);
  }

  @Post(':id/fund-repayment')
  @ApiOperation({ summary: 'Fund the repayment sub-pocket for a loan' })
  @ApiResponse({ status: 200, description: 'Repayment recorded, schedule updated, behavioral events triggered' })
  @ApiResponse({ status: 400, description: 'Invalid repayment amount or repayment schedule' })
  @ApiResponse({ status: 404, description: 'Loan not found' })
  @ApiResponse({ status: 400, description: 'Repayment amount must match scheduled amount' })
  fundRepayment(@Param('id') id: string, @Body() body: { amount: number }, @Request() req: any) {
    return this.loansService.fundRepayment(id, req.user.id, body.amount);
  }
}
