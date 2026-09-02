import { 
  UserSchema, 
  PocketSchema, 
  PlanSchema, 
  PocketKindSchema, 
  PlanTypeSchema,
  PocketCategorySchema,
  TransactionSchema,
  ReallocationSchema,
  ReallocationInputSchema,
  ReallocationCompleteInputSchema,
  IncomeEventSchema,
  ProjectCreateInputSchema,
  ProjectIncomeInputSchema,
  TierSummarySchema,
  ProjectSummarySchema,
  ProjectKindSchema,
  FundingTierSchema,
  FundingStatusSchema,
  ProjectStatusSchema
} from '../index';

describe('Shared Schemas - Pack 1', () => {
  describe('PocketCategorySchema', () => {
    it('accepts housing and family (Batch 2 category expansion)', () => {
      expect(PocketCategorySchema.parse('housing')).toBe('housing');
      expect(PocketCategorySchema.parse('family')).toBe('family');
      expect(PocketCategorySchema.parse('education')).toBe('education');
    });

    it('accepts MSME business categories (Phase 1 MSME expansion)', () => {
      expect(PocketCategorySchema.parse('rent')).toBe('rent');
      expect(PocketCategorySchema.parse('salary')).toBe('salary');
      expect(PocketCategorySchema.parse('stock')).toBe('stock');
      expect(PocketCategorySchema.parse('supplier')).toBe('supplier');
      expect(PocketCategorySchema.parse('marketing')).toBe('marketing');
    });

    it('rejects unknown categories', () => {
      expect(() => PocketCategorySchema.parse('invalid_category')).toThrow();
    });
  });

  describe('UserSchema', () => {
    it('validates a correct user', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'test@example.com',
        fullName: 'Test User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(() => UserSchema.parse(user)).not.toThrow();
    });

    it('rejects invalid email', () => {
      const user = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'invalid-email',
        fullName: 'Test User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(() => UserSchema.parse(user)).toThrow();
    });
  });

  describe('PocketSchema', () => {
    it('validates a correct pocket', () => {
      const pocket = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        planId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Food & Groceries',
        kind: 'spendable' as const,
        category: 'food' as const,
        isTimeLocked: false,
        monthlyAllocation: 5000,
        dailyCap: 250,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(() => PocketSchema.parse(pocket)).not.toThrow();
    });

    it('validates a savings pocket with time lock', () => {
      const pocket = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        planId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Savings',
        kind: 'savings' as const,
        isTimeLocked: true,
        lockUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyAllocation: 10000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(() => PocketSchema.parse(pocket)).not.toThrow();
    });

    it('validates a fixed expense pocket', () => {
      const pocket = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        planId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Rent & Bills',
        kind: 'fixed' as const,
        category: 'utilities' as const,
        isTimeLocked: false,
        monthlyAllocation: 18000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      expect(() => PocketSchema.parse(pocket)).not.toThrow();
    });
  });

  describe('PlanSchema', () => {
    it('validates a correct structured plan', () => {
      const plan = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'structured' as const,
        incomePattern: 'salaried' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };
      expect(() => PlanSchema.parse(plan)).not.toThrow();
    });

    it('validates a daily plan', () => {
      const plan = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'daily' as const,
        incomePattern: 'freelancer' as const,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
      };
      expect(() => PlanSchema.parse(plan)).not.toThrow();
    });

    it('validates a reassigned plan', () => {
      const plan = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        type: 'structured' as const,
        incomePattern: 'salaried' as const,
        status: 'reassigned' as const,
        createdAt: new Date().toISOString(),
        reassignedAt: new Date().toISOString(),
      };
      expect(() => PlanSchema.parse(plan)).not.toThrow();
    });
  });

  describe('TransactionSchema', () => {
    it('validates a credit transaction (allocation)', () => {
      const transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        pocketId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 5000, // positive for credit
        type: 'allocation' as const,
        createdAt: new Date().toISOString(),
      };
      expect(() => TransactionSchema.parse(transaction)).not.toThrow();
    });

    it('validates a debit transaction (spend)', () => {
      const transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        pocketId: '123e4567-e89b-12d3-a456-426614174001',
        amount: -500, // negative for debit
        type: 'spend' as const,
        merchant: 'Naivas Supermarket',
        category: 'grocery' as const,
        createdAt: new Date().toISOString(),
      };
      expect(() => TransactionSchema.parse(transaction)).not.toThrow();
    });

    it('validates a reallocation out transaction', () => {
      const transaction = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        pocketId: '123e4567-e89b-12d3-a456-426614174001',
        amount: -200, // negative for debit
        type: 'reallocation_out' as const,
        createdAt: new Date().toISOString(),
      };
      expect(() => TransactionSchema.parse(transaction)).not.toThrow();
    });
  });

  describe('ReallocationSchema', () => {
    it('validates a pending reallocation', () => {
      const reallocation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
        toPocketId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 500,
        reason: 'emergency' as const,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      };
      expect(() => ReallocationSchema.parse(reallocation)).not.toThrow();
    });

    it('validates a reallocation with cooling off', () => {
      const reallocation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
        toPocketId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 500,
        reason: 'unexpected_expense' as const,
        status: 'cooling_off' as const,
        coolingOffEndsAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      expect(() => ReallocationSchema.parse(reallocation)).not.toThrow();
    });

    it('validates a completed reallocation with discipline cost', () => {
      const reallocation = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
        toPocketId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 500,
        reason: 'priority_shift' as const,
        status: 'completed' as const,
        disciplineCost: 5,
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      expect(() => ReallocationSchema.parse(reallocation)).not.toThrow();
    });
  });

  describe('ReallocationInputSchema', () => {
    it('validates a well-formed create request', () => {
      const input = {
        fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
        toPocketId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 800,
        reason: 'unexpected_expense' as const,
      };
      expect(() => ReallocationInputSchema.parse(input)).not.toThrow();
    });

    it('rejects a non-positive amount', () => {
      const input = {
        fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
        toPocketId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 0,
        reason: 'other' as const,
      };
      expect(() => ReallocationInputSchema.parse(input)).toThrow();
    });

    it('rejects an invalid reason', () => {
      const input = {
        fromPocketId: '123e4567-e89b-12d3-a456-426614174001',
        toPocketId: '123e4567-e89b-12d3-a456-426614174002',
        amount: 800,
        reason: 'ran_out_early',
      };
      expect(() => ReallocationInputSchema.parse(input)).toThrow();
    });
  });

  describe('ReallocationCompleteInputSchema', () => {
    it('defaults skipCoolingOff to false when omitted', () => {
      const result = ReallocationCompleteInputSchema.parse({});
      expect(result.skipCoolingOff).toBe(false);
    });

    it('honors an explicit skipCoolingOff', () => {
      const result = ReallocationCompleteInputSchema.parse({ skipCoolingOff: true });
      expect(result.skipCoolingOff).toBe(true);
    });
  });

  describe('IncomeEventSchema', () => {
    it('validates an income event that triggers allocation', () => {
      const income = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 68000,
        source: 'Salary',
        label: 'Monthly salary',
        date: '2024-01-15',
        runAllocation: true,
        createdAt: new Date().toISOString(),
      };
      expect(() => IncomeEventSchema.parse(income)).not.toThrow();
    });

    it('validates an income event without allocation trigger', () => {
      const income = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        amount: 5000,
        source: 'Freelance',
        label: 'Side project payment',
        date: '2024-01-20',
        runAllocation: false,
        createdAt: new Date().toISOString(),
      };
      expect(() => IncomeEventSchema.parse(income)).not.toThrow();
    });
  });

  describe('Enums', () => {
    it('accepts valid plan types', () => {
      expect(() => PlanTypeSchema.parse('structured')).not.toThrow();
      expect(() => PlanTypeSchema.parse('daily')).not.toThrow();
    });

    it('rejects invalid plan types', () => {
      expect(() => PlanTypeSchema.parse('invalid')).toThrow();
    });

    it('accepts valid pocket kinds', () => {
      expect(() => PocketKindSchema.parse('savings')).not.toThrow();
      expect(() => PocketKindSchema.parse('fixed')).not.toThrow();
      expect(() => PocketKindSchema.parse('spendable')).not.toThrow();
    });

    it('rejects invalid pocket kinds', () => {
      expect(() => PocketKindSchema.parse('invalid')).toThrow();
    });
  });

  describe('MSME Project Schemas (Phase 3)', () => {
    describe('ProjectKindSchema', () => {
      it('accepts valid project kinds', () => {
        expect(() => ProjectKindSchema.parse('catering')).not.toThrow();
        expect(() => ProjectKindSchema.parse('wedding')).not.toThrow();
        expect(() => ProjectKindSchema.parse('contract')).not.toThrow();
        expect(() => ProjectKindSchema.parse('other')).not.toThrow();
      });

      it('rejects invalid project kinds', () => {
        expect(() => ProjectKindSchema.parse('invalid')).toThrow();
      });
    });

    describe('FundingTierSchema', () => {
      it('accepts the three required tiers', () => {
        expect(() => FundingTierSchema.parse('priorities')).not.toThrow();
        expect(() => FundingTierSchema.parse('needs')).not.toThrow();
        expect(() => FundingTierSchema.parse('wants')).not.toThrow();
      });

      it('rejects invalid tiers', () => {
        expect(() => FundingTierSchema.parse('emergency')).toThrow();
      });
    });

    describe('FundingStatusSchema', () => {
      it('accepts valid funding statuses', () => {
        expect(() => FundingStatusSchema.parse('in_progress')).not.toThrow();
        expect(() => FundingStatusSchema.parse('complete')).not.toThrow();
      });

      it('rejects invalid funding statuses', () => {
        expect(() => FundingStatusSchema.parse('pending')).toThrow();
      });
    });

    describe('ProjectStatusSchema', () => {
      it('accepts valid project statuses', () => {
        expect(() => ProjectStatusSchema.parse('draft')).not.toThrow();
        expect(() => ProjectStatusSchema.parse('active')).not.toThrow();
        expect(() => ProjectStatusSchema.parse('completed')).not.toThrow();
        expect(() => ProjectStatusSchema.parse('cancelled')).not.toThrow();
      });

      it('rejects invalid project statuses', () => {
        expect(() => ProjectStatusSchema.parse('pending')).toThrow();
      });
    });

    describe('ProjectCreateInputSchema', () => {
      it('validates a correct project creation input', () => {
        const input = {
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000,
          tiers: {
            priorities: 250000,
            needs: 150000,
            wants: 100000,
          },
        };
        expect(() => ProjectCreateInputSchema.parse(input)).not.toThrow();
      });

      it('rejects when tier targets do not sum to contract value', () => {
        const input = {
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000,
          tiers: {
            priorities: 250000,
            needs: 150000,
            wants: 50000, // Only sums to 450000
          },
        };
        expect(() => ProjectCreateInputSchema.parse(input)).toThrow();
      });

      it('allows small floating point tolerance for contract value matching', () => {
        const input = {
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000.005,
          tiers: {
            priorities: 250000,
            needs: 150000,
            wants: 100000, // Sums to 500000, within 0.01 tolerance
          },
        };
        expect(() => ProjectCreateInputSchema.parse(input)).not.toThrow();
      });

      it('rejects empty tier targets', () => {
        const input = {
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000,
          tiers: {
            priorities: 0,
            needs: 0,
            wants: 0,
          },
        };
        expect(() => ProjectCreateInputSchema.parse(input)).toThrow();
      });
    });

    describe('ProjectIncomeInputSchema', () => {
      it('validates a correct income input', () => {
        const input = {
          amount: 250000,
          source: 'Deposit',
          label: 'Initial payment',
          date: '2024-01-15',
        };
        expect(() => ProjectIncomeInputSchema.parse(input)).not.toThrow();
      });

      it('accepts income without label', () => {
        const input = {
          amount: 250000,
          source: 'Deposit',
          date: '2024-01-15',
        };
        expect(() => ProjectIncomeInputSchema.parse(input)).not.toThrow();
      });

      it('rejects invalid date format', () => {
        const input = {
          amount: 250000,
          source: 'Deposit',
          date: '2024-01-15T00:00:00Z', // ISO format, not date only
        };
        expect(() => ProjectIncomeInputSchema.parse(input)).toThrow();
      });

      it('rejects source that is too long', () => {
        const input = {
          amount: 250000,
          source: 'A'.repeat(101), // Exceeds 100 char limit
          date: '2024-01-15',
        };
        expect(() => ProjectIncomeInputSchema.parse(input)).toThrow();
      });
    });

    describe('TierSummarySchema', () => {
      it('validates a complete tier summary', () => {
        const summary = {
          id: '550e8400-e29b-41d4-a716-446655440001',
          tier: 'priorities' as const,
          sortOrder: 1,
          targetAmount: 250000,
          allocatedAmount: 250000,
          spentAmount: 180000,
          remainingCash: 70000,
          fundingStatus: 'complete' as const,
          fundingPercent: 100,
        };
        expect(() => TierSummarySchema.parse(summary)).not.toThrow();
      });

      it('validates in-progress tier', () => {
        const summary = {
          id: '550e8400-e29b-41d4-a716-446655440002',
          tier: 'needs' as const,
          sortOrder: 2,
          targetAmount: 150000,
          allocatedAmount: 100000,
          spentAmount: 50000,
          remainingCash: 50000,
          fundingStatus: 'in_progress' as const,
          fundingPercent: 66.67,
        };
        expect(() => TierSummarySchema.parse(summary)).not.toThrow();
      });
    });

    describe('ProjectSummarySchema', () => {
      it('validates a complete project summary', () => {
        const summary = {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000,
          status: 'active' as const,
          isActiveCascade: true,
          tiers: [
            {
              id: '550e8400-e29b-41d4-a716-446655440004',
              tier: 'priorities' as const,
              sortOrder: 1,
              targetAmount: 250000,
              allocatedAmount: 250000,
              spentAmount: 180000,
              remainingCash: 70000,
              fundingStatus: 'complete' as const,
              fundingPercent: 100,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440005',
              tier: 'needs' as const,
              sortOrder: 2,
              targetAmount: 150000,
              allocatedAmount: 100000,
              spentAmount: 50000,
              remainingCash: 50000,
              fundingStatus: 'in_progress' as const,
              fundingPercent: 66.67,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440006',
              tier: 'wants' as const,
              sortOrder: 3,
              targetAmount: 100000,
              allocatedAmount: 0,
              spentAmount: 0,
              remainingCash: 0,
              fundingStatus: 'in_progress' as const,
              fundingPercent: 0,
            },
          ],
          nextIncomeGoesTo: 'needs' as const,
          totalAllocated: 350000,
          totalSpent: 230000,
          totalRemaining: 120000,
          excessPending: null,
        };
        expect(() => ProjectSummarySchema.parse(summary)).not.toThrow();
      });

      it('validates completed project with all tiers funded', () => {
        const summary = {
          id: '550e8400-e29b-41d4-a716-446655440007',
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000,
          status: 'completed' as const,
          isActiveCascade: false,
          tiers: [
            {
              id: '550e8400-e29b-41d4-a716-446655440008',
              tier: 'priorities' as const,
              sortOrder: 1,
              targetAmount: 250000,
              allocatedAmount: 250000,
              spentAmount: 250000,
              remainingCash: 0,
              fundingStatus: 'complete' as const,
              fundingPercent: 100,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440009',
              tier: 'needs' as const,
              sortOrder: 2,
              targetAmount: 150000,
              allocatedAmount: 150000,
              spentAmount: 150000,
              remainingCash: 0,
              fundingStatus: 'complete' as const,
              fundingPercent: 100,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440010',
              tier: 'wants' as const,
              sortOrder: 3,
              targetAmount: 100000,
              allocatedAmount: 100000,
              spentAmount: 100000,
              remainingCash: 0,
              fundingStatus: 'complete' as const,
              fundingPercent: 100,
            },
          ],
          nextIncomeGoesTo: null,
          totalAllocated: 500000,
          totalSpent: 500000,
          totalRemaining: 0,
          excessPending: null,
        };
        expect(() => ProjectSummarySchema.parse(summary)).not.toThrow();
      });

      it('rejects if tiers array does not have exactly 3 elements', () => {
        const summary = {
          id: '550e8400-e29b-41d4-a716-446655440011',
          name: 'Catering Event',
          kind: 'catering' as const,
          contractValue: 500000,
          status: 'active' as const,
          isActiveCascade: true,
          tiers: [
            {
              id: '550e8400-e29b-41d4-a716-446655440012',
              tier: 'priorities' as const,
              sortOrder: 1,
              targetAmount: 250000,
              allocatedAmount: 250000,
              spentAmount: 180000,
              remainingCash: 70000,
              fundingStatus: 'complete' as const,
              fundingPercent: 100,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440013',
              tier: 'needs' as const,
              sortOrder: 2,
              targetAmount: 150000,
              allocatedAmount: 100000,
              spentAmount: 50000,
              remainingCash: 50000,
              fundingStatus: 'in_progress' as const,
              fundingPercent: 66.67,
            },
          ], // Only 2 tiers instead of 3
          nextIncomeGoesTo: 'needs' as const,
          totalAllocated: 350000,
          totalSpent: 230000,
          totalRemaining: 120000,
          excessPending: null,
        };
        expect(() => ProjectSummarySchema.parse(summary)).toThrow();
      });
    });
  });
});