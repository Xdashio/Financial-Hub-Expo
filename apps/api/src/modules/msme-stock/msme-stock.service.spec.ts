import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MsmeStockService } from './msme-stock.service';
import { SupabaseRepository } from '../../database/supabase.repository';

describe('MsmeStockService', () => {
  let service: MsmeStockService;
  let repo: jest.Mocked<SupabaseRepository>;
  const userId = 'user-123';
  const plan = { id: 'plan-msme', user_id: userId, segment: 'msme' } as any;
  const mockItem = {
    id: 'item-1', user_id: userId, plan_id: plan.id, name: 'Cement', sku: 'CEM001',
    qty_on_hand: 10, unit_cost: 500, unit_price: 650, low_stock_threshold: 5, location: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    repo = {
      getActivePlanByUserId: jest.fn().mockResolvedValue(plan),
      createMsmeStockItem: jest.fn().mockResolvedValue(mockItem),
      getMsmeStockItemById: jest.fn().mockResolvedValue(mockItem),
      getMsmeStockItemsByUserId: jest.fn().mockResolvedValue([mockItem]),
      updateMsmeStockItem: jest.fn().mockImplementation(async (_id, u) => ({ ...mockItem, ...u })),
      deleteMsmeStockItem: jest.fn().mockResolvedValue(undefined),
      createMsmeStockMovement: jest.fn().mockResolvedValue({ id: 'mov-1', item_id: 'item-1', user_id: userId, type: 'in', qty: 5, unit_cost: 500, total_cost: 2500, created_at: new Date().toISOString() }),
      getMsmeStockMovementsByItemId: jest.fn().mockResolvedValue([]),
      adjustStockQty: jest.fn().mockImplementation(async (_id: string, delta: number) => ({ ...mockItem, qty_on_hand: Number(mockItem.qty_on_hand) + delta })),
      getIdempotencyRecord: jest.fn().mockResolvedValue(null),
      saveIdempotencyRecord: jest.fn().mockResolvedValue(null),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MsmeStockService, { provide: SupabaseRepository, useValue: repo }],
    }).compile();
    service = module.get<MsmeStockService>(MsmeStockService);
  });

  afterEach(() => jest.clearAllMocks());

  it('creates item', async () => {
    const result = await service.createItem(userId, { name: 'Cement', unitCost: 500, unitPrice: 650 });
    expect(result.name).toBe('Cement');
    expect(repo.createMsmeStockItem).toHaveBeenCalled();
  });

  it('rejects duplicate SKU', async () => {
    await expect(service.createItem(userId, { name: 'Other', sku: 'CEM001', unitCost: 10, unitPrice: 15 })).rejects.toThrow('already exists');
  });

  it('guards out qty', async () => {
    await expect(service.recordMovement('item-1', userId, { type: 'out', qty: 20 })).rejects.toThrow('Insufficient stock');
  });

  it('allows in', async () => {
    const res = await service.recordMovement('item-1', userId, { type: 'in', qty: 5 });
    expect(res.item.qtyOnHand).toBe(15);
  });

  it('allows out within qty', async () => {
    const res = await service.recordMovement('item-1', userId, { type: 'out', qty: 5 });
    expect(res.item.qtyOnHand).toBe(5);
  });

  it('allows downward adjustment for shrinkage/damage', async () => {
    const res = await service.recordMovement('item-1', userId, { type: 'adjust', qty: -3, note: 'Spoilage' });
    expect(res.item.qtyOnHand).toBe(7);
    expect(repo.createMsmeStockMovement).toHaveBeenCalledWith(expect.objectContaining({
      type: 'adjust',
      qty: 3,
      note: 'Spoilage',
    }));
  });

  it('guards downward adjustment beyond available qty', async () => {
    await expect(service.recordMovement('item-1', userId, { type: 'adjust', qty: -15 })).rejects.toThrow('Insufficient stock');
  });

  it('allows upward adjustment', async () => {
    const res = await service.recordMovement('item-1', userId, { type: 'adjust', qty: 4, note: 'Audit surplus' });
    expect(res.item.qtyOnHand).toBe(14);
  });

  it('prevents delete with stock', async () => {
    await expect(service.deleteItem('item-1', userId)).rejects.toThrow('Cannot delete');
  });

  it('stats', async () => {
    const stats = await service.getStats(userId);
    expect(stats.totalItems).toBe(1);
  });
});
