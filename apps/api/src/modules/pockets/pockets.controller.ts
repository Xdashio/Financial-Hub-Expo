import { Controller, Get, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PocketsService } from './pockets.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

@ApiTags('Pockets')
@Controller('pockets')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class PocketsController {
  constructor(private readonly pocketsService: PocketsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's pockets for their active plan" })
  @ApiResponse({ status: 200, description: 'List of pockets' })
  getAll(@Request() req: any) {
    return this.pocketsService.getAllForUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single pocket by id' })
  @ApiResponse({ status: 200, description: 'The pocket' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  getById(@Param('id') id: string, @Request() req: any) {
    return this.pocketsService.getByIdForUser(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a pocket (name, category, dailyCap)' })
  @ApiResponse({ status: 200, description: 'The updated pocket' })
  @ApiResponse({ status: 400, description: 'Invalid or non-updatable fields' })
  @ApiResponse({ status: 404, description: 'Pocket not found' })
  update(@Param('id') id: string, @Body() updates: unknown, @Request() req: any) {
    return this.pocketsService.updateForUser(id, req.user.id, updates);
  }
}