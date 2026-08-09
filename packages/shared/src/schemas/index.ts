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

// Freelancer-only, self-reported estimate of how far apart payments usually
// land. Deliberately banded rather than an exact day count — freelancers
// rarely know "23 days" but can usually say "about every 2 weeks". Mapped to
// a day count in IncomeIntervalDaysByBand for use by the rules engine and
// RunwayService. 'irregular' has no reliable estimate at all and falls back
// to the same default as 'monthly' until real income history exists.
export const IncomeIntervalBandSchema = z.enum(['weekly', 'biweekly', 'monthly', 'irregular']);
export type IncomeIntervalBand = z.infer<typeof IncomeIntervalBandSchema>;

export const IncomeIntervalDaysByBand: Record<IncomeIntervalBand, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  irregular: 30,
};

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

export const FixedExpenseInputSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  dueDay: z.number().int().min(1).max(31),
  category: PocketCategorySchema,
});
export type FixedExpenseInput = z.infer<typeof FixedExpenseInputSchema>;

export const OnboardingInputSchema = z.object({
  incomePattern: IncomePatternSchema,
  spendingHabit: SpendingHabitSchema,
  incomeAmount: z.number().positive(),
  fixedTotal: z.number().nonnegative(),
  sourceCount: z.number().int().positive(),
  fixedExpenses: z.array(FixedExpenseInputSchema).optional(),
  // Required (validated in validateOnboardingInput, not here, so the error
  // message can be freelancer-specific) when incomePattern is 'freelancer'.
  // Ignored for 'salaried'/'mix'.
  incomeIntervalBand: IncomeIntervalBandSchema.optional(),
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
// Runway (freelancer adaptive daily budget) — see docs/FREELANCER_RUNWAY.md
// ============================================================================

export const RunwaySummarySchema = z.object({
  // False for salaried/mix or structured plans — runway only applies to
  // freelancer + daily plans. Callers should not render a runway UI when
  // this is false.
  applicable: z.boolean(),
  runwayDays: z.number().nonnegative().optional(),
  expectedIntervalDays: z.number().positive().optional(),
  daysSinceLastIncome: z.number().nonnegative().optional(),
  // 'estimate' = derived from the onboarding band, no income history yet.
  // 'historical' = derived from actual income_events gaps (>= 2 events).
  confidence: z.enum(['estimate', 'historical']).optional(),
});
export type RunwaySummary = z.infer<typeof RunwaySummarySchema>;

// ============================================================================
// Core Domain Schemas - Pack 1 Specification
// ============================================================================

export const UserSchema = z.object({
  id: z.string().uuid(), // Supabase Auth user id
  email: z.string().email().nullable().optional(), // absent for phone-OTP-only accounts
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
  // Freelancer-only. The onboarding band's day-count estimate, persisted so
  // RunwayService has a fallback before enough income_events history exists.
  // Null for salaried/mix plans.
  incomeIntervalDays: z.number().int().positive().nullable().optional(),
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

// Fields a user is allowed to change on their own pocket. Balances
// (monthlyAllocation), plan ownership (planId) and the savings time-lock are
// derived by the allocation engine / plan provisioning, never client-supplied.
export const PocketUpdateInputSchema = z
  .object({
    name: z.string().min(1).max(100),
    category: PocketCategorySchema,
    dailyCap: z.number().nonnegative(),
  })
  .partial()
  .strict();
export type PocketUpdateInput = z.infer<typeof PocketUpdateInputSchema>;

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

export const ReallocationInputSchema = z.object({
  fromPocketId: z.string().uuid(),
  toPocketId: z.string().uuid(),
  amount: z.number().positive(),
  reason: ReallocationReasonSchema,
});
export type ReallocationInput = z.infer<typeof ReallocationInputSchema>;

export const ReallocationCompleteInputSchema = z.object({
  skipCoolingOff: z.boolean().optional().default(false),
});
export type ReallocationCompleteInput = z.infer<typeof ReallocationCompleteInputSchema>;

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
  PocketUpdateInput: PocketUpdateInputSchema,
  FixedExpense: FixedExpenseSchema,
  IncomeEvent: IncomeEventSchema,
  Transaction: TransactionSchema,
  Reallocation: ReallocationSchema,
  ReallocationInput: ReallocationInputSchema,
  ReallocationCompleteInput: ReallocationCompleteInputSchema,
  MerchantClassification: MerchantClassificationSchema,
  BehaviorEvent: BehaviorEventSchema,
  DisciplineScore: DisciplineScoreSchema,
};