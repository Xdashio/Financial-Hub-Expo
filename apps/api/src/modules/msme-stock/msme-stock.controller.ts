import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MsmeStockService } from './msme-stock.service';
import { parsePagination } from '../../common/pagination';

@ApiTags('MSME Stock')
@Controller('msme/stock')
@ApiBearerAuth()
export class MsmeStockController {
  constructor(private readonly stock: MsmeStockService) {}

  @Get()
  @ApiOperation({ summary: 'List stock items (search, low-stock filter) — paginated' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // M2: see msme-invoices.controller — same NaN-sanitising rationale.
    const { page: pg, limit: lim } = parsePagination(page, limit);
    return this.stock.getItemsForUser(req.user.id, {
      search,
      lowStockOnly: lowStock === 'true',
      page: page !== undefined || limit !== undefined ? pg : undefined,
      limit: page !== undefined || limit !== undefined ? lim : undefined,
    } as any);
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
  @ApiOperation({ summary: 'Record movement (in/out/adjust) — out guards qty, atomic via adjust_stock_qty, idempotent via Idempotency-Key' })
  async move(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    const key = (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string) || undefined;
    return this.stock.recordMovement(id, req.user.id, body, key);
  }
}
