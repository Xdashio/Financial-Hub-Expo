import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MerchantReportService } from './merchant-report.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ReportCreateDto } from './dto/report-create.dto';

@ApiTags('Merchant Report')
@Controller('merchant-report')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class MerchantReportController {
  constructor(private readonly merchantReportService: MerchantReportService) {}

  @Post('report')
  @ApiOperation({ summary: 'Submit a merchant classification report' })
  @ApiResponse({ status: 201, description: 'Report submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid report data' })
  submitReport(@Body() dto: ReportCreateDto, @Request() req: any) {
    return this.merchantReportService.createReport(dto, req.user.id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get user submitted merchant reports' })
  @ApiResponse({ status: 200, description: 'List of reports' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by status' })
  getReports(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.merchantReportService.getReports(req.user.id, pageNum, limitNum, status);
  }
}