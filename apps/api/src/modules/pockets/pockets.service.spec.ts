import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PocketsService } from './pockets.service';
import type { SupabaseRepository } from '../../database/supabase.repository';

const POCKET = {
  id: 'pocket-1',
  plan_id: 'plan-1',
  name: 'Savings',
  kind: 'savings',
  category: null,
  is_time_locked: true,
  lock_until: '2099-01-01T00:00:00.000Z',
  monthly_allocation: 1000,
  daily_cap: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('PocketsService.updateForUser', () => {
  let repository: jest.Mocked<Pick<SupabaseRepository, 'getPocketById' | 'getPlanById' | 'updatePocket'>>;
  let service: PocketsService;

  beforeEach(() => {
    repository = {
      getPocketById: jest.fn().mockResolvedValue(POCKET),
      getPlanById: jest.fn().mockResolvedValue({ id: 'plan-1', user_id: 'user-1' }),
      updatePocket: jest.fn().mockImplementation((id, updates) => ({ ...POCKET, ...updates })),
    } as any;
    service = new PocketsService(repository as unknown as SupabaseRepository);
  });

  it('applies whitelisted fields', async () => {
    await service.updateForUser('pocket-1', 'user-1', { name: 'Rainy day', dailyCap: 250 });
    expect(repository.updatePocket).toHaveBeenCalledWith('pocket-1', { name: 'Rainy day', daily_cap: 250 });
  });

  it('rejects balance, ownership and time-lock fields', async () => {
    const payloads = [
      { monthly_allocation: 999999 },
      { plan_id: 'someone-elses-plan' },
      { is_time_locked: false },
      { lock_until: null },
    ];
    for (const payload of payloads) {
      await expect(service.updateForUser('pocket-1', 'user-1', payload)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(repository.updatePocket).not.toHaveBeenCalled();
  });

  it('rejects updates to another user\'s pocket', async () => {
    repository.getPlanById.mockResolvedValue({ id: 'plan-1', user_id: 'user-2' } as any);
    await expect(service.updateForUser('pocket-1', 'user-1', { name: 'Mine now' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.updatePocket).not.toHaveBeenCalled();
  });
});
