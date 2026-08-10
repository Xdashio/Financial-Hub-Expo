"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = exports.DisciplineScoreSchema = exports.BehaviorEventSchema = exports.MerchantClassificationSchema = exports.ReallocationCompleteInputSchema = exports.ReallocationInputSchema = exports.ReallocationSchema = exports.TransactionSchema = exports.IncomeEventSchema = exports.FixedExpenseSchema = exports.PocketUpdateInputSchema = exports.PocketSchema = exports.PlanSchema = exports.UserSchema = exports.RunwaySummarySchema = exports.RetakeEligibilitySchema = exports.PlanRetakeResultSchema = exports.PlanRedistributionSchema = exports.RedistributionMovementSchema = exports.RedistributionReasonSchema = exports.OnboardingCommitResultSchema = exports.OnboardingAssignResultSchema = exports.PlanAssignReasonSchema = exports.OnboardingInputSchema = exports.FixedExpenseInputSchema = exports.NeedsBandSchema = exports.MoneyPersonalitySchema = exports.EmergencyBufferSchema = exports.LifeStageSchema = exports.PlanStatusSchema = exports.MerchantCategorySchema = exports.ReallocationReasonSchema = exports.ReallocationStatusSchema = exports.TransactionTypeSchema = exports.PlanNameSchema = exports.SpendingHabitSchema = exports.IncomeIntervalDaysByBand = exports.IncomeIntervalBandSchema = exports.IncomePatternSchema = exports.PocketCategorySchema = exports.PocketKindSchema = exports.PlanTypeSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Core Domain Enums - Pack 1 Specification
// ============================================================================
exports.PlanTypeSchema = zod_1.z.enum(['structured', 'daily']);
exports.PocketKindSchema = zod_1.z.enum(['savings', 'fixed', 'spendable']);
exports.PocketCategorySchema = zod_1.z.enum([
    'food',
    'transport',
    'leisure',
    'personal',
    'utilities',
    'healthcare',
    'education',
    'housing',
    'family',
    'other',
]);
exports.IncomePatternSchema = zod_1.z.enum(['salaried', 'freelancer', 'mix']);
// Freelancer-only, self-reported estimate of how far apart payments usually
// land. Deliberately banded rather than an exact day count — freelancers
// rarely know "23 days" but can usually say "about every 2 weeks". Mapped to
// a day count in IncomeIntervalDaysByBand for use by the rules engine and
// RunwayService. 'irregular' has no reliable estimate at all and falls back
// to the same default as 'monthly' until real income history exists.
exports.IncomeIntervalBandSchema = zod_1.z.enum(['weekly', 'biweekly', 'monthly', 'irregular']);
exports.IncomeIntervalDaysByBand = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    irregular: 30,
};
exports.SpendingHabitSchema = zod_1.z.enum(['tracker', 'week3', 'off_guard']);
exports.PlanNameSchema = zod_1.z.enum([
    'Salaried — Structured',
    'Salaried — Daily Budget',
    'Freelancer — Structured',
    'Freelancer — Daily Budget',
]);
exports.TransactionTypeSchema = zod_1.z.enum([
    'allocation',
    'spend',
    'reallocation_in',
    'reallocation_out',
    'rollover',
]);
exports.ReallocationStatusSchema = zod_1.z.enum([
    'pending',
    'cooling_off',
    'completed',
    'skipped',
]);
exports.ReallocationReasonSchema = zod_1.z.enum([
    'emergency',
    'unexpected_expense',
    'income_change',
    'priority_shift',
    'other',
]);
exports.MerchantCategorySchema = zod_1.z.enum([
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
exports.PlanStatusSchema = zod_1.z.enum(['active', 'inactive', 'reassigned']);
// ============================================================================
// Onboarding Schemas - Pack 2 Specification
// ============================================================================
exports.LifeStageSchema = zod_1.z.enum(['student', 'working_adult', 'self_employed']);
exports.EmergencyBufferSchema = zod_1.z.enum([
    'none',
    'under_month',
    '1_to_3_months',
    '3_plus_months',
]);
/** Behavioral self-check — modifier layer, not a plan-type driver (§2.3). */
exports.MoneyPersonalitySchema = zod_1.z.enum(['spender', 'saver', 'avoider']);
exports.NeedsBandSchema = zod_1.z.enum(['high', 'mid', 'low']);
exports.FixedExpenseInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    amount: zod_1.z.number().positive(),
    dueDay: zod_1.z.number().int().min(1).max(31),
    category: exports.PocketCategorySchema,
});
exports.OnboardingInputSchema = zod_1.z.object({
    incomePattern: exports.IncomePatternSchema,
    spendingHabit: exports.SpendingHabitSchema,
    incomeAmount: zod_1.z.number().positive(),
    fixedTotal: zod_1.z.number().nonnegative(),
    sourceCount: zod_1.z.number().int().positive(),
    fixedExpenses: zod_1.z.array(exports.FixedExpenseInputSchema).optional(),
    // Required (validated in validateOnboardingInput, not here, so the error
    // message can be freelancer-specific) when incomePattern is 'freelancer'.
    // Ignored for 'salaried'/'mix'.
    incomeIntervalBand: exports.IncomeIntervalBandSchema.optional(),
    // Persona / deeper onboarding (Batches 3–4). Optional so older clients
    // keep working; provisioner + rules engine apply safe defaults.
    lifeStage: exports.LifeStageSchema.optional(),
    hasDependents: zod_1.z.boolean().optional(),
    emergencyBuffer: exports.EmergencyBufferSchema.optional(),
    moneyPersonality: exports.MoneyPersonalitySchema.optional(),
});
exports.PlanAssignReasonSchema = zod_1.z.object({
    rule: zod_1.z.string(),
    reason: zod_1.z.string(),
    // Numeric context for "why this plan" templates (§2.6).
    needsRatio: zod_1.z.number().nonnegative().optional(),
    needsBand: exports.NeedsBandSchema.optional(),
});
exports.OnboardingAssignResultSchema = zod_1.z.object({
    plan: exports.PlanNameSchema,
    planType: exports.PlanTypeSchema,
    incomePattern: exports.IncomePatternSchema,
    reasons: zod_1.z.array(exports.PlanAssignReasonSchema),
    remainingAfterFixed: zod_1.z.number(),
    savingsTarget: zod_1.z.number(),
    spendableAmount: zod_1.z.number(),
    needsRatio: zod_1.z.number().nonnegative(),
    needsBand: exports.NeedsBandSchema,
});
exports.OnboardingCommitResultSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
    pockets: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        kind: exports.PocketKindSchema,
        category: exports.PocketCategorySchema.optional(),
        monthlyAllocation: zod_1.z.number().nonnegative(),
        dailyCap: zod_1.z.number().nonnegative().optional(),
    })),
});
/** Why a balance moved from an old pocket to a new one during plan retake. */
exports.RedistributionReasonSchema = zod_1.z.enum([
    'category_match',
    'kind_match',
    'proportional',
    'spillover',
]);
exports.RedistributionMovementSchema = zod_1.z.object({
    fromPocketName: zod_1.z.string(),
    toPocketName: zod_1.z.string(),
    amount: zod_1.z.number().nonnegative(),
    reason: exports.RedistributionReasonSchema,
});
exports.PlanRedistributionSchema = zod_1.z.object({
    totalMoved: zod_1.z.number().nonnegative(),
    movements: zod_1.z.array(exports.RedistributionMovementSchema),
    previousPlanType: exports.PlanTypeSchema,
    newPlanType: exports.PlanTypeSchema,
    nextRetakeAvailableOn: zod_1.z.string(), // ISO date (YYYY-MM-DD) — first day of next UTC month
});
/** Result of POST /profile/plan/retake — commit shape plus money-migration summary. */
exports.PlanRetakeResultSchema = exports.OnboardingCommitResultSchema.extend({
    redistribution: exports.PlanRedistributionSchema,
});
/** GET /profile/plan/retake-eligibility — gates the Profile retake CTA. */
exports.RetakeEligibilitySchema = zod_1.z.object({
    allowed: zod_1.z.boolean(),
    nextRetakeAvailableOn: zod_1.z.string().nullable(),
    lastRetakenAt: zod_1.z.string().nullable(),
    message: zod_1.z.string().optional(),
});
// ============================================================================
// Runway (freelancer adaptive daily budget) — see docs/FREELANCER_RUNWAY.md
// ============================================================================
exports.RunwaySummarySchema = zod_1.z.object({
    // False for salaried/mix or structured plans — runway only applies to
    // freelancer + daily plans. Callers should not render a runway UI when
    // this is false.
    applicable: zod_1.z.boolean(),
    runwayDays: zod_1.z.number().nonnegative().optional(),
    expectedIntervalDays: zod_1.z.number().positive().optional(),
    daysSinceLastIncome: zod_1.z.number().nonnegative().optional(),
    // 'estimate' = derived from the onboarding band, no income history yet.
    // 'historical' = derived from actual income_events gaps (>= 2 events).
    confidence: zod_1.z.enum(['estimate', 'historical']).optional(),
});
// ============================================================================
// Core Domain Schemas - Pack 1 Specification
// ============================================================================
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(), // Supabase Auth user id
    email: zod_1.z.string().email().nullable().optional(), // absent for phone-OTP-only accounts
    fullName: zod_1.z.string().min(1).max(100),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.PlanSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    type: exports.PlanTypeSchema, // 'structured' | 'daily'
    incomePattern: exports.IncomePatternSchema, // 'salaried' | 'freelancer'
    // Freelancer-only. The onboarding band's day-count estimate, persisted so
    // RunwayService has a fallback before enough income_events history exists.
    // Null for salaried/mix plans.
    incomeIntervalDays: zod_1.z.number().int().positive().nullable().optional(),
    status: exports.PlanStatusSchema, // 'active' | 'inactive' | 'reassigned'
    createdAt: zod_1.z.string().datetime(),
    reassignedAt: zod_1.z.string().datetime().optional(),
});
exports.PocketSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(), // per plan
    name: zod_1.z.string(),
    kind: exports.PocketKindSchema, // 'savings' | 'fixed' | 'spendable'
    category: exports.PocketCategorySchema.optional(), // for spendable: 'food' | 'transport' | 'leisure' | …
    isTimeLocked: zod_1.z.boolean().default(false),
    lockUntil: zod_1.z.string().datetime().optional(),
    monthlyAllocation: zod_1.z.number().nonnegative(),
    dailyCap: zod_1.z.number().nonnegative().optional(), // for daily plans
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// Fields a user is allowed to change on their own pocket. Balances
// (monthlyAllocation), plan ownership (planId) and the savings time-lock are
// derived by the allocation engine / plan provisioning, never client-supplied.
exports.PocketUpdateInputSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.PocketCategorySchema,
    dailyCap: zod_1.z.number().nonnegative(),
})
    .partial()
    .strict();
