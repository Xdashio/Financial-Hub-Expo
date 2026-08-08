import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

describe('InsightsController', () => {
  let controller: InsightsController;
  let insightsService: jest.Mocked<InsightsService>;

  beforeEach(async () => {
    insightsService = {
      getDisciplineScore: jest.fn().mockResolvedValue({ score: 100, delta: 0 }),
      getBehaviorEvents: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [{ provide: InsightsService, useValue: insightsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InsightsController>(InsightsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the discipline score for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getDisciplineScore(req);

    expect(insightsService.getDisciplineScore).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({ score: 100, delta: 0 });
  });

  it('returns behavior events for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getBehaviorEvents(req);

    expect(insightsService.getBehaviorEvents).toHaveBeenCalledWith('user-123');
    expect(result).toEqual([]);
  });
});