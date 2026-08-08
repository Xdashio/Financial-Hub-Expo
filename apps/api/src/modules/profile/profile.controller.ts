import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(SupabaseAuthGuard)
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
  @ApiOperation({ summary: "Get the current user's active plan" })
  @ApiResponse({ status: 200, description: 'The active plan' })
  getPlan(@Request() req: any) {
    return this.profileService.getActivePlan(req.user.id);
  }

  @Get('fixed-expenses')
  @ApiOperation({ summary: "Get the current user's fixed expenses" })
  @ApiResponse({ status: 200, description: 'List of fixed expenses' })
  getFixedExpenses(@Request() req: any) {
    return this.profileService.getFixedExpenses(req.user.id);
  }
}