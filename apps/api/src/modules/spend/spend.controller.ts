import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SpendService } from './spend.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { SpendCheckDto } from './dto/spend-check.dto';

@ApiTags('Spend')
@Controller('spend')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class SpendController {
  constructor(private readonly spendService: SpendService) {}

  @Post('check')
  @ApiOperation({ summary: 'Check if a spend is allowed for a specific pocket and merchant' })
  @ApiResponse({ status: 200, description: 'Spend check result' })
  @ApiResponse({ status: 400, description: 'Invalid check data' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
  checkSpend(@Body() dto: SpendCheckDto, @Request() req: any) {
    return this.spendService.checkSpend(dto, req.user.id);
  }

  @Get('blocked-reasons')
  @ApiOperation({ summary: 'Get list of blocked categories for a specific pocket' })
  @ApiResponse({ status: 200, description: 'Blocked categories list' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
  @ApiQuery({ name: 'pocket_id', required: true, type: String, description: 'Pocket ID to check' })
  getBlockedReasons(@Query('pocket_id') pocketId: string, @Request() req: any) {
    if (!pocketId) {
      throw new Error('pocket_id query parameter is required');
    }
    return this.spendService.getBlockedReasons(pocketId, req.user.id);
  }
}