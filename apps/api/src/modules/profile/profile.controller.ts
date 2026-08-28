import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ProfileService } from './profile.service';

@ApiTags('Profile')
@Controller('profile')
@ApiBearerAuth()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's profile" })
  @ApiResponse({ status: 200, description: 'The user profile' })
  getProfile(@Request() req: any) {
    return this.profileService.getProfile(req.user.id);
  }

  @Get('plan')
  @ApiOperation({ summary: "Get the current user's active plan (segment-aware)" })
  @ApiResponse({ status: 200, description: 'The active plan' })
  getPlan(@Request() req: any, @Query('segment') segment?: 'individual' | 'msme') {
    return this.profileService.getActivePlan(req.user.id, segment);
  }

  @Get('plans')
  @ApiOperation({ summary: "Get all active plans (individual + msme) for the current user — used by cold-start routing" })
  @ApiResponse({ status: 200, description: 'List of active plans across segments' })
  getPlans(@Request() req: any) {
    return this.profileService.getActivePlans(req.user.id);
  }

  @Get('plan/retake-eligibility')
  @ApiOperation({ summary: 'Whether the user may retake the behavior check-in this month' })
  @ApiResponse({ status: 200, description: 'Eligibility and next available date' })
  getRetakeEligibility(@Request() req: any) {
    return this.profileService.getRetakeEligibility(req.user.id);
  }

  @Post('plan/retake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retake the behavior check-in and re-provision the plan' })
  @ApiBody({ description: 'Updated onboarding answers' })
  @ApiResponse({ status: 201, description: 'New plan committed with redistributed balances' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input' })
  @ApiResponse({ status: 429, description: 'Already retaken this calendar month' })
  retakePlan(@Body() input: unknown, @Request() req: any) {
    return this.profileService.retakePlan(req.user.id, input);
  }

  @Patch('plan/percentages')
  @ApiOperation({ summary: 'Preview pocket allocations for candidate category percentages, without saving' })
  @ApiBody({ description: '{ categoryPercentages: Record<SpendableCategory, number> } summing to 100' })
  @ApiResponse({ status: 200, description: 'Per-pocket projected allocations, read-only' })
  @ApiResponse({ status: 400, description: 'Invalid percentages or plan not found' })
  async editPlanPercentages(@Body() input: unknown, @Request() req: any) {
    return this.profileService.previewPlanPercentages(req.user.id, input);
  }

  @Post('plan/percentages/commit')
  @ApiOperation({ summary: 'Commit percentage changes to update pocket allocations' })
  @ApiBody({ description: '{ categoryPercentages: Record<SpendableCategory, number> } summing to 100' })
  @ApiResponse({ status: 200, description: 'Pocket allocations updated' })
  @ApiResponse({ status: 400, description: 'Invalid percentages or plan not found' })
  async commitPlanPercentages(@Body() input: unknown, @Request() req: any) {
    return this.profileService.commitPlanPercentages(req.user.id, input);
  }

  @Get('fixed-expenses')
  @ApiOperation({ summary: "Get the current user's fixed expenses (segment-filtered)" })
  @ApiResponse({ status: 200, description: 'List of fixed expenses' })
  getFixedExpenses(@Request() req: any, @Query('segment') segment?: 'individual' | 'msme') {
    return this.profileService.getFixedExpenses(req.user.id, segment);
  }

  @Post('fixed-expenses')
  @ApiOperation({ summary: 'Create a fixed expense for the current user' })
  @ApiBody({ description: 'name, amount, dueDay, category' })
  @ApiResponse({ status: 201, description: 'The created fixed expense' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  createFixedExpense(
    @Body() input: unknown,
    @Request() req: any,
    @Query('segment') segment?: 'individual' | 'msme',
  ) {
    return this.profileService.createFixedExpense(req.user.id, input, segment ?? 'individual');
  }

  @Put('fixed-expenses/:id')
  @ApiOperation({ summary: 'Update a fixed expense' })
  @ApiResponse({ status: 200, description: 'The updated fixed expense' })
  @ApiResponse({ status: 403, description: 'Not the owner of this fixed expense' })
  @ApiResponse({ status: 404, description: 'Fixed expense not found' })
  updateFixedExpense(@Param('id') id: string, @Body() input: unknown, @Request() req: any) {
    return this.profileService.updateFixedExpense(req.user.id, id, input);
  }

  @Delete('fixed-expenses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a fixed expense' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Not the owner of this fixed expense' })
  @ApiResponse({ status: 404, description: 'Fixed expense not found' })
  async deleteFixedExpense(@Param('id') id: string, @Request() req: any): Promise<void> {
    await this.profileService.deleteFixedExpense(req.user.id, id);
  }

  @Get('fixed-expenses/suggestions')
  @ApiOperation({ summary: 'Get suggested fixed expenses based on common categories' })
  @ApiResponse({ status: 200, description: 'List of suggested fixed expenses' })
  getFixedExpenseSuggestions(@Request() req: any) {
    return this.profileService.getFixedExpenseSuggestions(req.user.id);
  }

  @Post('fixed-expenses/bulk')
  @ApiOperation({ summary: 'Bulk create fixed expenses' })
  @ApiResponse({ status: 201, description: 'Created fixed expenses' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  bulkCreateFixedExpenses(
    @Body() input: unknown,
    @Request() req: any,
    @Query('segment') segment?: 'individual' | 'msme',
  ) {
    return this.profileService.bulkCreateFixedExpenses(req.user.id, input, segment ?? 'individual');
  }

  @Put('fixed-expenses/:id/status')
  @ApiOperation({ summary: 'Update fixed expense status' })
  @ApiResponse({ status: 200, description: 'Updated fixed expense' })
  @ApiResponse({ status: 403, description: 'Not the owner of this fixed expense' })
  @ApiResponse({ status: 404, description: 'Fixed expense not found' })
  updateFixedExpenseStatus(@Param('id') id: string, @Body() input: unknown, @Request() req: any) {
    return this.profileService.updateFixedExpenseStatus(req.user.id, id, input);
  }
}