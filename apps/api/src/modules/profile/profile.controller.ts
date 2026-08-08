import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
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

  @Post('plan/retake')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retake the behavior check-in and re-provision the plan' })
  @ApiBody({ description: 'Updated onboarding answers' })
  @ApiResponse({ status: 201, description: 'New plan committed with created pockets' })
  @ApiResponse({ status: 400, description: 'Invalid onboarding input' })
  retakePlan(@Body() input: unknown, @Request() req: any) {
    return this.profileService.retakePlan(req.user.id, input);
  }

  @Get('fixed-expenses')
  @ApiOperation({ summary: "Get the current user's fixed expenses" })
  @ApiResponse({ status: 200, description: 'List of fixed expenses' })
  getFixedExpenses(@Request() req: any) {
    return this.profileService.getFixedExpenses(req.user.id);
  }

  @Post('fixed-expenses')
  @ApiOperation({ summary: 'Create a fixed expense for the current user' })
  @ApiBody({ description: 'name, amount, dueDay, category' })
  @ApiResponse({ status: 201, description: 'The created fixed expense' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  createFixedExpense(@Body() input: unknown, @Request() req: any) {
    return this.profileService.createFixedExpense(req.user.id, input);
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
}