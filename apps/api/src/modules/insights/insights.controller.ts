import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InsightsService, DisciplineScoreResult } from './insights.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

@ApiTags('Insights')
@Controller('insights')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('discipline-score')
  @ApiOperation({ summary: "Get the current user's discipline score and recent delta" })
  @ApiResponse({ status: 200, description: 'Discipline score with recent delta' })
  getDisciplineScore(@Request() req: any): Promise<DisciplineScoreResult> {
    const userId = req.user.id;
    return this.insightsService.getDisciplineScore(userId);
  }
}