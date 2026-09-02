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
      createFixedExpense: jest.fn().mockResolvedValue({ id: 'fe-1' }),
      updateFixedExpense: jest.fn().mockResolvedValue({ id: 'fe-1', amount: 2000 }),
      deleteFixedExpense: jest.fn().mockResolvedValue(undefined),
      retakePlan: jest.fn().mockResolvedValue({ planId: 'plan-2', pockets: [], redistribution: { totalMoved: 0, movements: [], previousPlanType: 'daily', newPlanType: 'daily', nextRetakeAvailableOn: '2026-09-01' } }),
      getRetakeEligibility: jest.fn().mockResolvedValue({ allowed: true, nextRetakeAvailableOn: null, lastRetakenAt: null }),
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

    const result = await controller.getPlan(req, undefined);

    expect(profileService.getActivePlan).toHaveBeenCalledWith('user-123', undefined);
    expect(result).toEqual({ id: 'plan-1', type: 'daily' });
  });

  it('returns the fixed expenses for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getFixedExpenses(req, undefined);

    expect(profileService.getFixedExpenses).toHaveBeenCalledWith('user-123', undefined);
    expect(result).toEqual([]);
  });

  it('creates a fixed expense for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };
    const body = { name: 'Rent', amount: 15000, dueDay: 1, category: 'utilities' };

    const result = await controller.createFixedExpense(body, req, undefined);

    expect(profileService.createFixedExpense).toHaveBeenCalledWith('user-123', body, 'individual');
    expect(result).toEqual({ id: 'fe-1' });
  });

  it('updates a fixed expense for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };
    const body = { amount: 2000 };

    const result = await controller.updateFixedExpense('fe-1', body, req);

    expect(profileService.updateFixedExpense).toHaveBeenCalledWith('user-123', 'fe-1', body);
    expect(result).toEqual({ id: 'fe-1', amount: 2000 });
  });

  it('deletes a fixed expense for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    await controller.deleteFixedExpense('fe-1', req);

    expect(profileService.deleteFixedExpense).toHaveBeenCalledWith('user-123', 'fe-1');
  });

  it('retakes the plan for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };
    const body = { incomeAmount: 50000 };

    const result = await controller.retakePlan(body, req);

    expect(profileService.retakePlan).toHaveBeenCalledWith('user-123', body);
    expect(result.planId).toBe('plan-2');
  });

  it('returns retake eligibility for the authenticated user', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await controller.getRetakeEligibility(req);

    expect(profileService.getRetakeEligibility).toHaveBeenCalledWith('user-123');
    expect(result.allowed).toBe(true);
  });
});