import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { SupabaseRepository } from '../../database/supabase.repository';
import { OnboardingService } from '../onboarding/onboarding.service';

jest.mock('../../database/supabase.repository');
jest.mock('../../config/supabase.config');

describe('ProfileService', () => {
  let service: ProfileService;
  let supabaseRepo: jest.Mocked<SupabaseRepository>;
  let onboardingService: jest.Mocked<OnboardingService>;

  beforeEach(async () => {
    supabaseRepo = {
      getUserById: jest.fn(),
      getActivePlanByUserId: jest.fn(),
      getFixedExpensesByUserId: jest.fn(),
      getFixedExpenseById: jest.fn(),
      createFixedExpense: jest.fn(),
      updateFixedExpense: jest.fn(),
      deleteFixedExpense: jest.fn(),
    } as any;

    onboardingService = {
      commit: jest.fn(),
      retake: jest.fn(),
      getRetakeEligibility: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: SupabaseRepository, useValue: supabaseRepo },
        { provide: OnboardingService, useValue: onboardingService },
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

  it('createFixedExpense validates and inserts with the caller as owner', async () => {
    supabaseRepo.createFixedExpense.mockResolvedValue({ id: 'fe-1', user_id: 'user-123' } as any);

    const result = await service.createFixedExpense('user-123', {
      name: 'Rent',
      amount: 15000,
      dueDay: 1,
      category: 'utilities',
    });

    expect(supabaseRepo.createFixedExpense).toHaveBeenCalledWith({
      user_id: 'user-123',
      name: 'Rent',
      amount: 15000,
      due_day: 1,
      category: 'utilities',
    });
    expect(result).toEqual({ id: 'fe-1', user_id: 'user-123' });
  });

  it('createFixedExpense rejects invalid input', async () => {
    await expect(
      service.createFixedExpense('user-123', { name: '', amount: -5, dueDay: 40, category: 'utilities' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(supabaseRepo.createFixedExpense).not.toHaveBeenCalled();
  });

  it('updateFixedExpense rejects when the expense belongs to another user', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'someone-else',
      name: 'Rent',
      amount: 1000,
      due_day: 1,
      category: 'utilities',
    } as any);

    await expect(
      service.updateFixedExpense('user-123', 'fe-1', { amount: 2000 })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(supabaseRepo.updateFixedExpense).not.toHaveBeenCalled();
  });

  it('updateFixedExpense 404s when the expense does not exist', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue(null);

    await expect(
      service.updateFixedExpense('user-123', 'fe-missing', { amount: 2000 })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateFixedExpense merges partial input with the existing row', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'Rent',
      amount: 15000,
      due_day: 1,
      category: 'utilities',
    } as any);
    supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', amount: 16000 } as any);

    const result = await service.updateFixedExpense('user-123', 'fe-1', { amount: 16000 });

    expect(supabaseRepo.updateFixedExpense).toHaveBeenCalledWith('fe-1', {
      name: 'Rent',
      amount: 16000,
      due_day: 1,
      category: 'utilities',
    });
    expect(result).toEqual({ id: 'fe-1', amount: 16000 });
  });

  it('deleteFixedExpense rejects when the expense belongs to another user', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'someone-else' } as any);

    await expect(service.deleteFixedExpense('user-123', 'fe-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(supabaseRepo.deleteFixedExpense).not.toHaveBeenCalled();
  });

  it('deleteFixedExpense deletes once ownership is confirmed', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'user-123' } as any);

    await service.deleteFixedExpense('user-123', 'fe-1');

    expect(supabaseRepo.deleteFixedExpense).toHaveBeenCalledWith('fe-1');
  });

  it('retakePlan validates input then delegates to OnboardingService.retake', async () => {
    const input = {
      incomePattern: 'salaried',
      spendingHabit: 'tracker',
      incomeAmount: 50000,
      fixedTotal: 15000,
      sourceCount: 1,
    };
    onboardingService.retake.mockResolvedValue({
      planId: 'plan-2',
      pockets: [],
      redistribution: {
        totalMoved: 0,
        movements: [],
        previousPlanType: 'structured',
        newPlanType: 'structured',
        nextRetakeAvailableOn: '2026-09-01',
      },
    });

    const result = await service.retakePlan('user-123', input);

    expect(onboardingService.retake).toHaveBeenCalledWith(input, 'user-123');
    expect(onboardingService.commit).not.toHaveBeenCalled();
    expect(result.planId).toBe('plan-2');
  });

  it('retakePlan rejects invalid onboarding input without touching OnboardingService', async () => {
    await expect(service.retakePlan('user-123', { incomeAmount: -1 })).rejects.toBeInstanceOf(BadRequestException);
    expect(onboardingService.retake).not.toHaveBeenCalled();
  });

  it('getRetakeEligibility delegates to OnboardingService', async () => {
    onboardingService.getRetakeEligibility.mockResolvedValue({
      allowed: false,
      nextRetakeAvailableOn: '2026-09-01',
      lastRetakenAt: '2026-08-01T00:00:00.000Z',
      message: 'once per month',
    });

    const result = await service.getRetakeEligibility('user-123');

    expect(onboardingService.getRetakeEligibility).toHaveBeenCalledWith('user-123');
    expect(result.allowed).toBe(false);
  });

  it('getFixedExpenseSuggestions uses correct categories (not miscategorized)', async () => {
    const result = await service.getFixedExpenseSuggestions('user-123');

    const byName = Object.fromEntries(result.suggestions.map((s) => [s.name, s.category]));
    expect(byName['Rent']).toBe('housing');
    expect(byName['Internet']).toBe('utilities');
    expect(byName['Mobile Data']).toBe('utilities');
    expect(byName['School Fees']).toBe('education');
    expect(byName['Electricity']).toBe('utilities');
  });

  describe('updateFixedExpenseStatus', () => {
    it('writes the real status column, leaving name untouched (C-fixed-expenses-status)', async () => {
      supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'user-123', name: 'Rent' } as any);
      supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', user_id: 'user-123', name: 'Rent', status: 'inactive' } as any);

      const result = await service.updateFixedExpenseStatus('user-123', 'fe-1', { status: 'inactive' });

      expect(supabaseRepo.updateFixedExpense).toHaveBeenCalledWith('fe-1', { status: 'inactive' });
      expect(result.name).toBe('Rent'); // name is never mangled
      expect(result.status).toBe('inactive');
    });

    it('accepts "active" too', async () => {
      supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'user-123', name: 'Rent' } as any);
      supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', user_id: 'user-123', name: 'Rent', status: 'active' } as any);

      await service.updateFixedExpenseStatus('user-123', 'fe-1', { status: 'active' });

      expect(supabaseRepo.updateFixedExpense).toHaveBeenCalledWith('fe-1', { status: 'active' });
    });

    it('rejects an invalid status value', async () => {
      supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'user-123', name: 'Rent' } as any);

      await expect(service.updateFixedExpenseStatus('user-123', 'fe-1', { status: 'paused' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(supabaseRepo.updateFixedExpense).not.toHaveBeenCalled();
    });

    it('rejects updating another user\'s fixed expense', async () => {
      supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'someone-else', name: 'Rent' } as any);

      await expect(
        service.updateFixedExpenseStatus('user-123', 'fe-1', { status: 'inactive' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(supabaseRepo.updateFixedExpense).not.toHaveBeenCalled();
    });
  });
});