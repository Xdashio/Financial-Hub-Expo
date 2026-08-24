import { Controller, Get, Post, Param, Request, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BehavioralRecommendationsService } from './behavioral-recommendations.service';

@ApiTags('Behavioral Recommendations')
@Controller('behavioral-recommendations')
@ApiBearerAuth()
export class BehavioralRecommendationsController {
  constructor(
    private readonly behavioralRecommendations: BehavioralRecommendationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get allocation recommendations based on spending history' })
  @ApiResponse({ status: 200, description: 'Array of allocation recommendations with confidence levels' })
  @ApiResponse({ status: 404, description: 'Not enough history for recommendations' })
  async getRecommendations(@Request() req: any) {
    return this.behavioralRecommendations.generateRecommendations(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get user\'s recommendation decision history' })
  @ApiResponse({ status: 200, description: 'Array of past recommendations with user decisions' })
  async getHistory(@Request() req: any) {
    return this.behavioralRecommendations.getRecommendationHistory(req.user.id);
  }

  @Post(':expenseId/apply')
  @ApiOperation({ summary: 'Accept a recommendation and update the fixed expense allocation' })
  @ApiResponse({ status: 200, description: 'Recommendation applied, fixed expense updated' })
  @ApiResponse({ status: 404, description: 'Fixed expense not found' })
  async applyRecommendation(
    @Param('expenseId') expenseId: string,
    @Body() body: { newAllocation: number },
    @Request() req: any
  ) {
    await this.behavioralRecommendations.applyRecommendation(
      req.user.id,
      expenseId,
      body.newAllocation,
    );

    return { applied: true, expenseId, newAllocation: body.newAllocation };
  }
}