exports.FixedExpenseSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(), // per user
    name: zod_1.z.string().min(1).max(100),
    amount: zod_1.z.number().positive(),
    dueDay: zod_1.z.number().int().min(1).max(31),
    category: exports.PocketCategorySchema,
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.IncomeEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    source: zod_1.z.string().min(1).max(100),
    label: zod_1.z.string().max(200),
    date: zod_1.z.string().date(),
    runAllocation: zod_1.z.boolean().default(true), // trigger allocation pass
    createdAt: zod_1.z.string().datetime(),
});
exports.TransactionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    pocketId: zod_1.z.string().uuid(),
    amount: zod_1.z.number(), // signed (positive for credit, negative for debit)
    type: exports.TransactionTypeSchema, // 'allocation' | 'spend' | 'reallocation_in' | 'reallocation_out' | 'rollover'
    merchant: zod_1.z.string().optional(), // nullable
    category: exports.MerchantCategorySchema.optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.ReallocationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    fromPocketId: zod_1.z.string().uuid(),
    toPocketId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    reason: exports.ReallocationReasonSchema, // chip selection
    status: exports.ReallocationStatusSchema, // 'pending' | 'cooling_off' | 'completed' | 'skipped'
    coolingOffEndsAt: zod_1.z.string().datetime().optional(),
    disciplineCost: zod_1.z.number().default(0),
    createdAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().optional(),
});
exports.ReallocationInputSchema = zod_1.z.object({
    fromPocketId: zod_1.z.string().uuid(),
    toPocketId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    reason: exports.ReallocationReasonSchema,
});
exports.ReallocationCompleteInputSchema = zod_1.z.object({
    skipCoolingOff: zod_1.z.boolean().optional().default(false),
});
exports.MerchantClassificationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    recipientKey: zod_1.z.string(), // e.g. till/paybill
    category: exports.MerchantCategorySchema,
    remember: zod_1.z.boolean().default(true), // remembered going forward
    createdAt: zod_1.z.string().datetime(),
});
exports.BehaviorEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    type: zod_1.z.string(), // event type
    payload: zod_1.z.record(zod_1.z.unknown()), // jsonb
    createdAt: zod_1.z.string().datetime(),
});
exports.DisciplineScoreSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    score: zod_1.z.number().min(0).max(100),
    delta: zod_1.z.number(),
    period: zod_1.z.string(), // e.g. '2024-01', 'week-3'
    calculatedAt: zod_1.z.string().datetime(),
});
// ============================================================================
// Export all schemas as a registry for easy importing
// ======================================================================================
exports.schemas = {
    PlanType: exports.PlanTypeSchema,
    PocketKind: exports.PocketKindSchema,
    PocketCategory: exports.PocketCategorySchema,
    IncomePattern: exports.IncomePatternSchema,
    SpendingHabit: exports.SpendingHabitSchema,
    LifeStage: exports.LifeStageSchema,
    EmergencyBuffer: exports.EmergencyBufferSchema,
    MoneyPersonality: exports.MoneyPersonalitySchema,
    NeedsBand: exports.NeedsBandSchema,
    PlanName: exports.PlanNameSchema,
    TransactionType: exports.TransactionTypeSchema,
    ReallocationStatus: exports.ReallocationStatusSchema,
    ReallocationReason: exports.ReallocationReasonSchema,
    MerchantCategory: exports.MerchantCategorySchema,
    PlanStatus: exports.PlanStatusSchema,
    OnboardingInput: exports.OnboardingInputSchema,
    PlanAssignReason: exports.PlanAssignReasonSchema,
    OnboardingAssignResult: exports.OnboardingAssignResultSchema,
    OnboardingCommitResult: exports.OnboardingCommitResultSchema,
    PlanRetakeResult: exports.PlanRetakeResultSchema,
    RetakeEligibility: exports.RetakeEligibilitySchema,
    User: exports.UserSchema,
    Plan: exports.PlanSchema,
    Pocket: exports.PocketSchema,
    PocketUpdateInput: exports.PocketUpdateInputSchema,
    FixedExpense: exports.FixedExpenseSchema,
    IncomeEvent: exports.IncomeEventSchema,
    Transaction: exports.TransactionSchema,
    Reallocation: exports.ReallocationSchema,
    ReallocationInput: exports.ReallocationInputSchema,
    ReallocationCompleteInput: exports.ReallocationCompleteInputSchema,
    MerchantClassification: exports.MerchantClassificationSchema,
    BehaviorEvent: exports.BehaviorEventSchema,
    DisciplineScore: exports.DisciplineScoreSchema,
};
