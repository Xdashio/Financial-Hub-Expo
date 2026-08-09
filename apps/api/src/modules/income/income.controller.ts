import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CreateIncomeDto } from './dto/create-income.dto';
import { AllocatePreviewDto } from './dto/allocate-preview.dto';

@ApiTags('Income')
@Controller('income')
@UseGuards(SupabaseAuthGuard)
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
}