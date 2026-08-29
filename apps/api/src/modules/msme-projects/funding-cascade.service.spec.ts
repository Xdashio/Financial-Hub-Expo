import type { TierState, AllocationResult} from './funding-cascade.service';
import { FundingCascadeService, FundingTier } from './funding-cascade.service';

describe('FundingCascadeService', () => {
  let service: FundingCascadeService;

  beforeEach(() => {
    service = new FundingCascadeService();
  });

  // Helper to create standard tier states
  const createTiers = (overrides: Partial<TierState>[] = []): TierState[] => {
    const defaults: TierState[] = [
      { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 },
      { tier: 'needs', targetAmount: 30000, allocatedAmount: 0, spentAmount: 0 },
      { tier: 'wants', targetAmount: 20000, allocatedAmount: 0, spentAmount: 0 },
    ];
    return defaults.map((d, i) => ({ ...d, ...overrides[i] }));
  };

  describe('isTierComplete', () => {
    it('returns true when allocated >= target', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 50000, spentAmount: 10000 };
      expect(service.isTierComplete(tier)).toBe(true);
    });

    it('returns true when allocated exceeds target', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 55000, spentAmount: 10000 };
      expect(service.isTierComplete(tier)).toBe(true);
    });

    it('returns false when allocated < target', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 10000 };
      expect(service.isTierComplete(tier)).toBe(false);
    });

    it('returns false when allocated is 0', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 };
      expect(service.isTierComplete(tier)).toBe(false);
    });
  });

  describe('getFundingPercent', () => {
    it('returns 0% when allocated is 0', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 };
      expect(service.getFundingPercent(tier)).toBe(0);
    });

    it('returns 50% when half allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 25000, spentAmount: 0 };
      expect(service.getFundingPercent(tier)).toBe(50);
    });

    it('returns 100% when fully allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 50000, spentAmount: 0 };
      expect(service.getFundingPercent(tier)).toBe(100);
    });

    it('caps at 100% when over-allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 60000, spentAmount: 0 };
      expect(service.getFundingPercent(tier)).toBe(100);
    });

    it('handles floating point precision', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 100000, allocatedAmount: 33333.33, spentAmount: 0 };
      expect(service.getFundingPercent(tier)).toBe(33.33);
    });
  });

  describe('getRemainingCash', () => {
    it('returns allocated - spent', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 10000 };
      expect(service.getRemainingCash(tier)).toBe(20000);
    });

    it('returns 0 when spent >= allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 30000 };
      expect(service.getRemainingCash(tier)).toBe(0);
    });

    it('returns 0 when spent exceeds allocated (edge case)', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 35000 };
      expect(service.getRemainingCash(tier)).toBe(0);
    });
  });

  describe('getNextIncomeTier', () => {
    it('returns priorities when none are funded', () => {
      const tiers = createTiers();
      expect(service.getNextIncomeTier(tiers)).toBe('priorities');
    });

    it('returns needs when priorities complete', () => {
      const tiers = createTiers([
        { allocatedAmount: 50000 }, // priorities complete
        {}, // needs empty
        {},
      ]);
      expect(service.getNextIncomeTier(tiers)).toBe('needs');
    });

    it('returns wants when priorities and needs complete', () => {
      const tiers = createTiers([
        { allocatedAmount: 50000 }, // priorities complete
        { allocatedAmount: 30000 }, // needs complete
        {}, // wants empty
      ]);
      expect(service.getNextIncomeTier(tiers)).toBe('wants');
    });

    it('returns null when all tiers complete', () => {
      const tiers = createTiers([
        { allocatedAmount: 50000 },
        { allocatedAmount: 30000 },
        { allocatedAmount: 20000 },
      ]);
      expect(service.getNextIncomeTier(tiers)).toBeNull();
    });

    it('handles unordered tier array', () => {
      const tiers: TierState[] = [
        { tier: 'wants', targetAmount: 20000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'priorities', targetAmount: 50000, allocatedAmount: 50000, spentAmount: 0 },
        { tier: 'needs', targetAmount: 30000, allocatedAmount: 0, spentAmount: 0 },
      ];
      // priorities is complete, so next should be needs
      expect(service.getNextIncomeTier(tiers)).toBe('needs');
    });
  });

  describe('calculateTierCapacity', () => {
    it('returns full target when nothing allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 };
      expect(service.calculateTierCapacity(tier)).toBe(50000);
    });

    it('returns remaining target', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 0 };
      expect(service.calculateTierCapacity(tier)).toBe(20000);
    });

    it('returns 0 when fully allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 50000, spentAmount: 0 };
      expect(service.calculateTierCapacity(tier)).toBe(0);
    });

    it('returns 0 when over-allocated', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 60000, spentAmount: 0 };
      expect(service.calculateTierCapacity(tier)).toBe(0);
    });
  });

  describe('allocateIncome - core cascade logic', () => {
    it('allocates all to priorities when empty', () => {
      const tiers = createTiers();
      const result = service.allocateIncome(25000, tiers);
      
      expect(result.allocations).toEqual([{ tier: 'priorities', amount: 25000 }]);
      expect(result.excessAmount).toBe(0);
      expect(result.nextTier).toBe('priorities');
      expect(result.allTiersComplete).toBe(false);
    });

    it('fills priorities then flows to needs', () => {
      const tiers = createTiers([
        { allocatedAmount: 40000 }, // 10k remaining in priorities
        {},
        {},
      ]);
      const result = service.allocateIncome(25000, tiers);
      
      expect(result.allocations).toEqual([
        { tier: 'priorities', amount: 10000 },
        { tier: 'needs', amount: 15000 },
      ]);
      expect(result.excessAmount).toBe(0);
      expect(result.nextTier).toBe('needs');
    });

    it('flows through all three tiers', () => {
      const tiers = createTiers([
        { allocatedAmount: 45000 }, // 5k remaining
        { allocatedAmount: 25000 }, // 5k remaining
        {}, // wants empty
      ]);
      const result = service.allocateIncome(20000, tiers);
      
      expect(result.allocations).toEqual([
        { tier: 'priorities', amount: 5000 },
        { tier: 'needs', amount: 5000 },
        { tier: 'wants', amount: 10000 },
      ]);
      expect(result.excessAmount).toBe(0);
      expect(result.nextTier).toBe('wants');
    });

    it('creates excess when all tiers full', () => {
      const tiers = createTiers([
        { allocatedAmount: 50000 },
        { allocatedAmount: 30000 },
        { allocatedAmount: 20000 },
      ]);
      const result = service.allocateIncome(10000, tiers);
      
      expect(result.allocations).toEqual([]);
      expect(result.excessAmount).toBe(10000);
      expect(result.nextTier).toBeNull();
      expect(result.allTiersComplete).toBe(true);
    });

    it('creates excess when income exceeds remaining capacity', () => {
      const tiers = createTiers([
        { allocatedAmount: 48000 }, // 2k remaining
        { allocatedAmount: 29000 }, // 1k remaining
        { allocatedAmount: 19000 }, // 1k remaining
      ]);
      const result = service.allocateIncome(10000, tiers);
      
      expect(result.allocations).toEqual([
        { tier: 'priorities', amount: 2000 },
        { tier: 'needs', amount: 1000 },
        { tier: 'wants', amount: 1000 },
      ]);
      expect(result.excessAmount).toBe(6000);
      expect(result.allTiersComplete).toBe(true);
    });

    it('handles partial fill of first incomplete tier', () => {
      const tiers = createTiers([
        { allocatedAmount: 50000 }, // complete
        { allocatedAmount: 10000 }, // needs: 20k remaining
        {},
      ]);
      const result = service.allocateIncome(5000, tiers);
      
      expect(result.allocations).toEqual([{ tier: 'needs', amount: 5000 }]);
      expect(result.excessAmount).toBe(0);
      expect(result.nextTier).toBe('needs');
    });

    it('handles zero income', () => {
      const tiers = createTiers();
      const result = service.allocateIncome(0, tiers);
      
      expect(result.allocations).toEqual([]);
      expect(result.excessAmount).toBe(0);
      expect(result.nextTier).toBe('priorities');
    });
  });

  describe('previewAllocation', () => {
    it('returns same result as allocateIncome without side effects', () => {
      const tiers = createTiers();
      const preview = service.previewAllocation(10000, tiers);
      const actual = service.allocateIncome(10000, tiers);
      
      expect(preview).toEqual(actual);
    });
  });

  describe('validateTierTargets', () => {
    it('returns true when sum matches contract value', () => {
      const tiers = createTiers();
      expect(service.validateTierTargets(tiers, 100000)).toBe(true);
    });

    it('returns true with floating point tolerance', () => {
      const tiers = createTiers();
      tiers[0].targetAmount = 33333.33;
      tiers[1].targetAmount = 33333.33;
      tiers[2].targetAmount = 33333.34;
      expect(service.validateTierTargets(tiers, 100000)).toBe(true);
    });

    it('returns false when sum does not match', () => {
      const tiers = createTiers();
      expect(service.validateTierTargets(tiers, 90000)).toBe(false);
    });

    it('returns false when sum exceeds contract value', () => {
      const tiers = createTiers();
      expect(service.validateTierTargets(tiers, 110000)).toBe(false);
    });
  });

  describe('validateTierStructure', () => {
    it('returns valid for correct three tiers', () => {
      const tiers = createTiers();
      const result = service.validateTierStructure(tiers);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects wrong number of tiers', () => {
      const tiers = createTiers().slice(0, 2);
      const result = service.validateTierStructure(tiers);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Exactly 3 tiers required');
    });

    it('rejects duplicate tiers', () => {
      const tiers: TierState[] = [
        { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'priorities', targetAmount: 30000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'wants', targetAmount: 20000, allocatedAmount: 0, spentAmount: 0 },
      ];
      const result = service.validateTierStructure(tiers);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate tier names found');
    });

    it('validates all three required tiers exist (order in array does not matter - DB has sort_order)', () => {
      const tiers: TierState[] = [
        { tier: 'needs', targetAmount: 30000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'wants', targetAmount: 20000, allocatedAmount: 0, spentAmount: 0 },
      ];
      const result = service.validateTierStructure(tiers);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('recordSpending', () => {
    it('returns updated spent amount and remaining cash', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 10000 };
      const result = service.recordSpending(tier, 5000);
      
      expect(result.tier).toBe('priorities');
      expect(result.spentAmount).toBe(15000);
      expect(result.remainingCash).toBe(15000);
    });

    it('throws when amount is not positive', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 10000 };
      expect(() => service.recordSpending(tier, 0)).toThrow('Spending amount must be positive');
      expect(() => service.recordSpending(tier, -100)).toThrow('Spending amount must be positive');
    });

    it('throws when spending exceeds allocated cash', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 25000 };
      expect(() => service.recordSpending(tier, 10000)).toThrow('exceeds allocated cash');
    });

    it('handles exact spend to zero remaining', () => {
      const tier: TierState = { tier: 'priorities', targetAmount: 50000, allocatedAmount: 30000, spentAmount: 20000 };
      const result = service.recordSpending(tier, 10000);
      
      expect(result.spentAmount).toBe(30000);
      expect(result.remainingCash).toBe(0);
    });
  });

  describe('calculateProjectSummary', () => {
    it('computes correct summary for empty project', () => {
      const tiers = createTiers();
      const summary = service.calculateProjectSummary(
        'proj-1', 'Test Project', 'catering', 100000, 'active', false, tiers
      );

      expect(summary.id).toBe('proj-1');
      expect(summary.name).toBe('Test Project');
      expect(summary.kind).toBe('catering');
      expect(summary.contractValue).toBe(100000);
      expect(summary.status).toBe('active');
      expect(summary.isActiveCascade).toBe(false);
      expect(summary.tiers).toHaveLength(3);
      expect(summary.nextIncomeGoesTo).toBe('priorities');
      expect(summary.totalAllocated).toBe(0);
      expect(summary.totalSpent).toBe(0);
      expect(summary.totalRemaining).toBe(0);
      expect(summary.excessPending).toBeNull();
    });

    it('computes correct summary with partial allocations', () => {
      const tiers = createTiers([
        { allocatedAmount: 30000, spentAmount: 10000 },
        { allocatedAmount: 15000, spentAmount: 5000 },
        { allocatedAmount: 0, spentAmount: 0 },
      ]);
      const summary = service.calculateProjectSummary(
        'proj-1', 'Test Project', 'catering', 100000, 'active', true, tiers
      );

      expect(summary.totalAllocated).toBe(45000);
      expect(summary.totalSpent).toBe(15000);
      expect(summary.totalRemaining).toBe(30000); // (30k-10k) + (15k-5k) + 0
      expect(summary.nextIncomeGoesTo).toBe('priorities');
      expect(summary.isActiveCascade).toBe(true);
    });

    it('computes correct summary when all tiers complete', () => {
      const tiers = createTiers([
        { allocatedAmount: 50000, spentAmount: 40000 },
        { allocatedAmount: 30000, spentAmount: 25000 },
        { allocatedAmount: 20000, spentAmount: 15000 },
      ]);
      const summary = service.calculateProjectSummary(
        'proj-1', 'Test Project', 'catering', 100000, 'active', true, tiers
      );

      expect(summary.totalAllocated).toBe(100000);
      expect(summary.totalSpent).toBe(80000);
      expect(summary.totalRemaining).toBe(20000);
      expect(summary.nextIncomeGoesTo).toBeNull();
      expect(summary.tiers[0].fundingStatus).toBe('complete');
      expect(summary.tiers[1].fundingStatus).toBe('complete');
      expect(summary.tiers[2].fundingStatus).toBe('complete');
      expect(summary.tiers[0].fundingPercent).toBe(100);
      expect(summary.tiers[1].fundingPercent).toBe(100);
      expect(summary.tiers[2].fundingPercent).toBe(100);
    });

    it('includes correct tier sort order', () => {
      const tiers = createTiers();
      const summary = service.calculateProjectSummary(
        'proj-1', 'Test Project', 'catering', 100000, 'active', false, tiers
      );

      expect(summary.tiers[0].sortOrder).toBe(1);
      expect(summary.tiers[0].tier).toBe('priorities');
      expect(summary.tiers[1].sortOrder).toBe(2);
      expect(summary.tiers[1].tier).toBe('needs');
      expect(summary.tiers[2].sortOrder).toBe(3);
      expect(summary.tiers[2].tier).toBe('wants');
    });
  });

  describe('shouldCreateExcessPrompt', () => {
    it('returns true when excess > 0 and all tiers complete', () => {
      const result: AllocationResult = {
        allocations: [],
        excessAmount: 5000,
        nextTier: null,
        allTiersComplete: true,
      };
      expect(service.shouldCreateExcessPrompt(result)).toBe(true);
    });

    it('returns false when no excess', () => {
      const result: AllocationResult = {
        allocations: [{ tier: 'priorities', amount: 1000 }],
        excessAmount: 0,
        nextTier: 'priorities',
        allTiersComplete: false,
      };
      expect(service.shouldCreateExcessPrompt(result)).toBe(false);
    });

    it('returns false when excess but not all tiers complete', () => {
      const result: AllocationResult = {
        allocations: [
          { tier: 'priorities', amount: 5000 },
          { tier: 'needs', amount: 3000 },
        ],
        excessAmount: 2000,
        nextTier: 'wants',
        allTiersComplete: false,
      };
      expect(service.shouldCreateExcessPrompt(result)).toBe(false);
    });
  });

  describe('validateExcessTarget', () => {
    it('returns true for valid targets', () => {
      expect(service.validateExcessTarget('needs')).toBe(true);
      expect(service.validateExcessTarget('wants')).toBe(true);
      expect(service.validateExcessTarget('savings')).toBe(true);
      expect(service.validateExcessTarget('keep')).toBe(true);
    });

    it('returns false for invalid targets', () => {
      expect(service.validateExcessTarget('priorities')).toBe(false);
      expect(service.validateExcessTarget('invalid')).toBe(false);
      expect(service.validateExcessTarget('')).toBe(false);
    });
  });

  describe('resolveExcessTarget', () => {
    it('returns tier for needs/wants', () => {
      expect(service.resolveExcessTarget('needs')).toBe('needs');
      expect(service.resolveExcessTarget('wants')).toBe('wants');
    });

    it('returns special values for savings/keep', () => {
      expect(service.resolveExcessTarget('savings')).toBe('savings');
      expect(service.resolveExcessTarget('keep')).toBe('keep');
    });

    it('throws for invalid target', () => {
      expect(() => service.resolveExcessTarget('invalid')).toThrow('Invalid excess target');
    });
  });

  describe('edge cases - cascade order independence', () => {
    it('works correctly regardless of input array order', () => {
      const tiers: TierState[] = [
        { tier: 'wants', targetAmount: 20000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'needs', targetAmount: 30000, allocatedAmount: 0, spentAmount: 0 },
      ];

      const result = service.allocateIncome(100000, tiers);
      
      expect(result.allocations).toEqual([
        { tier: 'priorities', amount: 50000 },
        { tier: 'needs', amount: 30000 },
        { tier: 'wants', amount: 20000 },
      ]);
      expect(result.excessAmount).toBe(0);
    });

    it('handles missing tiers gracefully', () => {
      const tiers: TierState[] = [
        { tier: 'priorities', targetAmount: 50000, allocatedAmount: 0, spentAmount: 0 },
        { tier: 'needs', targetAmount: 30000, allocatedAmount: 0, spentAmount: 0 },
      ];

      const result = service.allocateIncome(100000, tiers);
      
      expect(result.allocations).toEqual([
        { tier: 'priorities', amount: 50000 },
        { tier: 'needs', amount: 30000 },
      ]);
      expect(result.excessAmount).toBe(20000); // wants missing, so excess
    });
  });
});