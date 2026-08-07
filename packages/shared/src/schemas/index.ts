import { z } from 'zod';

// ============================================================================
// Core Domain Enums - Pack 1 Specification
// ============================================================================

export const PlanTypeSchema = z.enum(['structured', 'daily']);
export type PlanType = z.infer<typeof PlanTypeSchema>;

export const PocketKindSchema = z.enum(['savings', 'fixed', 'spendable']);
export type PocketKind = z.infer<typeof PocketKindSchema>;

export const PocketCategorySchema = z.enum([
  'food',
  'transport',
  'leisure',
  'personal',
  'utilities',
  'healthcare',
  'education',
  'other',
]);
export type PocketCategory = z.infer<typeof PocketCategorySchema>;

export const IncomePatternSchema = z.enum(['salaried', 'freelancer', 'mix']);
export type IncomePattern = z.infer<typeof IncomePatternSchema>;

export const SpendingHabitSchema = z.enum(['tracker', 'week3', 'off_guard']);
export type SpendingHabit = z.infer<typeof SpendingHabitSchema>;

export const PlanNameSchema = z.enum([
  'Salaried — Structured',
  'Salaried — Daily Budget',
  'Freelancer — Structured',
  'Freelancer — Daily Budget',
]);
export type PlanName = z.infer<typeof PlanNameSchema>;

export const TransactionTypeSchema = z.enum([
  'allocation',
  'spend',
  'reallocation_in',
  'reallocation_out',
  'rollover',
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const ReallocationStatusSchema = z.enum([
  'pending',
  'cooling_off',
  'completed',
  'skipped',
]);
export type ReallocationStatus = z.infer<typeof ReallocationStatusSchema>;

export const ReallocationReasonSchema = z.enum([
  'emergency',
  'unexpected_expense',
  'income_change',
  'priority_shift',
  'other',
]);
export type ReallocationReason = z.infer<typeof ReallocationReasonSchema>;

export const MerchantCategorySchema = z.enum([
  'grocery',
  'landlord_rent',
  'utility',
  'transport',
  'healthcare',
  'education',
  'entertainment',
  'gambling_betting',
  'personal_care',
  'other',
  'unclassified',
]);
export type MerchantCategory = z.infer<typeof MerchantCategorySchema>;

export const PlanStatusSchema = z.enum(['active', 'inactive', 'reassigned']);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

// ============================================================================
// Onboarding Schemas - Pack 2 Specification
// ============================================================================

export const OnboardingInputSchema = z.object({
  incomePattern: IncomePatternSchema,
  spendingHabit: SpendingHabitSchema,
  incomeAmount: z.number().positive(),
  fixedTotal: z.number().nonnegative(),
  sourceCount: z.number().int().positive(),
});
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export const PlanAssignReasonSchema = z.object({
  rule: z.string(),
  reason: z.string(),
});
export type PlanAssignReason = z.infer<typeof PlanAssignReasonSchema>;

export const OnboardingAssignResultSchema = z.object({
  plan: PlanNameSchema,
  planType: PlanTypeSchema,
  incomePattern: IncomePatternSchema,
  reasons: z.array(PlanAssignReasonSchema),
  remainingAfterFixed: z.number(),
  savingsTarget: z.number(),
  spendableAmount: z.number(),
});
export type OnboardingAssignResult = z.infer<typeof OnboardingAssignResultSchema>;

export const OnboardingCommitResultSchema = z.object({
  planId: z.string().uuid(),
  pockets: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    kind: PocketKindSchema,
    category: PocketCategorySchema.optional(),
    monthlyAllocation: z.number().nonnegative(),
    dailyCap: z.number().nonnegative().optional(),
  })),
});
export type OnboardingCommitResult = z.infer<typeof OnboardingCommitResultSchema>;

// ============================================================================
// Core Domain Schemas - Pack 1 Specification
// ============================================================================

