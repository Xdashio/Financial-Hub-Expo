import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { MsmeProjectsController } from './msme-projects.controller';
import { ProjectsService } from './projects.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import type { FundingTier } from './funding-cascade.service';

interface ProjectSummary {
  id: string;
  name: string;
  kind: string;
  contractValue: number;
  status: string;
  isActiveCascade: boolean;
  tiers: Array<{
    id: string;
    tier: FundingTier;
    sortOrder: number;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingStatus: 'in_progress' | 'complete';
    fundingPercent: number;
  }>;
  nextIncomeGoesTo: FundingTier | null;
  totalAllocated: number;
  totalSpent: number;
  totalRemaining: number;
  excessPending: number | null;
}

interface ExcessPrompt {
  id: string;
  project_id: string;
  income_event_id: string;
  excess_amount: number;
  status: 'pending' | 'resolved' | 'dismissed';
  chosen_target: 'needs' | 'wants' | 'savings' | 'keep' | null;
  created_at: string;
  resolved_at: string | null;
}

describe('MsmeProjectsController', () => {
  let controller: MsmeProjectsController;
  let projectsService: jest.Mocked<ProjectsService>;

  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockReq = { user: mockUser };

  const createMockSummary = (overrides: Partial<ProjectSummary> = {}): ProjectSummary => ({
    id: 'proj-123',
    name: 'Wedding Project',
    kind: 'wedding',
    contractValue: 100000,
    status: 'active',
    isActiveCascade: true,
    tiers: [
      { id: 'tier-1', tier: 'priorities' as FundingTier, sortOrder: 1, targetAmount: 50000, allocatedAmount: 30000, spentAmount: 10000, remainingCash: 20000, fundingStatus: 'in_progress', fundingPercent: 60 },
      { id: 'tier-2', tier: 'needs' as FundingTier, sortOrder: 2, targetAmount: 30000, allocatedAmount: 15000, spentAmount: 5000, remainingCash: 10000, fundingStatus: 'in_progress', fundingPercent: 50 },
      { id: 'tier-3', tier: 'wants' as FundingTier, sortOrder: 3, targetAmount: 20000, allocatedAmount: 0, spentAmount: 0, remainingCash: 0, fundingStatus: 'in_progress', fundingPercent: 0 },
    ],
    nextIncomeGoesTo: 'priorities' as FundingTier,
    totalAllocated: 45000,
    totalSpent: 15000,
    totalRemaining: 30000,
    excessPending: null,
    ...overrides,
  });

  beforeEach(async () => {
    projectsService = {
      getProjectsForUser: jest.fn(),
      createProject: jest.fn(),
      getProjectById: jest.fn(),
      updateProjectStatus: jest.fn(),
      activateCascade: jest.fn(),
      deactivateCascade: jest.fn(),
      recordIncome: jest.fn(),
      recordSpend: jest.fn(),
      getPendingExcessPrompts: jest.fn(),
      resolveExcessPrompt: jest.fn(),
      dismissExcessPrompt: jest.fn(),
      completeProject: jest.fn(),
      resolveProjectCompletion: jest.fn(),
      updateSpendingControls: jest.fn(),
      previewIncome: jest.fn(),
      getProjectTransactions: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MsmeProjectsController],
      providers: [{ provide: ProjectsService, useValue: projectsService }],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MsmeProjectsController>(MsmeProjectsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns list of projects for authenticated user', async () => {
      projectsService.getProjectsForUser.mockResolvedValue([createMockSummary()]);

      const result = await controller.getAll(mockReq);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'proj-123',
        name: 'Wedding Project',
        kind: 'wedding',
        contractValue: 100000,
      });
      expect(projectsService.getProjectsForUser).toHaveBeenCalledWith('user-123', undefined, undefined);
    });

    it('returns empty array when user has no projects', async () => {
      projectsService.getProjectsForUser.mockResolvedValue([]);

      const result = await controller.getAll(mockReq);

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    const createInput = {
      name: 'Wedding Project',
      kind: 'wedding',
      contractValue: 100000,
      tiers: { priorities: 50000, needs: 30000, wants: 20000 },
    };

    it('creates a new project with valid input', async () => {
      projectsService.createProject.mockResolvedValue(createMockSummary());

      const result = await controller.create(createInput, mockReq);

      expect(result).toMatchObject({
        id: 'proj-123',
        name: 'Wedding Project',
      });
      expect(projectsService.createProject).toHaveBeenCalledWith('user-123', createInput);
    });

    it('rejects invalid tier targets (not summing to contract value)', async () => {
      projectsService.createProject.mockRejectedValue(new Error('Tier targets must sum to contract value'));

      await expect(
        controller.create({ ...createInput, tiers: { priorities: 50000, needs: 30000, wants: 10000 } }, mockReq)
      ).rejects.toThrow('Tier targets must sum to contract value');
    });
  });

  describe('getById', () => {
    it('returns project details for owner', async () => {
      projectsService.getProjectById.mockResolvedValue(createMockSummary());

      const result = await controller.getById('proj-123', mockReq);

      expect(result).toMatchObject({
        id: 'proj-123',
        name: 'Wedding Project',
        tiers: expect.arrayContaining([
          expect.objectContaining({ tier: 'priorities', targetAmount: 50000 }),
          expect.objectContaining({ tier: 'needs', targetAmount: 30000 }),
          expect.objectContaining({ tier: 'wants', targetAmount: 20000 }),
        ]),
      });
    });

    it('throws 404 for non-existent project', async () => {
      projectsService.getProjectById.mockRejectedValue(new Error('Project not found'));

      await expect(controller.getById('non-existent', mockReq)).rejects.toThrow('Project not found');
    });

    it('throws 403 for accessing another user project', async () => {
      projectsService.getProjectById.mockRejectedValue(new Error('You do not have access to this project'));

      await expect(controller.getById('proj-123', mockReq)).rejects.toThrow('You do not have access to this project');
    });
  });

  describe('updateStatus', () => {
    it('updates project status from draft to active', async () => {
      const updatedSummary = createMockSummary({ status: 'active' });
      projectsService.updateProjectStatus.mockResolvedValue(updatedSummary);

      const result = await controller.updateStatus('proj-123', { status: 'active' }, mockReq);

      expect(result.status).toBe('active');
      expect(projectsService.updateProjectStatus).toHaveBeenCalledWith('proj-123', 'user-123', 'active');
    });

    it('updates project status to completed', async () => {
      const updatedSummary = createMockSummary({ status: 'completed' });
      projectsService.updateProjectStatus.mockResolvedValue(updatedSummary);

      const result = await controller.updateStatus('proj-123', { status: 'completed' }, mockReq);

      expect(result.status).toBe('completed');
    });

    it('rejects invalid state transition', async () => {
      projectsService.updateProjectStatus.mockRejectedValue(new Error('Cannot change status from completed'));

      await expect(
        controller.updateStatus('proj-123', { status: 'draft' }, mockReq)
      ).rejects.toThrow('Cannot change status from completed');
    });
  });

  describe('activateCascade', () => {
    it('activates cascade for active project', async () => {
      const updatedSummary = createMockSummary({ isActiveCascade: true });
      projectsService.activateCascade.mockResolvedValue(updatedSummary);

      const result = await controller.activateCascade('proj-123', mockReq);

      expect(result.isActiveCascade).toBe(true);
      expect(projectsService.activateCascade).toHaveBeenCalledWith('proj-123', 'user-123');
    });

    it('throws 409 when user already has active cascade on another project', async () => {
      projectsService.activateCascade.mockRejectedValue(new Error('You already have an active cascade on another project'));

      await expect(controller.activateCascade('proj-123', mockReq)).rejects.toThrow('You already have an active cascade on another project');
    });

    it('throws 400 when project is not active', async () => {
      projectsService.activateCascade.mockRejectedValue(new Error('Only active projects can have cascade activated'));

      await expect(controller.activateCascade('proj-123', mockReq)).rejects.toThrow('Only active projects can have cascade activated');
    });
  });

  describe('deactivateCascade', () => {
    it('deactivates cascade', async () => {
      const updatedSummary = createMockSummary({ isActiveCascade: false });
      projectsService.deactivateCascade.mockResolvedValue(updatedSummary);

      const result = await controller.deactivateCascade('proj-123', mockReq);

      expect(result.isActiveCascade).toBe(false);
    });
  });

  describe('recordIncome', () => {
    const incomeInput = {
      amount: 25000,
      source: 'Deposit',
      label: 'Initial deposit',
      date: '2024-01-15',
    };

    it('records income and runs cascade allocation', async () => {
      const updatedSummary = createMockSummary({
        totalAllocated: 70000,
        tiers: [
          { ...createMockSummary().tiers[0], allocatedAmount: 50000, fundingStatus: 'complete', fundingPercent: 100, remainingCash: 40000 },
          { ...createMockSummary().tiers[1], allocatedAmount: 20000, fundingPercent: 66.67, remainingCash: 15000 },
          createMockSummary().tiers[2],
        ],
        nextIncomeGoesTo: 'needs' as FundingTier,
      });
      projectsService.recordIncome.mockResolvedValue(updatedSummary);

      const result = await controller.recordIncome('proj-123', incomeInput, mockReq);

      expect(result.totalAllocated).toBe(70000);
      expect(result.tiers[0].fundingStatus).toBe('complete');
      expect(result.nextIncomeGoesTo).toBe('needs');
      expect(projectsService.recordIncome).toHaveBeenCalledWith('proj-123', 'user-123', incomeInput);
    });

    it('handles excess prompt creation', async () => {
      const updatedSummary = createMockSummary({
        totalAllocated: 100000,
        excessPending: 5000,
        nextIncomeGoesTo: null,
      });
      projectsService.recordIncome.mockResolvedValue(updatedSummary);

      const result = await controller.recordIncome('proj-123', { ...incomeInput, amount: 60000 }, mockReq);

      expect(result.excessPending).toBe(5000);
      expect(result.nextIncomeGoesTo).toBeNull();
    });

    it('throws when cascade not active', async () => {
      projectsService.recordIncome.mockRejectedValue(new Error('Cascade must be active to record income'));

      await expect(controller.recordIncome('proj-123', incomeInput, mockReq)).rejects.toThrow('Cascade must be active to record income');
    });
  });

  describe('recordSpend', () => {
    const spendInput = {
      tierId: 'tier-1',
      amount: 5000,
      merchant: 'Catering Co',
      category: 'food',
      note: 'Food tasting',
    };

    it('records spend against a tier', async () => {
      const updatedSummary = createMockSummary({
        totalSpent: 20000,
        tiers: [
          { ...createMockSummary().tiers[0], spentAmount: 15000, remainingCash: 15000 },
          createMockSummary().tiers[1],
          createMockSummary().tiers[2],
        ],
      });
      projectsService.recordSpend.mockResolvedValue(updatedSummary);

      const result = await controller.recordSpend('proj-123', spendInput, mockReq);

      expect(result.totalSpent).toBe(20000);
      expect(result.tiers[0].spentAmount).toBe(15000);
      expect(projectsService.recordSpend).toHaveBeenCalledWith(
        'proj-123', 'user-123', 'tier-1', 5000, 'Catering Co', 'food', 'Food tasting', undefined
      );
    });

    it('throws when spend exceeds available cash', async () => {
      projectsService.recordSpend.mockRejectedValue(new Error('exceeds available cash'));

      await expect(
        controller.recordSpend('proj-123', { ...spendInput, amount: 50000 }, mockReq)
      ).rejects.toThrow('exceeds available cash');
    });

    it('throws when tier not found', async () => {
      projectsService.recordSpend.mockRejectedValue(new Error('Tier not found'));

      await expect(
        controller.recordSpend('proj-123', { ...spendInput, tierId: 'invalid-tier' }, mockReq)
      ).rejects.toThrow('Tier not found');
    });
  });

  describe('getPendingExcessPrompts', () => {
    it('returns pending excess prompts', async () => {
      const prompts: ExcessPrompt[] = [
        { id: 'prompt-1', project_id: 'proj-123', income_event_id: 'income-1', excess_amount: 5000, status: 'pending', chosen_target: null, created_at: new Date().toISOString(), resolved_at: null },
      ];
      projectsService.getPendingExcessPrompts.mockResolvedValue(prompts);

      const result = await controller.getPendingExcessPrompts('proj-123', mockReq);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'prompt-1',
        excess_amount: 5000,
        status: 'pending',
      });
    });
  });

  describe('resolveExcessPrompt', () => {
    it('resolves excess prompt with chosen target', async () => {
      const updatedSummary = createMockSummary({ excessPending: null });
      projectsService.resolveExcessPrompt.mockResolvedValue(updatedSummary);

      const result = await controller.resolveExcessPrompt('proj-123', 'prompt-1', { chosenTarget: 'needs' }, mockReq);

      expect(result.excessPending).toBeNull();
      expect(projectsService.resolveExcessPrompt).toHaveBeenCalledWith('proj-123', 'user-123', 'prompt-1', 'needs', undefined);
    });

    it('requires confirmSavings for savings target', async () => {
      projectsService.resolveExcessPrompt.mockRejectedValue(new Error('Moving excess to Savings requires explicit confirmation'));
      await expect(
        controller.resolveExcessPrompt('proj-123', 'prompt-1', { chosenTarget: 'savings' }, mockReq),
      ).rejects.toThrow('Moving excess to Savings requires explicit confirmation');
    });

    it('resolves savings excess with confirmSavings true', async () => {
      const updatedSummary = createMockSummary({ excessPending: null });
      projectsService.resolveExcessPrompt.mockResolvedValue(updatedSummary);
      const result = await controller.resolveExcessPrompt('proj-123', 'prompt-1', { chosenTarget: 'savings', confirmSavings: true }, mockReq);
      expect(result.excessPending).toBeNull();
      expect(projectsService.resolveExcessPrompt).toHaveBeenCalledWith('proj-123', 'user-123', 'prompt-1', 'savings', true);
    });

    it('throws for invalid target', async () => {
      projectsService.resolveExcessPrompt.mockRejectedValue(new Error('Invalid excess target'));

      await expect(
        controller.resolveExcessPrompt('proj-123', 'prompt-1', { chosenTarget: 'invalid' as any }, mockReq)
      ).rejects.toThrow('Invalid excess target');
    });
  });

  describe('dismissExcessPrompt', () => {
    it('dismisses excess prompt', async () => {
      const updatedSummary = createMockSummary({ excessPending: null });
      projectsService.dismissExcessPrompt.mockResolvedValue(updatedSummary);

      const result = await controller.dismissExcessPrompt('proj-123', 'prompt-1', mockReq);

      expect(result.excessPending).toBeNull();
      expect(projectsService.dismissExcessPrompt).toHaveBeenCalledWith('proj-123', 'user-123', 'prompt-1');
    });
  });
});