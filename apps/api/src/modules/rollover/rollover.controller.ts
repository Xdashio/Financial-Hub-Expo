import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { RolloverService } from './rollover.service';

@ApiTags('Rollover')
@Controller('income/rollover')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class RolloverController {
  constructor(private readonly rolloverService: RolloverService) {}

  @Post('run')
  @ApiOperation({
    summary: 'Run daily under-cap rollover into Savings (idempotent catch-up)',
  })
  @ApiResponse({ status: 200, description: 'Rollover catch-up result with streak summary' })
  run(@Request() req: any) {
    return this.rolloverService.runForUser(req.user.id);
  }

  @Get('status')
  @ApiOperation({ summary: 'Current streak + month-to-date rollover amount' })
  @ApiResponse({ status: 200, description: 'Streak and MTD rollover' })
  async status(@Request() req: any) {
    const [streak, monthToDateAmount] = await Promise.all([
      this.rolloverService.getStreak(req.user.id),
      this.rolloverService.getMonthToDateRollover(req.user.id),
    ]);
    return { streak, monthToDateAmount };
  }
}