export const UserSchema = z.object({
  id: z.string().uuid(), // Supabase Auth user id
  email: z.string().email(),
  fullName: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const PlanSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: PlanTypeSchema, // 'structured' | 'daily'
  incomePattern: IncomePatternSchema, // 'salaried' | 'freelancer'
  status: PlanStatusSchema, // 'active' | 'inactive' | 'reassigned'
  createdAt: z.string().datetime(),
  reassignedAt: z.string().datetime().optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const PocketSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(), // per plan
  name: z.string(),
  kind: PocketKindSchema, // 'savings' | 'fixed' | 'spendable'
  category: PocketCategorySchema.optional(), // for spendable: 'food' | 'transport' | 'leisure' | …
  isTimeLocked: z.boolean().default(false),
  lockUntil: z.string().datetime().optional(),
  monthlyAllocation: z.number().nonnegative(),
  dailyCap: z.number().nonnegative().optional(), // for daily plans
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Pocket = z.infer<typeof PocketSchema>;

export const FixedExpenseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(), // per user
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  dueDay: z.number().int().min(1).max(31),
  category: PocketCategorySchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type FixedExpense = z.infer<typeof FixedExpenseSchema>;

export const IncomeEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().positive(),
  source: z.string().min(1).max(100),
  label: z.string().max(200),
  date: z.string().date(),
  runAllocation: z.boolean().default(true), // trigger allocation pass
  createdAt: z.string().datetime(),
});
export type IncomeEvent = z.infer<typeof IncomeEventSchema>;

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  pocketId: z.string().uuid(),
  amount: z.number(), // signed (positive for credit, negative for debit)
  type: TransactionTypeSchema, // 'allocation' | 'spend' | 'reallocation_in' | 'reallocation_out' | 'rollover'
  merchant: z.string().optional(), // nullable
  category: MerchantCategorySchema.optional(),
  createdAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const ReallocationSchema = z.object({
  id: z.string().uuid(),
  fromPocketId: z.string().uuid(),
  toPocketId: z.string().uuid(),
  amount: z.number().positive(),
  reason: ReallocationReasonSchema, // chip selection
  status: ReallocationStatusSchema, // 'pending' | 'cooling_off' | 'completed' | 'skipped'
  coolingOffEndsAt: z.string().datetime().optional(),
  disciplineCost: z.number().default(0),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Reallocation = z.infer<typeof ReallocationSchema>;

export const MerchantClassificationSchema = z.object({
  id: z.string().uuid(),
  recipientKey: z.string(), // e.g. till/paybill
  category: MerchantCategorySchema,
  remember: z.boolean().default(true), // remembered going forward
  createdAt: z.string().datetime(),
});
export type MerchantClassification = z.infer<typeof MerchantClassificationSchema>;

export const BehaviorEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(), // event type
  payload: z.record(z.unknown()), // jsonb
  createdAt: z.string().datetime(),
});
export type BehaviorEvent = z.infer<typeof BehaviorEventSchema>;

export const DisciplineScoreSchema = z.object({
  userId: z.string().uuid(),
  score: z.number().min(0).max(100),
  delta: z.number(),
  period: z.string(), // e.g. '2024-01', 'week-3'
  calculatedAt: z.string().datetime(),
});
export type DisciplineScore = z.infer<typeof DisciplineScoreSchema>;

// ============================================================================
// Export all schemas as a registry for easy importing
// ======================================================================================

export const schemas = {
  PlanType: PlanTypeSchema,
  PocketKind: PocketKindSchema,
  PocketCategory: PocketCategorySchema,
  IncomePattern: IncomePatternSchema,
  SpendingHabit: SpendingHabitSchema,
  PlanName: PlanNameSchema,
  TransactionType: TransactionTypeSchema,
  ReallocationStatus: ReallocationStatusSchema,
  ReallocationReason: ReallocationReasonSchema,
  MerchantCategory: MerchantCategorySchema,
  PlanStatus: PlanStatusSchema,
  OnboardingInput: OnboardingInputSchema,
  PlanAssignReason: PlanAssignReasonSchema,
  OnboardingAssignResult: OnboardingAssignResultSchema,
  OnboardingCommitResult: OnboardingCommitResultSchema,
  User: UserSchema,
  Plan: PlanSchema,
  Pocket: PocketSchema,
  FixedExpense: FixedExpenseSchema,
  IncomeEvent: IncomeEventSchema,
  Transaction: TransactionSchema,
  Reallocation: ReallocationSchema,
  MerchantClassification: MerchantClassificationSchema,
  BehaviorEvent: BehaviorEventSchema,
  DisciplineScore: DisciplineScoreSchema,
};