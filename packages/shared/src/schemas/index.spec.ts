import { 
  UserSchema, 
  PocketSchema, 
  PlanSchema, 
  PocketKindSchema, 
  PlanTypeSchema,
  TransactionSchema,
  ReallocationSchema,
  IncomeEventSchema
} from '../index';

describe('Shared Schemas - Pack 1', () => {
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
});