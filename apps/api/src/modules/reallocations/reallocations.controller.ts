import { Controller, Get, Post, Param, Body, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ReallocationsService } from './reallocations.service';

@ApiTags('Reallocations')
@Controller('reallocations')
@ApiBearerAuth()
export class ReallocationsController {
  constructor(private readonly reallocationsService: ReallocationsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's reallocations, newest first" })
  @ApiResponse({ status: 200, description: 'List of reallocations' })
  getAll(@Request() req: any) {
    return this.reallocationsService.getForUser(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Initiate a reallocation between two pockets' })
  @ApiBody({ description: 'fromPocketId, toPocketId, amount, reason' })
  @ApiResponse({ status: 201, description: 'The created reallocation (pending or cooling_off)' })
  @ApiResponse({ status: 400, description: 'Invalid input or insufficient balance' })
  @ApiResponse({ status: 403, description: 'Pocket is time-locked, or not owned by this user' })
  create(@Body() input: unknown, @Request() req: any) {
    return this.reallocationsService.create(req.user.id, input);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete a pending or cooling-off reallocation' })
  @ApiBody({ description: 'skipCoolingOff (optional)' })
  @ApiResponse({ status: 201, description: 'The completed reallocation' })
  @ApiResponse({ status: 400, description: 'Still cooling off, or already resolved' })
  @ApiResponse({ status: 403, description: 'Not the owner of this reallocation' })
  @ApiResponse({ status: 404, description: 'Reallocation not found' })
  complete(@Param('id') id: string, @Body() input: unknown, @Request() req: any) {
    return this.reallocationsService.complete(req.user.id, id, input);
  }
}