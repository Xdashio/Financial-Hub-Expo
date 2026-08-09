import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MerchantReportController } from './merchant-report.controller';
import { MerchantReportService } from './merchant-report.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

describe('MerchantReportController', () => {
  let controller: MerchantReportController;
  let service: jest.Mocked<MerchantReportService>;

  beforeEach(async () => {
    service = {
      createReport: jest.fn().mockResolvedValue({ report: { id: 'report-1' }, message: 'Thanks' }),
      getReports: jest.fn().mockResolvedValue({ reports: [], total: 0, page: 1, limit: 20 }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantReportController],
      providers: [{ provide: MerchantReportService, useValue: service }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MerchantReportController>(MerchantReportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('submits a report for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };
    const dto = { recipient_key: 'Juma K.', report_type: 'wrong_category' as const };

    const result = await controller.submitReport(dto as any, req);

    expect(service.createReport).toHaveBeenCalledWith(dto, 'user-123');
    expect(result).toEqual({ report: { id: 'report-1' }, message: 'Thanks' });
  });

  it('lists reports for the authenticated user with pagination defaults', async () => {
    const req = { user: { id: 'user-123' } };

    await controller.getReports(req);

    expect(service.getReports).toHaveBeenCalledWith('user-123', 1, 20, undefined);
  });

  it('passes through page, limit and status query params', async () => {
    const req = { user: { id: 'user-123' } };

    await controller.getReports(req, '2', '5', 'pending');

    expect(service.getReports).toHaveBeenCalledWith('user-123', 2, 5, 'pending');
  });
});
