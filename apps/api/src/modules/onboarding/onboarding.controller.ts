import { Controller, Post, Patch, Body, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import {
  OnboardingAssignResult,
  OnboardingCommitResult,
  PlanPreviewResult,
} from '@financial-hub/shared';

@ApiTags('Onboarding')
@Controller('onboarding')
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview plan assignment from onboarding answers (no persistence)' })
  @ApiBody({ description: 'Onboarding answers', required: true })
  @ApiResponse({ status: 200, description: 'Plan assignment preview with reasons' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input' })
  assign(@Body() input: unknown): OnboardingAssignResult {
    return this.onboardingService.assign(input);
  }

  @Patch('plan-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Pre-commit preview: re-validates a user-edited category percentage split and re-runs pocket amount math (no persistence)',
  })
  @ApiBody({ description: 'Onboarding answers, optionally including categoryPercentages', required: true })
  @ApiResponse({ status: 200, description: 'Plan assignment preview plus per-category spendable breakdown' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input, or categoryPercentages do not sum to 100 / do not match this persona\'s categories' })
  planPreview(@Body() input: unknown): PlanPreviewResult {
    return this.onboardingService.previewPlan(input);
  }

  @Post('commit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Commit plan assignment — persists plan and creates pockets' })
  @ApiBody({ description: 'Onboarding answers', required: true })
  @ApiResponse({ status: 201, description: 'Plan committed with created pockets' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input' })
  async commit(@Body() input: unknown, @Request() req: any): Promise<OnboardingCommitResult> {
    const userId = req.user.id;
    return this.onboardingService.commit(input, userId);
  }
}