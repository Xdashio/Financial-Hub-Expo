import { Controller, Post, Body, Request, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { CreateIncomeDto } from './dto/create-income.dto';
import { AllocatePreviewDto } from './dto/allocate-preview.dto';
import { AllocateSurplusDto } from './dto/allocate-surplus.dto';

@ApiTags('Income')
@Controller('income')
@ApiBearerAuth()
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Post('manual')
  @ApiOperation({ summary: 'Create a manual income entry with optional allocation' })
  @ApiResponse({ status: 201, description: 'Income event created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid income data or no active plan' })
  createManualIncome(@Body() dto: CreateIncomeDto, @Request() req: any) {
    return this.incomeService.createManualIncome(dto, req.user.id);
  }

  @Post('manual/allocate-preview')
  @ApiOperation({ summary: 'Preview allocation for manual income before confirming' })
  @ApiResponse({ status: 200, description: 'Allocation preview' })
  @ApiResponse({ status: 400, description: 'Invalid data or no active plan' })
  allocatePreview(@Body() dto: AllocatePreviewDto, @Request() req: any) {
    return this.incomeService.allocatePreview(dto, req.user.id);
  }

  @Post(':id/allocate-surplus')
  @ApiOperation({ summary: 'Allocate surplus income to a specific target' })
  @ApiResponse({ status: 200, description: 'Surplus allocated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or no pending surplus' })
  @ApiResponse({ status: 404, description: 'Income event not found' })
  allocateSurplus(@Param('id') incomeEventId: string, @Body() dto: AllocateSurplusDto, @Request() req: any) {
    return this.incomeService.allocateSurplus(incomeEventId, dto, req.user.id);
  }
}