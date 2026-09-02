import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { StockItemCreateInputSchema, StockItemUpdateInputSchema, StockMovementCreateInputSchema } from '@financial-hub/shared';
import { SupabaseRepository } from '../../database/supabase.repository';
import { MsmeStockItem, MsmeStockItemInsert } from '../../database/database.types';

function round2(n: number): number { return Math.round(n * 100) / 100; }

function toDto(row: MsmeStockItem) {
  const qty = Number(row.qty_on_hand);
  const threshold = Number(row.low_stock_threshold);
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    name: row.name,
    sku: row.sku,
    qtyOnHand: qty,
    unitCost: Number(row.unit_cost),
    unitPrice: Number(row.unit_price),
    lowStockThreshold: threshold,
    location: row.location,
    isLowStock: qty <= threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable()
export class MsmeStockService {
  private readonly logger = new Logger(MsmeStockService.name);
  constructor(private readonly repo: SupabaseRepository) {}

  async createItem(userId: string, input: unknown) {
    const parsed = StockItemCreateInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    const d = parsed.data;
    const plan = await this.repo.getActivePlanByUserId(userId, 'msme');
    if (!plan) throw new BadRequestException('No active MSME plan. Complete MSME onboarding first.');

    if (d.sku) {
      const existing = await this.repo.getMsmeStockItemsByUserId(userId);
      if (existing.some(i => i.sku && i.sku.toLowerCase() === d.sku!.toLowerCase())) {
        throw new BadRequestException(`SKU ${d.sku} already exists`);
      }
    }

    const insert: MsmeStockItemInsert = {
      user_id: userId,
      plan_id: plan.id,
      name: d.name.trim(),
      sku: d.sku?.trim() || null,
      qty_on_hand: d.qtyOnHand ?? 0,
      unit_cost: d.unitCost,
      unit_price: d.unitPrice,
      low_stock_threshold: d.lowStockThreshold ?? 5,
      location: d.location?.trim() || null,
    };
    const row = await this.repo.createMsmeStockItem(insert);
    if (!row) throw new BadRequestException('Failed to create stock item');

    if ((d.qtyOnHand ?? 0) > 0) {
      await this.repo.createMsmeStockMovement({
        item_id: row.id,
        user_id: userId,
        type: 'in',
        qty: d.qtyOnHand!,
        unit_cost: d.unitCost,
        total_cost: round2((d.qtyOnHand! * d.unitCost)),
        note: 'Initial stock',
      });
    }

    return toDto(row);
  }

  async getItemsForUser(userId: string, query: { search?: string; lowStockOnly?: boolean }) {
    const plan = await this.repo.getActivePlanByUserId(userId, 'msme');
    if (!plan) return [];
    let rows = await this.repo.getMsmeStockItemsByUserId(userId);
    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.sku && r.sku.toLowerCase().includes(q)) || (r.location && r.location.toLowerCase().includes(q)));
    }
    if (query.lowStockOnly) {
      rows = rows.filter(r => Number(r.qty_on_hand) <= Number(r.low_stock_threshold));
    }
    return rows.map(toDto).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getItemById(id: string, userId: string) {
    const row = await this.repo.getMsmeStockItemById(id);
    if (!row) throw new NotFoundException('Stock item not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    return toDto(row);
  }

  async updateItem(id: string, userId: string, input: unknown) {
    const row = await this.repo.getMsmeStockItemById(id);
    if (!row) throw new NotFoundException('Stock item not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    const parsed = StockItemUpdateInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    const d = parsed.data;
    if (Object.keys(d).length === 0) throw new BadRequestException('No fields to update');

    if (d.sku) {
      const existing = await this.repo.getMsmeStockItemsByUserId(userId);
      if (existing.some(i => i.id !== id && i.sku && i.sku.toLowerCase() === d.sku!.toLowerCase())) {
        throw new BadRequestException(`SKU ${d.sku} already exists`);
      }
    }

    const updates: any = {};
    if (d.name !== undefined) updates.name = d.name.trim();
    if (d.sku !== undefined) updates.sku = d.sku?.trim() || null;
    if (d.unitCost !== undefined) updates.unit_cost = d.unitCost;
    if (d.unitPrice !== undefined) updates.unit_price = d.unitPrice;
    if (d.lowStockThreshold !== undefined) updates.low_stock_threshold = d.lowStockThreshold;
    if (d.location !== undefined) updates.location = d.location?.trim() || null;

    const updated = await this.repo.updateMsmeStockItem(id, updates);
    if (!updated) throw new BadRequestException('Failed to update');
    return toDto(updated);
  }

  async deleteItem(id: string, userId: string) {
    const row = await this.repo.getMsmeStockItemById(id);
    if (!row) throw new NotFoundException('Stock item not found');
    if (row.user_id !== userId) throw new ForbiddenException('Access denied');
    // Prevent delete if qty remains (avoid silent loss)
    if (Number(row.qty_on_hand) > 0) throw new BadRequestException('Cannot delete item with stock on hand — adjust to 0 first');
    await this.repo.deleteMsmeStockItem(id);
    return { deleted: true };
  }

  async recordMovement(itemId: string, userId: string, input: unknown) {
    const parsed = StockMovementCreateInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map(i => i.message).join('; '));
    const d = parsed.data;
    const item = await this.repo.getMsmeStockItemById(itemId);
    if (!item) throw new NotFoundException('Stock item not found');
    if (item.user_id !== userId) throw new ForbiddenException('Access denied');

    const currentQty = Number(item.qty_on_hand);
    let newQty: number;
    if (d.type === 'in') {
      newQty = currentQty + d.qty;
    } else if (d.type === 'out') {
      if (d.qty > currentQty) throw new BadRequestException(`Insufficient stock: have ${currentQty}, tried to move ${d.qty}`);
      newQty = currentQty - d.qty;
    } else { // adjust — treat as delta add (positive) for MVP; use negative qty not allowed, so adjust adds
      // For adjust we interpret qty as new absolute if provided via note? Keep simple: adds qty
      newQty = currentQty + d.qty;
    }

    const unitCost = d.unitCost ?? Number(item.unit_cost);
    const totalCost = round2(d.qty * unitCost);

    const movement = await this.repo.createMsmeStockMovement({
      item_id: itemId,
      user_id: userId,
      type: d.type,
      qty: d.qty,
      unit_cost: unitCost,
      total_cost: totalCost,
      note: d.note?.trim() || null,
      pocket_id: d.pocketId ?? null,
    });
    if (!movement) throw new BadRequestException('Failed to record movement');

    const updated = await this.repo.updateMsmeStockItem(itemId, { qty_on_hand: newQty });
    return { movement, item: updated ? toDto(updated) : toDto({ ...item, qty_on_hand: newQty } as any) };
  }

  async getMovements(itemId: string, userId: string) {
    const item = await this.repo.getMsmeStockItemById(itemId);
    if (!item) throw new NotFoundException('Stock item not found');
    if (item.user_id !== userId) throw new ForbiddenException('Access denied');
    const rows = await this.repo.getMsmeStockMovementsByItemId(itemId);
    return rows.map(r => ({
      id: r.id,
      itemId: r.item_id,
      userId: r.user_id,
      type: r.type,
      qty: Number(r.qty),
      unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
      totalCost: Number(r.total_cost),
      note: r.note,
      pocketId: r.pocket_id,
      createdAt: r.created_at,
    }));
  }

  async getStats(userId: string) {
    const items = await this.repo.getMsmeStockItemsByUserId(userId);
    const totalItems = items.length;
    const lowStock = items.filter(i => Number(i.qty_on_hand) <= Number(i.low_stock_threshold)).length;
    const totalValueCost = items.reduce((s, i) => s + Number(i.qty_on_hand) * Number(i.unit_cost), 0);
    const totalValuePrice = items.reduce((s, i) => s + Number(i.qty_on_hand) * Number(i.unit_price), 0);
    const outOfStock = items.filter(i => Number(i.qty_on_hand) === 0).length;
    return {
      totalItems,
      lowStock,
      outOfStock,
      totalValueCost: round2(totalValueCost),
      totalValuePrice: round2(totalValuePrice),
      potentialMargin: round2(totalValuePrice - totalValueCost),
    };
  }
}
