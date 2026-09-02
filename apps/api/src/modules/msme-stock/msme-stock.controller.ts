import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MsmeStockService } from './msme-stock.service';

@ApiTags('MSME Stock')
@Controller('msme/stock')
@ApiBearerAuth()
export class MsmeStockController {
  constructor(private readonly stock: MsmeStockService) {}

  @Get()
  @ApiOperation({ summary: 'List stock items (search, low-stock filter)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  async list(@Request() req: any, @Query('search') search?: string, @Query('lowStock') lowStock?: string) {
    return this.stock.getItemsForUser(req.user.id, { search, lowStockOnly: lowStock === 'true' });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Stock stats (total, low-stock, value)' })
  async stats(@Request() req: any) {
    return this.stock.getStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock item by id' })
  async getOne(@Param('id') id: string, @Request() req: any) {
    return this.stock.getItemById(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create stock item (eTIMS SKU optional)' })
  async create(@Body() body: unknown, @Request() req: any) {
    return this.stock.createItem(req.user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update stock item (name, sku, costs, threshold, location)' })
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    return this.stock.updateItem(id, req.user.id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete stock item (only if qty 0)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.stock.deleteItem(id, req.user.id);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Movements for item (in/out/adjust)' })
  async movements(@Param('id') id: string, @Request() req: any) {
    return this.stock.getMovements(id, req.user.id);
  }

  @Post(':id/movements')
  @ApiOperation({ summary: 'Record movement (in/out/adjust) — out guards qty' })
  async move(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    return this.stock.recordMovement(id, req.user.id, body);
  }
}
