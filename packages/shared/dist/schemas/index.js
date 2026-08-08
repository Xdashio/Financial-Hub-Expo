"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemas = exports.DisciplineScoreSchema = exports.BehaviorEventSchema = exports.MerchantClassificationSchema = exports.ReallocationCompleteInputSchema = exports.ReallocationInputSchema = exports.ReallocationSchema = exports.TransactionSchema = exports.IncomeEventSchema = exports.FixedExpenseSchema = exports.PocketSchema = exports.PlanSchema = exports.UserSchema = exports.OnboardingCommitResultSchema = exports.OnboardingAssignResultSchema = exports.PlanAssignReasonSchema = exports.OnboardingInputSchema = exports.FixedExpenseInputSchema = exports.PlanStatusSchema = exports.MerchantCategorySchema = exports.ReallocationReasonSchema = exports.ReallocationStatusSchema = exports.TransactionTypeSchema = exports.PlanNameSchema = exports.SpendingHabitSchema = exports.IncomePatternSchema = exports.PocketCategorySchema = exports.PocketKindSchema = exports.PlanTypeSchema = void 0;
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
    'other',
]);
exports.IncomePatternSchema = zod_1.z.enum(['salaried', 'freelancer', 'mix']);
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
});
exports.PlanAssignReasonSchema = zod_1.z.object({
    rule: zod_1.z.string(),
    reason: zod_1.z.string(),
});
exports.OnboardingAssignResultSchema = zod_1.z.object({
    plan: exports.PlanNameSchema,
    planType: exports.PlanTypeSchema,
    incomePattern: exports.IncomePatternSchema,
    reasons: zod_1.z.array(exports.PlanAssignReasonSchema),
    remainingAfterFixed: zod_1.z.number(),
    savingsTarget: zod_1.z.number(),
    spendableAmount: zod_1.z.number(),
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
    User: exports.UserSchema,
    Plan: exports.PlanSchema,
    Pocket: exports.PocketSchema,
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
