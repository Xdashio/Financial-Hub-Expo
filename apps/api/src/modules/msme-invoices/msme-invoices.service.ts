import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InvoiceCreateInputSchema, InvoiceUpdateInputSchema } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { MsmeInvoice, MsmeInvoiceInsert, MsmeInvoiceUpdate } from '../../database/database.types';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isOverdue(invoice: MsmeInvoice): boolean {
  if (invoice.status !== 'draft' && invoice.status !== 'sent') return false;
  const today = new Date().toISOString().slice(0, 10);
  return invoice.due_date < today;
}

function toDto(row: MsmeInvoice) {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    customerName: row.customer_name,
    customerPin: row.customer_pin,
    amount: Number(row.amount),
    dueDate: row.due_date,
    status: row.status,
    description: row.description,
    etimsStatus: row.etims_status,
    paidAt: row.paid_at,
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOverdue: isOverdue(row),
  };
}

@Injectable()
export class MsmeInvoicesService {
  private readonly logger = new Logger(MsmeInvoicesService.name);

  constructor(private readonly repository: SupabaseRepository) {}

  async createInvoice(userId: string, input: unknown) {
    const parsed = InvoiceCreateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    }
    const data = parsed.data;

    const plan = await this.repository.getActivePlanByUserId(userId, 'msme');
    if (!plan) {
      throw new BadRequestException('No active MSME plan. Complete MSME onboarding first.');
    }

    const insert: MsmeInvoiceInsert = {
      user_id: userId,
      plan_id: plan.id,
      customer_name: data.customerName.trim(),
      customer_pin: data.customerPin ?? null,
      amount: round2(data.amount),
      due_date: data.dueDate,
      status: 'draft',
      description: data.description?.trim() || null,
      etims_status: null,
    };

