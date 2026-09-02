import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsightsService, DisciplineScoreResult, PaginatedBehaviorEvents, HeatmapDay, MsmeProjectInsights, MsmeOperationalInsights } from './insights.service';
import { BehaviorEvent } from '../../database/database.types';
import type { NudgeItem } from '../nudges/nudge.calculator';

@ApiTags('Insights')
@Controller('insights')
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

  @Get('discipline-score/history')
  @ApiOperation({ summary: "Get the user's discipline score history for a date range" })
  @ApiResponse({ status: 200, description: 'Historical discipline scores' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  getDisciplineScoreHistory(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.insightsService.getDisciplineScoreHistory(req.user.id, startDate, endDate);
  }

  @Get('streak')
  @ApiOperation({ summary: "Get the current user's under-cap rollover streak (with grace/freeze)" })
  @ApiResponse({ status: 200, description: 'Current/longest streak and freeze inventory' })
  getStreak(@Request() req: any) {
    return this.insightsService.getStreak(req.user.id);
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

  @Get('activity-heatmap/day')
  @ApiOperation({ summary: 'Get the actual behavior events for one calendar day of the heatmap' })
  @ApiResponse({ status: 200, description: 'Events for the given UTC calendar day, oldest first' })
  @ApiQuery({ name: 'date', required: true, type: String, description: 'YYYY-MM-DD' })
  getActivityHeatmapDay(@Request() req: any, @Query('date') date: string): Promise<BehaviorEvent[]> {
    return this.insightsService.getEventsForDay(req.user.id, date);
  }

  @Get('nudges')
  @ApiOperation({ summary: "Get the current user's proactive nudges" })
  @ApiResponse({ status: 200, description: 'Nudges computed server-side: runway_low, sweep_surplus, and streak_at_risk items' })
  getNudges(@Request() req: any): Promise<NudgeItem[]> {
    return this.insightsService.getNudges(req.user.id);
  }

  @Get('msme')
  @ApiOperation({ summary: "Get MSME-specific business insights (Phase 6)" })
  @ApiResponse({ status: 200, description: 'MSME project metrics: funding velocity, tier discipline, contract values' })
  @ApiResponse({ status: 200, description: 'Returns null if user does not have MSME segment active' })
  getMsmeInsights(@Request() req: any): Promise<MsmeProjectInsights | null> {
    return this.insightsService.getMsmeInsights(req.user.id);
  }

  @Get('msme/operational')
  @ApiOperation({ summary: 'MSME operational insights — invoices + projects aggregates (020)' })
  @ApiResponse({ status: 200, description: 'Collection rate, outstanding/overdue, funding percent, alerts' })
  getMsmeOperational(@Request() req: any): Promise<MsmeOperationalInsights | null> {
    return this.insightsService.getMsmeOperationalInsights(req.user.id);
  }
}