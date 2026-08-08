import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';

describe('ProfileController', () => {
  let controller: ProfileController;
  let profileService: jest.Mocked<ProfileService>;

  beforeEach(async () => {
    profileService = {
      getProfile: jest.fn().mockResolvedValue({ id: 'user-123' }),
      getActivePlan: jest.fn().mockResolvedValue({ id: 'plan-1', type: 'daily' }),
      getFixedExpenses: jest.fn().mockResolvedValue([]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [{ provide: ProfileService, useValue: profileService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the profile for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getProfile(req);

    expect(profileService.getProfile).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({ id: 'user-123' });
  });

  it('returns the active plan for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getPlan(req);

    expect(profileService.getActivePlan).toHaveBeenCalledWith('user-123');
    expect(result).toEqual({ id: 'plan-1', type: 'daily' });
  });

  it('returns the fixed expenses for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getFixedExpenses(req);

    expect(profileService.getFixedExpenses).toHaveBeenCalledWith('user-123');
    expect(result).toEqual([]);
  });
});