    const row = await this.repository.createMsmeInvoice(insert);
    if (!row) throw new BadRequestException('Failed to create invoice');
    return toDto(row);
  }

  async getInvoicesForUser(userId: string, query: { status?: string; overdueOnly?: boolean; search?: string }) {
    const plan = await this.repository.getActivePlanByUserId(userId, 'msme');
    if (!plan) return [];

    let rows = await this.repository.getMsmeInvoicesByUserId(userId, {
      status: query.status,
      overdueOnly: query.overdueOnly,
    });

    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter(r => r.customer_name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q)));
    }

    return rows.map(toDto).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  async getInvoiceById(id: string, userId: string) {
    const row = await this.repository.getMsmeInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    return toDto(row);
  }

  async updateInvoice(id: string, userId: string, input: unknown) {
    const row = await this.repository.getMsmeInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    if (row.status === 'paid' || row.status === 'void') {
      throw new BadRequestException(`Cannot edit ${row.status} invoice`);
    }

    const parsed = InvoiceUpdateInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) throw new BadRequestException('No fields to update');

    const updates: MsmeInvoiceUpdate = {};
    if (data.customerName !== undefined) updates.customer_name = data.customerName.trim();
    if (data.customerPin !== undefined) updates.customer_pin = data.customerPin ?? null;
    if (data.amount !== undefined) updates.amount = round2(data.amount);
    if (data.dueDate !== undefined) updates.due_date = data.dueDate;
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    // status via dedicated endpoints only — ignore if present
    if (data.etimsStatus !== undefined) updates.etims_status = data.etimsStatus ?? null;

    const updated = await this.repository.updateMsmeInvoice(id, updates);
    if (!updated) throw new BadRequestException('Failed to update invoice');
    return toDto(updated);
  }

  async sendInvoice(id: string, userId: string) {
    const row = await this.repository.getMsmeInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    if (row.status !== 'draft') throw new BadRequestException('Only draft invoices can be sent');
    const updated = await this.repository.updateMsmeInvoice(id, { status: 'sent' });
    return toDto(updated!);
  }

  async voidInvoice(id: string, userId: string) {
    const row = await this.repository.getMsmeInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    if (row.status === 'paid' || row.status === 'void') throw new BadRequestException(`Cannot void ${row.status} invoice`);
    const updated = await this.repository.updateMsmeInvoice(id, { status: 'void', voided_at: new Date().toISOString() });
    return toDto(updated!);
  }

  async payInvoice(id: string, userId: string) {
    const row = await this.repository.getMsmeInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    if (row.status === 'paid') throw new BadRequestException('Invoice already paid');
    if (row.status === 'void') throw new BadRequestException('Cannot pay voided invoice');
    if (row.status !== 'sent' && row.status !== 'draft') throw new BadRequestException(`Cannot pay ${row.status} invoice`);

    const amount = Number(row.amount);
    const nowIso = new Date().toISOString();

    // Mark paid
    const paid = await this.repository.updateMsmeInvoice(id, { status: 'paid', paid_at: nowIso });
    if (!paid) throw new BadRequestException('Failed to mark paid');

    // Create ledger income_event for MSME segment so allocation & runway update.
    // Manual income path: run_allocation true so pockets get credited.
    try {
      await this.repository.createIncomeEvent({
        user_id: userId,
        amount,
        source: row.customer_name.slice(0, 100),
        label: `Invoice ${row.id.slice(0, 8)} - ${row.customer_name}`.slice(0, 200),
        date: nowIso.slice(0, 10),
        run_allocation: true,
        segment: 'msme',
      });
    } catch (err) {
      this.logger.warn(`payInvoice income_event failed for ${id}: ${err instanceof Error ? err.message : String(err)}`);
      // Roll back invoice status? Keep paid but warn — ledger can be reconciled via income retry.
    }

    // Best-effort allocation: replicate IncomeService proportional logic via direct transactions.
    // Reuse existing pockets allocation: fetch MSME plan pockets and allocate proportionally.
    try {
      const plan = await this.repository.getActivePlanByUserId(userId, 'msme');
      if (plan) {
        const pockets = await this.repository.getTopLevelPocketsByPlanId(plan.id);
        if (pockets.length > 0) {
          const totalAlloc = pockets.reduce((s, p) => s + (Number(p.monthly_allocation) || 0), 0);
          if (totalAlloc > 0) {
            const txns = pockets.map(p => {
              const share = (Number(p.monthly_allocation) || 0) / totalAlloc;
              return { pocket_id: p.id, amount: round2(amount * share), type: 'allocation' as const };
            }).filter(t => t.amount > 0);
            // Reconcile rounding drift to largest
            const sum = txns.reduce((s, t) => s + t.amount, 0);
            const drift = round2(amount - sum);
            if (drift !== 0 && txns.length > 0) {
              const largest = txns.reduce((m, t) => (t.amount > m.amount ? t : m), txns[0]);
              largest.amount = round2(largest.amount + drift);
            }
            if (txns.length > 0) {
              await this.repository.createTransactions(txns.map(t => ({ pocket_id: t.pocket_id, amount: t.amount, type: t.type })));
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(`payInvoice allocation failed for ${id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return toDto(paid);
  }

  async deleteInvoice(id: string, userId: string) {
    const row = await this.repository.getMsmeInvoiceById(id);
    if (!row) throw new NotFoundException('Invoice not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    if (row.status === 'paid') throw new BadRequestException('Cannot delete paid invoice — void instead');
    await this.repository.deleteMsmeInvoice(id);
    return { deleted: true };
  }

  async getStats(userId: string) {
    const invoices = await this.repository.getMsmeInvoicesByUserId(userId);
    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = (r: MsmeInvoice) => r.due_date < today && (r.status === 'draft' || r.status === 'sent');
    const total = invoices.length;
    const draft = invoices.filter(i => i.status === 'draft').length;
    const sent = invoices.filter(i => i.status === 'sent').length;
    const paid = invoices.filter(i => i.status === 'paid').length;
    const voided = invoices.filter(i => i.status === 'void').length;
    const overdue = invoices.filter(isOverdue).length;
    const outstanding = invoices.filter(i => i.status === 'draft' || i.status === 'sent').reduce((s, i) => s + Number(i.amount), 0);
    const overdueAmount = invoices.filter(isOverdue).reduce((s, i) => s + Number(i.amount), 0);
    const paidAmount = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
    return { total, draft, sent, paid, voidCount: voided, overdue, outstanding: round2(outstanding), overdueAmount: round2(overdueAmount), paidAmount: round2(paidAmount) };
  }
}
