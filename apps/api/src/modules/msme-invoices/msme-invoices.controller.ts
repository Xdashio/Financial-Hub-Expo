import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MsmeInvoicesService } from './msme-invoices.service';
import { parsePagination } from '../../common/pagination';

@ApiTags('MSME Invoices')
@Controller('msme/invoices')
@ApiBearerAuth()
export class MsmeInvoicesController {
  constructor(private readonly invoices: MsmeInvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List MSME invoices (filter by status, overdue, search) — paginated' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'sent', 'paid', 'void'] })
  @ApiQuery({ name: 'overdue', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Array (no pagination) or {data,total,page,totalPages} when page/limit set' })
  async list(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('overdue') overdue?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const overdueOnly = overdue === 'true';
    // M2: sanitise here so a garbage ?page=/&limit= never reaches the service
    // as NaN (the old `Number(page)` echoed NaN back in the response page).
    const { page: pg, limit: lim } = parsePagination(page, limit);
    return this.invoices.getInvoicesForUser(req.user.id, {
      status,
      overdueOnly,
      search,
      page: page !== undefined || limit !== undefined ? pg : undefined,
      limit: page !== undefined || limit !== undefined ? lim : undefined,
    } as any);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Invoice stats (counts + outstanding/overdue totals)' })
  async stats(@Request() req: any) {
    return this.invoices.getStats(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by id' })
  async getOne(@Param('id') id: string, @Request() req: any) {
    return this.invoices.getInvoiceById(id, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create draft invoice (eTIMS-ready, KRA PIN validated)' })
  async create(@Body() body: unknown, @Request() req: any) {
    return this.invoices.createInvoice(req.user.id, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update draft/sent invoice' })
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: any) {
    return this.invoices.updateInvoice(id, req.user.id, body);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send draft → sent' })
  async send(@Param('id') id: string, @Request() req: any) {
    return this.invoices.sendInvoice(id, req.user.id);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Mark sent invoice as paid → creates MSME income + allocation (idempotent via Idempotency-Key)' })
  @ApiResponse({ status: 200, description: 'Paid invoice dto; replay returns same dto' })
  async pay(@Param('id') id: string, @Request() req: any) {
    const key = (req.headers['idempotency-key'] as string) || (req.headers['x-idempotency-key'] as string) || undefined;
    return this.invoices.payInvoice(id, req.user.id, key);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Void draft/sent invoice' })
  async void(@Param('id') id: string, @Request() req: any) {
    return this.invoices.voidInvoice(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete draft/sent invoice (paid must be voided, not deleted)' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.invoices.deleteInvoice(id, req.user.id);
  }
}
