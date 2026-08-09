import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MerchantService } from './merchant.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ClassifyDto } from './dto/classify.dto';

@ApiTags('Merchant')
@Controller('merchant')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post('classify')
  @ApiOperation({ summary: 'Save or update a merchant classification for a user' })
  @ApiResponse({ status: 201, description: 'Classification saved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid classification data' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this pocket' })
  classify(@Body() dto: ClassifyDto, @Request() req: any) {
    return this.merchantService.classify(dto, req.user.id);
  }

  @Get('classifications')
  @ApiOperation({ summary: 'Get all merchant classifications for the current user' })
  @ApiResponse({ status: 200, description: 'List of classifications' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Filter by recipient key' })
  getClassifications(
    @Request() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search: string
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.merchantService.getClassifications(req.user.id, pageNum, limitNum, search);
  }

  @Delete('classifications/:id')
  @ApiOperation({ summary: 'Remove a merchant classification' })
  @ApiResponse({ status: 204, description: 'Classification removed successfully' })
  @ApiResponse({ status: 404, description: 'Classification not found' })
  @ApiResponse({ status: 403, description: 'You do not have access to this classification' })
  deleteClassification(@Param('id') id: string, @Request() req: any) {
    return this.merchantService.deleteClassification(id, req.user.id);
  }
}