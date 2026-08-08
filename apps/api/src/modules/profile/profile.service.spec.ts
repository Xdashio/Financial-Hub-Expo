import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { SupabaseRepository } from '../../database/supabase.repository';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

describe('ProfileService', () => {
  let service: ProfileService;
  let supabaseRepo: jest.Mocked<SupabaseRepository>;

  beforeEach(async () => {
    supabaseRepo = {
      getUserById: jest.fn(),
      getActivePlanByUserId: jest.fn(),
      getFixedExpensesByUserId: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: SupabaseRepository, useValue: supabaseRepo },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getProfile fetches the user by id', async () => {
    supabaseRepo.getUserById.mockResolvedValue({ id: 'user-123' } as any);

    const result = await service.getProfile('user-123');

    expect(supabaseRepo.getUserById).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({ id: 'user-123' });
  });

  it('getActivePlan fetches the active plan for the user', async () => {
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1', type: 'daily' } as any);

    const result = await service.getActivePlan('user-123');

    expect(supabaseRepo.getActivePlanByUserId).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({ id: 'plan-1', type: 'daily' });
  });

  it('getFixedExpenses fetches fixed expenses for the user', async () => {
    supabaseRepo.getFixedExpensesByUserId.mockResolvedValue([]);

    const result = await service.getFixedExpenses('user-123');

    expect(supabaseRepo.getFixedExpensesByUserId).toHaveBeenCalledWith('user-123');
    expect(result).toEqual([]);
  });
});