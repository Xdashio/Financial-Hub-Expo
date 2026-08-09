import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsightsService, DisciplineScoreResult, PaginatedBehaviorEvents, HeatmapDay } from './insights.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { BehaviorEvent } from '../../database/database.types';

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

  @Get('behavior-events')
  @ApiOperation({ summary: "Get the current user's most recent behavior events" })
  @ApiResponse({ status: 200, description: 'List of recent behavior events, newest first' })
  getBehaviorEvents(@Request() req: any): Promise<BehaviorEvent[]> {
    const userId = req.user.id;
    return this.insightsService.getBehaviorEvents(userId);
  }

  @Get('behavior-events/paginated')
  @ApiOperation({ summary: "Get the current user's behavior events, paginated" })
  @ApiResponse({ status: 200, description: 'Page of behavior events, newest first' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getBehaviorEventsPaginated(
    @Request() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string
  ): Promise<PaginatedBehaviorEvents> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.insightsService.getBehaviorEventsPaginated(req.user.id, pageNum, limitNum);
  }

  @Get('activity-heatmap')
  @ApiOperation({ summary: "Get the current user's day-by-day activity for the streak heatmap" })
  @ApiResponse({ status: 200, description: 'Zero-filled list of days with event count and point movement' })
  @ApiQuery({ name: 'range', required: false, enum: ['week', 'month', 'year'] })
  getActivityHeatmap(@Request() req: any, @Query('range') range: string): Promise<HeatmapDay[]> {
    const r = range === 'week' || range === 'year' ? range : 'month';
    return this.insightsService.getActivityHeatmap(req.user.id, r);
  }
}