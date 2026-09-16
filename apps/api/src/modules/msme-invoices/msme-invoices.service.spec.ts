import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MsmeInvoicesService } from './msme-invoices.service';
import { SupabaseRepository } from '../../database/supabase.repository';

describe('MsmeInvoicesService', () => {
  let service: MsmeInvoicesService;
  let repo: jest.Mocked<SupabaseRepository>;

  const userId = 'user-123';
  const plan = { id: 'plan-msme', user_id: userId, segment: 'msme', status: 'active' } as any;
  const mockInvoice = {
    id: 'inv-1',
    user_id: userId,
    plan_id: plan.id,
    customer_name: 'Wanjiku',
    customer_pin: null,
    amount: 50000,
    due_date: '2026-09-20',
    status: 'draft',
    description: null,
    etims_status: null,
    paid_at: null,
    voided_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    repo = {
      getActivePlanByUserId: jest.fn().mockResolvedValue(plan),
      createMsmeInvoice: jest.fn().mockResolvedValue(mockInvoice),
      getMsmeInvoiceById: jest.fn().mockResolvedValue(mockInvoice),
      getMsmeInvoicesByUserId: jest.fn().mockResolvedValue([mockInvoice]),
      updateMsmeInvoice: jest.fn().mockImplementation(async (_id, updates) => ({ ...mockInvoice, ...updates })),
      claimMsmeInvoicePayment: jest.fn().mockResolvedValue({ ...mockInvoice, status: 'paid', paid_at: new Date().toISOString() }),
      deleteMsmeInvoice: jest.fn().mockResolvedValue(undefined),
      createIncomeEvent: jest.fn().mockResolvedValue({ id: 'inc-1' }),
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([]),
      createTransactions: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [MsmeInvoicesService, { provide: SupabaseRepository, useValue: repo }],
    }).compile();

    service = module.get<MsmeInvoicesService>(MsmeInvoicesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createInvoice', () => {
    it('creates draft invoice with valid input', async () => {
      const result = await service.createInvoice(userId, { customerName: 'Wanjiku', amount: 50000, dueDate: '2026-09-20' });
      expect(result.customerName).toBe('Wanjiku');
      expect(repo.createMsmeInvoice).toHaveBeenCalledWith(expect.objectContaining({ customer_name: 'Wanjiku', amount: 50000 }));
    });

    it('validates KRA PIN', async () => {
      await expect(service.createInvoice(userId, { customerName: 'X', customerPin: 'bad', amount: 1000, dueDate: '2026-09-20' } as any)).rejects.toThrow();
    });

    it('requires MSME plan', async () => {
      repo.getActivePlanByUserId.mockResolvedValueOnce(null);
      await expect(service.createInvoice(userId, { customerName: 'X', amount: 1000, dueDate: '2026-09-20' })).rejects.toThrow('No active MSME plan');
    });

    it('rejects non-positive amount', async () => {
      await expect(service.createInvoice(userId, { customerName: 'X', amount: 0, dueDate: '2026-09-20' })).rejects.toThrow();
    });
  });

  describe('getInvoicesForUser', () => {
    it('returns invoices for user', async () => {
      const list = await service.getInvoicesForUser(userId, {});
      expect(list).toHaveLength(1);
    });
  });

  describe('send/void/pay', () => {
    it('send draft -> sent', async () => {
      repo.getMsmeInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'draft' } as any);
      repo.updateMsmeInvoice.mockResolvedValue({ ...mockInvoice, status: 'sent' } as any);
      const result = await service.sendInvoice(mockInvoice.id, userId);
      expect(result.status).toBe('sent');
    });

    it('rejects send if not draft', async () => {
      repo.getMsmeInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'sent' } as any);
      await expect(service.sendInvoice(mockInvoice.id, userId)).rejects.toThrow('Only draft');
    });

    it('void draft', async () => {
      repo.getMsmeInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'draft' } as any);
      repo.updateMsmeInvoice.mockResolvedValue({ ...mockInvoice, status: 'void', voided_at: new Date().toISOString() } as any);
      const result = await service.voidInvoice(mockInvoice.id, userId);
      expect(result.status).toBe('void');
    });

    it('pay sent -> delegates the atomic income-and-payment operation', async () => {
      repo.getMsmeInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'sent' } as any);
      repo.updateMsmeInvoice.mockResolvedValue({ ...mockInvoice, status: 'paid', paid_at: new Date().toISOString() } as any);
      const result = await service.payInvoice(mockInvoice.id, userId);
      expect(result.status).toBe('paid');
      expect(repo.claimMsmeInvoicePayment).toHaveBeenCalledWith(
        mockInvoice.id,
        expect.objectContaining({ userId, source: mockInvoice.customer_name }),
      );
    });

    it('rejects pay if already paid', async () => {
      repo.getMsmeInvoiceById.mockResolvedValue({ ...mockInvoice, status: 'paid', paid_at: new Date().toISOString() } as any);
      await expect(service.payInvoice(mockInvoice.id, userId)).rejects.toThrow('already paid');
    });

    it('forbids access for other user', async () => {
      repo.getMsmeInvoiceById.mockResolvedValue({ ...mockInvoice, user_id: 'other' } as any);
      await expect(service.getInvoiceById(mockInvoice.id, userId)).rejects.toThrow('Access denied');
    });
  });

  describe('overdue derived', () => {
    it('marks overdue when past due', async () => {
      const past = { ...mockInvoice, due_date: '2020-01-01', status: 'sent' } as any;
      repo.getMsmeInvoiceById.mockResolvedValue(past);
      const result = await service.getInvoiceById(past.id, userId);
      expect(result.isOverdue).toBe(true);
    });
  });
});
