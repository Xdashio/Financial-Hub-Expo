import { DisciplineScoreService } from './discipline-score.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

function makeRepository(overrides: Partial<jest.Mocked<Pick<SupabaseRepository, 'getLatestDisciplineScore' | 'upsertDisciplineScore'>>> = {}) {
  return {
    getLatestDisciplineScore: jest.fn().mockResolvedValue(null),
    upsertDisciplineScore: jest.fn().mockImplementation((row) => row),
    ...overrides,
  } as unknown as jest.Mocked<SupabaseRepository>;
}

describe('DisciplineScoreService', () => {
  describe('getCurrentScore', () => {
    it('defaults to 100 when the user has no score history', async () => {
      const repo = makeRepository();
      const service = new DisciplineScoreService(repo);

      await expect(service.getCurrentScore('user-1')).resolves.toBe(100);
    });

    it('returns the latest persisted score when history exists', async () => {
      const repo = makeRepository({
        getLatestDisciplineScore: jest.fn().mockResolvedValue({ score: 72, delta: -5 } as any),
      });
      const service = new DisciplineScoreService(repo);

      await expect(service.getCurrentScore('user-1')).resolves.toBe(72);
    });
  });

  describe('applyDelta', () => {
    it('applies a negative delta and persists the new score for the current period', async () => {
      const repo = makeRepository({
        getLatestDisciplineScore: jest.fn().mockResolvedValue({ score: 80, delta: 0 } as any),
      });
      const service = new DisciplineScoreService(repo);

      const result = await service.applyDelta('user-1', -5);

      expect(result).toEqual({ previousScore: 80, newScore: 75 });
      expect(repo.upsertDisciplineScore).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', score: 75, delta: -5 })
      );
    });

    it('applies a positive delta (bonus)', async () => {
      const repo = makeRepository({
        getLatestDisciplineScore: jest.fn().mockResolvedValue({ score: 60, delta: 0 } as any),
      });
      const service = new DisciplineScoreService(repo);

      const result = await service.applyDelta('user-1', 10);

      expect(result).toEqual({ previousScore: 60, newScore: 70 });
    });

    it('clamps the score to the [0, 100] range', async () => {
      const repoLow = makeRepository({
        getLatestDisciplineScore: jest.fn().mockResolvedValue({ score: 3, delta: 0 } as any),
      });
      const serviceLow = new DisciplineScoreService(repoLow);
      await expect(serviceLow.applyDelta('user-1', -10)).resolves.toEqual({ previousScore: 3, newScore: 0 });

      const repoHigh = makeRepository({
        getLatestDisciplineScore: jest.fn().mockResolvedValue({ score: 98, delta: 0 } as any),
      });
      const serviceHigh = new DisciplineScoreService(repoHigh);
      await expect(serviceHigh.applyDelta('user-1', 10)).resolves.toEqual({ previousScore: 98, newScore: 100 });
    });

    it('uses the current month as the period key', async () => {
      const repo = makeRepository();
      const service = new DisciplineScoreService(repo);

      await service.applyDelta('user-1', -1);

      const expectedPeriod = new Date().toISOString().slice(0, 7);
      expect(repo.upsertDisciplineScore).toHaveBeenCalledWith(
        expect.objectContaining({ period: expectedPeriod })
      );
    });
  });
});
