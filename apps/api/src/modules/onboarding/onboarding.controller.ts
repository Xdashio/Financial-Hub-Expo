import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  OnboardingInput,
  OnboardingAssignResult,
  OnboardingCommitResult,
} from '@financial-hub/shared';

@ApiTags('Onboarding')
@Controller('onboarding')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview plan assignment from onboarding answers (no persistence)' })
  @ApiBody({ description: 'Onboarding answers', required: true })
  @ApiResponse({ status: 200, description: 'Plan assignment preview with reasons' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input' })
  assign(@Body() input: OnboardingInput): OnboardingAssignResult {
    return this.onboardingService.assign(input);
  }

  @Post('commit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Commit plan assignment — persists plan and creates pockets' })
  @ApiBody({ description: 'Onboarding answers', required: true })
  @ApiResponse({ status: 201, description: 'Plan committed with created pockets' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input' })
  async commit(@Body() input: OnboardingInput, @Request() req: any): Promise<OnboardingCommitResult> {
    const userId = req.user.id;
    return this.onboardingService.commit(input, userId);
  }
}