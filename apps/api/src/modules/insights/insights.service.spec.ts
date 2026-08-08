import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { InsightsService } from './insights.service';
import { SupabaseRepository } from '../../database/supabase.repository';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

describe('InsightsService', () => {
  let service: InsightsService;
  let supabaseRepo: jest.Mocked<SupabaseRepository>;

  beforeEach(async () => {
    supabaseRepo = {
      getLatestDisciplineScore: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: SupabaseRepository, useValue: supabaseRepo },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDisciplineScore', () => {
    it('returns the default score (100, no delta) when no score has been calculated yet', async () => {
      supabaseRepo.getLatestDisciplineScore.mockResolvedValue(null);

      const result = await service.getDisciplineScore('user-123');

      expect(result).toEqual({ score: 100, delta: 0 });
      expect(supabaseRepo.getLatestDisciplineScore).toHaveBeenCalledWith('user-123');
    });

    it('returns the latest stored score and delta when one exists', async () => {
      supabaseRepo.getLatestDisciplineScore.mockResolvedValue({
        user_id: 'user-123',
        score: 72,
        delta: -4,
        period: '2026-08',
        calculated_at: new Date().toISOString(),
      } as any);

      const result = await service.getDisciplineScore('user-123');

      expect(result).toEqual({ score: 72, delta: -4 });
    });
  });
});