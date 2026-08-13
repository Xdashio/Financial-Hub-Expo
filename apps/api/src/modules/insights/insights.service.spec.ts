import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { InsightsService } from './insights.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { RolloverService } from '../rollover/rollover.service';
import { NudgesService } from '../nudges/nudges.service';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

describe('InsightsService', () => {
  let service: InsightsService;
  let supabaseRepo: jest.Mocked<SupabaseRepository>;
  let rolloverService: { getStreak: jest.Mock };
  let nudgesService: { getNudges: jest.Mock };

  beforeEach(async () => {
    supabaseRepo = {
      getLatestDisciplineScore: jest.fn(),
      getActivePlanByUserId: jest.fn().mockResolvedValue(null),
    } as any;
    rolloverService = {
      getStreak: jest.fn().mockResolvedValue({
        currentStreak: 0,
        longestStreak: 0,
        nextMilestone: 3,
        hitMilestone: null,
        freezesRemaining: 1,
        todayCounted: false,
      }),
    };
    nudgesService = {
      getNudges: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: SupabaseRepository, useValue: supabaseRepo },
        { provide: RolloverService, useValue: rolloverService },
        { provide: NudgesService, useValue: nudgesService },
      ],
    }).compile();

    service = module.get<InsightsService>(InsightsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDisciplineScore', () => {
    it('returns null (no history) when no score has been calculated yet', async () => {
      supabaseRepo.getLatestDisciplineScore.mockResolvedValue(null);

      const result = await service.getDisciplineScore('user-123');

      // discipline-score.constants.ts: DEFAULT_SCORE is intentionally null,
      // not a fake 100 — "no history yet" is a distinct state from "scored
      // 100", and the API surfaces that via hasHistory/score:null rather
      // than pretending the user has a perfect starting score.
      expect(result.score).toBeNull();
      expect(result.delta).toBe(0);
      expect(result.hasHistory).toBe(false);
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

      expect(result).toEqual({
        score: 72,
        delta: -4,
        period: '2026-08',
        hasHistory: true,
        cardOrder: expect.any(Array),
      });
    });
  });

  describe('getStreak', () => {
    it('delegates to RolloverService', async () => {
      const result = await service.getStreak('user-123');
      expect(rolloverService.getStreak).toHaveBeenCalledWith('user-123');
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('getBehaviorEvents', () => {
    it('returns the most recent 20 behavior events for the user', async () => {
      supabaseRepo.getBehaviorEventsByUserId = jest.fn().mockResolvedValue([
        {
          id: 'evt-1',
          user_id: 'user-123',
          type: 'plan_created',
          payload: {},
          created_at: new Date().toISOString(),
        },
      ]);

      const result = await service.getBehaviorEvents('user-123');

      expect(supabaseRepo.getBehaviorEventsByUserId).toHaveBeenCalledWith('user-123', 20);
      expect(result).toHaveLength(1);
    });
  });

  describe('getNudges', () => {
    it('delegates to NudgesService', async () => {
      const runwayNudge = {
        type: 'runway_low' as const,
        pocketId: 'pocket-1',
        pocketName: 'Transport',
        dailyVelocity: 200,
        availableBalance: 500,
        projectedDaysToDeplete: 2,
        horizonDays: 5,
        horizonSource: 'calendar_month' as const,
        daysShort: 3,
      };
      nudgesService.getNudges.mockResolvedValue([runwayNudge]);

      const result = await service.getNudges('user-123');

      expect(nudgesService.getNudges).toHaveBeenCalledWith('user-123');
      expect(result).toEqual([runwayNudge]);
    });
  });
});