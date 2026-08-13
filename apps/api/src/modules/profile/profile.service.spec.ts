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
      getTopLevelPocketsByPlanId: jest.fn().mockResolvedValue([]),
      updatePocket: jest.fn(),
      createPocket: jest.fn(),
      getPocketSummary: jest.fn().mockResolvedValue({ available: 0 }),
      deletePocket: jest.fn(),
      createTransactions: jest.fn(),
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

  it('updateFixedExpense accepts snake_case due_day from the mobile form', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'Rent',
      amount: 15000,
      due_day: 1,
      category: 'housing',
    } as any);
    supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', due_day: 5 } as any);

    await service.updateFixedExpense('user-123', 'fe-1', { due_day: 5 });

    expect(supabaseRepo.updateFixedExpense).toHaveBeenCalledWith(
      'fe-1',
      expect.objectContaining({ due_day: 5 }),
    );
  });

  it('updateFixedExpense renames the matching fixed pocket so the homepage updates', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'Rent',
      amount: 15000,
      due_day: 1,
      category: 'housing',
    } as any);
    supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', name: 'House rent' } as any);
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1' } as any);
    supabaseRepo.getTopLevelPocketsByPlanId.mockResolvedValue([
      { id: 'pocket-rent', name: 'Rent', kind: 'fixed', category: 'housing', monthly_allocation: 15000 },
      { id: 'pocket-food', name: 'Food & Groceries', kind: 'spendable', category: 'food' },
    ] as any);
    supabaseRepo.updatePocket.mockResolvedValue({ id: 'pocket-rent', name: 'House rent' } as any);

    await service.updateFixedExpense('user-123', 'fe-1', { name: 'House rent' });

    expect(supabaseRepo.updatePocket).toHaveBeenCalledWith(
      'pocket-rent',
      expect.objectContaining({ name: 'House rent', category: 'housing', monthly_allocation: 15000 }),
    );
    expect(supabaseRepo.createPocket).not.toHaveBeenCalled();
  });

  it('updateFixedExpense matches UTILITIES expense to Utilities pocket case-insensitively', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'UTILITIES',
      amount: 3000,
      due_day: 15,
      category: 'utilities',
    } as any);
    supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', name: 'Power & water' } as any);
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1' } as any);
    supabaseRepo.getTopLevelPocketsByPlanId.mockResolvedValue([
      { id: 'pocket-util', name: 'Utilities', kind: 'fixed', category: 'utilities', monthly_allocation: 3000 },
    ] as any);
    supabaseRepo.updatePocket.mockResolvedValue({ id: 'pocket-util', name: 'Power & water' } as any);

    await service.updateFixedExpense('user-123', 'fe-1', { name: 'Power & water' });

    expect(supabaseRepo.updatePocket).toHaveBeenCalledWith(
      'pocket-util',
      expect.objectContaining({ name: 'Power & water' }),
    );
    expect(supabaseRepo.createPocket).not.toHaveBeenCalled();
  });

  it('updateFixedExpense falls back to the sole fixed pocket in that category', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'UTILITIES',
      amount: 3000,
      due_day: 15,
      category: 'utilities',
    } as any);
    supabaseRepo.updateFixedExpense.mockResolvedValue({ id: 'fe-1', name: 'Home bills' } as any);
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1' } as any);
    supabaseRepo.getTopLevelPocketsByPlanId.mockResolvedValue([
      { id: 'pocket-net', name: 'Internet', kind: 'fixed', category: 'utilities', monthly_allocation: 3000 },
      { id: 'pocket-rent', name: 'Rent', kind: 'fixed', category: 'housing', monthly_allocation: 15000 },
    ] as any);
    supabaseRepo.updatePocket.mockResolvedValue({ id: 'pocket-net', name: 'Home bills' } as any);

    await service.updateFixedExpense('user-123', 'fe-1', { name: 'Home bills' });

    expect(supabaseRepo.updatePocket).toHaveBeenCalledWith(
      'pocket-net',
      expect.objectContaining({ name: 'Home bills', category: 'utilities' }),
    );
  });

  it('createFixedExpense provisions a matching fixed pocket on the active plan', async () => {
    supabaseRepo.createFixedExpense.mockResolvedValue({ id: 'fe-2', user_id: 'user-123', name: 'Wifi' } as any);
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1' } as any);
    supabaseRepo.getTopLevelPocketsByPlanId.mockResolvedValue([]);
    supabaseRepo.createPocket.mockResolvedValue({ id: 'pocket-wifi', name: 'Wifi' } as any);

    await service.createFixedExpense('user-123', {
      name: 'Wifi',
      amount: 2500,
      dueDay: 10,
      category: 'utilities',
    });

    expect(supabaseRepo.createPocket).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 'plan-1',
        name: 'Wifi',
        kind: 'fixed',
        category: 'utilities',
        monthly_allocation: 2500,
        is_time_locked: true,
      }),
    );
  });

  it('deleteFixedExpense rejects when the expense belongs to another user', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({ id: 'fe-1', user_id: 'someone-else' } as any);

    await expect(service.deleteFixedExpense('user-123', 'fe-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(supabaseRepo.deleteFixedExpense).not.toHaveBeenCalled();
  });

  it('deleteFixedExpense deletes once ownership is confirmed', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'UTILITIES',
      category: 'utilities',
    } as any);
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1' } as any);
    supabaseRepo.getTopLevelPocketsByPlanId.mockResolvedValue([
      { id: 'pocket-util', name: 'UTILITIES', kind: 'fixed', category: 'utilities', is_time_locked: true },
      { id: 'pocket-savings', name: 'Savings', kind: 'savings', category: null, is_time_locked: true },
    ] as any);
    supabaseRepo.getPocketSummary = jest.fn().mockResolvedValue({ available: 0 });
    supabaseRepo.updatePocket.mockResolvedValue({ id: 'pocket-util' } as any);
    supabaseRepo.deletePocket = jest.fn().mockResolvedValue(undefined);
    supabaseRepo.createTransactions = jest.fn();

    await service.deleteFixedExpense('user-123', 'fe-1');

    expect(supabaseRepo.deleteFixedExpense).toHaveBeenCalledWith('fe-1');
    expect(supabaseRepo.updatePocket).toHaveBeenCalledWith(
      'pocket-util',
      expect.objectContaining({ is_time_locked: false }),
    );
    expect(supabaseRepo.deletePocket).toHaveBeenCalledWith('pocket-util');
  });

  it('deleteFixedExpense moves leftover balance into Savings before removing the pocket', async () => {
    supabaseRepo.getFixedExpenseById.mockResolvedValue({
      id: 'fe-1',
      user_id: 'user-123',
      name: 'UTILITIES',
      category: 'utilities',
    } as any);
    supabaseRepo.getActivePlanByUserId.mockResolvedValue({ id: 'plan-1' } as any);
    supabaseRepo.getTopLevelPocketsByPlanId.mockResolvedValue([
      { id: 'pocket-util', name: 'UTILITIES', kind: 'fixed', category: 'utilities', is_time_locked: true },
      { id: 'pocket-savings', name: 'Savings', kind: 'savings', category: null, is_time_locked: true },
    ] as any);
    supabaseRepo.getPocketSummary = jest.fn().mockResolvedValue({ available: 1200 });
    supabaseRepo.updatePocket.mockResolvedValue({ id: 'pocket-util' } as any);
    supabaseRepo.deletePocket = jest.fn().mockResolvedValue(undefined);
    supabaseRepo.createTransactions = jest.fn().mockResolvedValue([]);

    await service.deleteFixedExpense('user-123', 'fe-1');

    expect(supabaseRepo.createTransactions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ pocket_id: 'pocket-util', amount: -1200, type: 'reallocation_out' }),
        expect.objectContaining({ pocket_id: 'pocket-savings', amount: 1200, type: 'reallocation_in' }),
      ]),
    );
    expect(supabaseRepo.deletePocket).toHaveBeenCalledWith('pocket-util');
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