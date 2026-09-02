"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcessPromptTargetSchema = exports.ExcessPromptStatusSchema = exports.MsmeProjectSpendSchema = exports.MsmeProjectAllocationSchema = exports.MsmeProjectIncomeEventSchema = exports.MsmeProjectTierSchema = exports.MsmeProjectSchema = exports.ProjectSummarySchema = exports.SpendingControlsSchema = exports.TierSummarySchema = exports.ProjectIncomeInputSchema = exports.ProjectCreateInputSchema = exports.ProjectStatusSchema = exports.FundingStatusSchema = exports.FundingTierSchema = exports.ProjectKindSchema = exports.MsmeOnboardingInputSchema = exports.MsmePocketInputSchema = exports.BusinessStageSchema = exports.OnboardingInputSchema = exports.FixedExpenseInputSchema = exports.SavingsGoalInputSchema = exports.SavingsGoalLockDays = exports.SavingsGoalTimeframeMonths = exports.SavingsGoalTimeframeSchema = exports.SavingsGoalTypeSchema = exports.CategoryPercentagesSchema = exports.SPENDABLE_CATEGORY_LABELS = exports.MSME_SPENDABLE_LABELS = exports.SpendableCategorySchema = exports.NeedsBandSchema = exports.MoneyPersonalitySchema = exports.EmergencyBufferSchema = exports.LifeStageSchema = exports.PlanStatusSchema = exports.MerchantCategorySchema = exports.ReallocationReasonSchema = exports.ReallocationStatusSchema = exports.TransactionTypeSchema = exports.IncomeConcentrationSchema = exports.PlanNameSchema = exports.SpendingHabitSchema = exports.IncomeIntervalDaysByBand = exports.IncomeIntervalBandSchema = exports.IncomePatternSchema = exports.PocketCategorySchema = exports.BusinessPocketCategorySchema = exports.PocketKindSchema = exports.SegmentSchema = exports.PlanTypeSchema = void 0;
exports.LoanCreateInputSchema = exports.RepaymentScheduleSchema = exports.RepaymentCadenceSchema = exports.EmergencyUnlockResponseSchema = exports.EmergencyUnlockAllocationSchema = exports.EmergencyUnlockRequestSchema = exports.EmergencyUnlockEligibilityResponseSchema = exports.DiscretionaryRunwaySchema = exports.SpendingAnalysisSchema = exports.RunwayImpactOptionSchema = exports.EmergencyUnlockEligibilityReasonSchema = exports.SubPocketRebalanceInputSchema = exports.SubPocketCreateInputSchema = exports.PocketUpdateInputSchema = exports.PocketSchema = exports.PlanSchema = exports.UserSchema = exports.RunwaySummarySchema = exports.RetakeEligibilitySchema = exports.PlanRetakeResultSchema = exports.PlanRedistributionSchema = exports.RedistributionMovementSchema = exports.RedistributionReasonSchema = exports.OnboardingCommitResultSchema = exports.PlanPreviewResultSchema = exports.CategoryAllocationPreviewSchema = exports.OnboardingAssignResultSchema = exports.PlanAssignReasonSchema = exports.StockMovementSchema = exports.StockItemSchema = exports.StockMovementCreateInputSchema = exports.StockMovementTypeSchema = exports.StockItemUpdateInputSchema = exports.StockItemCreateInputSchema = exports.MsmeOperationalInsightsSchema = exports.MsmeAlertSchema = exports.MsmeProjectStatsSchema = exports.MsmeInvoiceStatsSchema = exports.InvoiceSchema = exports.InvoiceUpdateInputSchema = exports.InvoiceCreateInputSchema = exports.KraPinSchema = exports.EtimsStatusSchema = exports.InvoiceStatusSchema = exports.ProjectSpendInputSchema = exports.ProjectCompletionResolveInputSchema = exports.ProjectCompleteResultSchema = exports.SpendControlsUpdateInputSchema = exports.ExcessResolveInputSchema = exports.MsmeProjectExcessPromptSchema = void 0;
exports.schemas = exports.DisciplineScoreSchema = exports.BehaviorEventSchema = exports.MerchantClassificationSchema = exports.ReallocationCompleteInputSchema = exports.ReallocationInputSchema = exports.ReallocationSchema = exports.DailyAllocationSchema = exports.TransactionSchema = exports.IncomeEventSchema = exports.FixedExpenseSchema = exports.LoanDetailSchema = exports.LoanPurposePocketInputSchema = exports.LoanUpdateInputSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Core Domain Enums - Pack 1 Specification
// ============================================================================
exports.PlanTypeSchema = zod_1.z.enum(['structured', 'daily']);
// Individual vs MSME account segment (ADR-001 / MSME_PHASED_BUILD_PLAN §5.1).
// A user can hold *two* active plans simultaneously — one per segment — so
// segment discriminates plan ownership, not the user.
exports.SegmentSchema = zod_1.z.enum(['individual', 'msme']);
exports.PocketKindSchema = zod_1.z.enum(['savings', 'fixed', 'spendable', 'loan']);
// MSME business pocket categories (ADR-001 D2 / MSME_PHASED_BUILD_PLAN §5.2).
// Kept separate from PocketCategorySchema so the Individual set stays
// untouched; they're merged at the union/PocketCategorySchema level.
exports.BusinessPocketCategorySchema = zod_1.z.enum([
    'stock',
    'supplier',
    'licence',
    'tax',
    'salary',
    'rent',
    'operations',
    'profit',
    'owner_draw',
    'growth',
    'marketing',
    'equipment',
]);
exports.PocketCategorySchema = zod_1.z.enum([
    // individual (existing, unchanged)
    'food',
    'transport',
    'leisure',
    'personal',
    'utilities',
    'healthcare',
    'education',
    'housing',
    'family',
    // msme additions (business semantics, spec §2–§10)
    'stock',
    'supplier',
    'licence',
    'tax',
    'salary',
    'rent',
    'operations',
    'profit',
    'owner_draw',
    'growth',
    'marketing',
    'equipment',
    // fallback
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
    // Freelancers only get daily budget plans - structured plans don't make sense
    // for irregular income. The runway calculation requires daily caps.
    'Freelancer — Daily Budget',
    // Income-concentration split within the 'freelancer' income pattern
    // (audit_team.md item 8, Batch 4 / ONBOARDING_AND_SCORING_REDESIGN.md
    // §2.1). Display-only — the underlying `IncomePattern` stored on the plan
    // and used by runway/rollover logic is still just 'freelancer'; 'Gig' is
    // a plan-name/reasons distinction, not a new stored income pattern.
    // Gig workers also only get daily budget plans.
    'Gig — Daily Budget',
    // Salaried-with-side-income persona (audit_team.md item 2 /
    // ONBOARDING_AND_SCORING_REDESIGN.md §2.1's other half, landed after the
    // gig split). Display-only, same posture as 'Gig' above — the stored
    // `IncomePattern` stays 'salaried' (the 'mix' onboarding answer already
    // resolves to 'salaried' for runway/rollover purposes), this only changes
    // the plan label/reasons/copy so a "stable base + side income" user isn't
    // shown identical plan naming to a single-employer salaried user.
    'Salaried + Side Income — Structured',
    'Salaried + Side Income — Daily Budget',
    // MSME / business segment plan (ADR-001 / MSME_PHASED_BUILD_PLAN §6.2).
    // Always structured — business cash flow is monthly, no daily caps.
    'Business — Structured',
]);
// Income-concentration signal within the 'freelancer' income pattern
// (audit_team.md item 8, Batch 4). Derived from `sourceCount`, already
// collected at onboarding: a handful of sources reads as gig/platform-style
// concentrated income (Bolt/Uber/delivery-app style — volatile day to day
// but with some payout-cadence predictability); several distinct sources
// reads as genuinely lumpy multi-client freelance income. Only meaningful
// when the resolved income pattern is 'freelancer' — undefined for
// salaried/mix.
exports.IncomeConcentrationSchema = zod_1.z.enum(['concentrated', 'diversified']);
exports.TransactionTypeSchema = zod_1.z.enum([
    'allocation',
    'spend',
    'reallocation_in',
    'reallocation_out',
    'rollover',
    'reserve_release',
    'reserve_return',
    'daily_overspend_debit',
    'fixed_expense_earmark',
    'fixed_expense_carry_forward',
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
// Spendable category pockets a user can rebalance at onboarding time (§3 of
// audit_team.md item 3). Deliberately narrower than PocketCategorySchema —
// only the categories the spendable-pocket provisioner ever creates.
exports.SpendableCategorySchema = zod_1.z.enum(['food', 'transport', 'leisure', 'family']);
/**
 * User-friendly labels for spendable categories.
 * These are the only categories that can appear for spendable pockets
 * (see pocket-provisioning.ts). Other categories like 'grocery', 'healthcare',
 * etc. are merchant classification categories, not spendable pocket categories.
 */
exports.MSME_SPENDABLE_LABELS = {
    stock: 'Stock & Inventory',
    supplier: 'Suppliers',
    licence: 'Licences',
    tax: 'Taxes',
    salary: 'Salaries & Wages',
    rent: 'Rent',
    operations: 'Operations',
    profit: 'Profit',
    owner_draw: 'Owner Draw',
    growth: 'Growth',
    marketing: 'Marketing',
    equipment: 'Equipment',
};
exports.SPENDABLE_CATEGORY_LABELS = {
    food: 'Food & Groceries',
    transport: 'Transport',
    leisure: 'Personal & Leisure',
    family: 'Family & Dependents',
    // MSME business labels (MSME_PHASED_BUILD_PLAN §5.2) — spread from the
    // single source of truth so the two label maps stay in lockstep.
    ...exports.MSME_SPENDABLE_LABELS,
};
// Partial map of category -> percentage (0-100) of the spendable amount.
// Partial because which categories exist depends on persona (student gets
// only 'leisure'; dependents add 'family') — the server resolves which keys
// are expected and rejects a mismatched set rather than the schema trying to
// enforce that here.
exports.CategoryPercentagesSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.number().min(0).max(100));
// ----------------------------------------------------------------------------
// Goal-driven savings (ONBOARDING_AND_SCORING_REDESIGN.md Part 4). Replaces
// the flat-rate-for-everyone savings model with an optional captured goal —
// what, roughly how much, roughly by when — that the rules engine derives a
// savings rate and lock length from (see rules-engine.ts's
// calculateSavingsTarget). Entirely optional: skipping this step falls back
// to the existing buffer-based rate with no goal-shortfall messaging.
// ----------------------------------------------------------------------------
exports.SavingsGoalTypeSchema = zod_1.z.enum([
    'emergency_fund',
    'purchase',
    'dependent_education',
    'other',
]);
// Timeframe band, not an exact date — same honesty-over-precision reasoning
// as IncomeIntervalBandSchema for freelancers (§4.1: "target date or a
// rough timeframe band ... exact dates are unreliable, bands are honest").
exports.SavingsGoalTimeframeSchema = zod_1.z.enum([
    '3_months',
    '6_months',
    '1_year',
    '2_plus_years',
]);
// Months-to-target used by the derived-rate calculation. '2_plus_years' is
// open-ended by definition — 24 is treated as a conservative floor (a
// longer real timeframe only makes the derived rate easier to hit, never
// harder), not a claim that the goal is exactly 2 years out.
exports.SavingsGoalTimeframeMonths = {
    '3_months': 3,
    '6_months': 6,
    '1_year': 12,
    '2_plus_years': 24,
};
// Savings-pocket lock length (days), matched to how far out the goal is
// (§4.2: "lock length becomes goal-derived too"). Shorter-horizon goals
// (e.g. an emergency buffer) get shorter lock cycles than a multi-year goal
// so the lock cadence doesn't feel arbitrary relative to what it's guarding.
exports.SavingsGoalLockDays = {
    '3_months': 30,
    '6_months': 60,
    '1_year': 90,
    '2_plus_years': 90,
};
exports.SavingsGoalInputSchema = zod_1.z.object({
    goalType: exports.SavingsGoalTypeSchema,
    // Free-text personalization (e.g. "Amara's school fees"), same posture as
    // fixed-expense names already stored today — deliberately not a separate
    // structured dependent-name/relationship field, to avoid introducing a
    // new PII category beyond what the app already handles (open question 5
    // in ONBOARDING_AND_SCORING_REDESIGN.md).
    goalLabel: zod_1.z.string().min(1).max(60).optional(),
    goalAmount: zod_1.z.number().positive().optional(),
    goalTimeframe: exports.SavingsGoalTimeframeSchema,
});
exports.FixedExpenseInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    amount: zod_1.z.number().positive(),
    dueDay: zod_1.z.number().int().min(1).max(31),
    category: exports.PocketCategorySchema,
    frequency: zod_1.z.enum(['monthly', 'weekly', 'daily']).optional(),
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
    // Tri-state, same shape as `hasDependents`: does this person regularly
    // spend money on transport/commuting? Left undefined when unasked/unknown
    // (treated as "normal" transport need — today's default even weighting).
    // Explicit `false` is the remote-worker signal from
    // ONBOARDING_AND_SCORING_REDESIGN.md §2.5 ("no stated transport need") —
    // folds the transport category into a smaller share of the spendable
    // split instead of an even split, without removing the category outright
    // (a remote worker still occasionally takes transport).
    hasTransportNeed: zod_1.z.boolean().optional(),
    // Optional captured savings goal (Part 4) — see SavingsGoalInputSchema.
    // Omitted means "no stated goal": rules-engine falls back to the
    // existing buffer-based rate/default 30-day lock with no shortfall
    // messaging.
    savingsGoal: exports.SavingsGoalInputSchema.optional(),
    // User-adjusted split across spendable category pockets, set on the
    // onboarding result screen (item 3 of audit_team.md). Optional — omitted
    // means "use the rules engine's default weighting". When present, must
    // cover exactly the categories the persona resolves to and sum to 100
    // (server-validated in validateCategoryPercentages, not here, since the
    // expected key set depends on lifeStage/hasDependents).
    categoryPercentages: zod_1.z.record(zod_1.z.string(), zod_1.z.number().min(0).max(100)).optional(),
});
// ============================================================================
// MSME onboarding (§6.2) — the business-segment sibling of OnboardingInput.
// Deliberately separate: monthly revenue replaces incomeAmount (mapped to
// plans.expected_income_amount server-side) and customPockets (max 6, §2.2)
// lets a business name its own pockets instead of the individual persona set.
// ============================================================================
exports.BusinessStageSchema = zod_1.z.enum(['starting', 'stable', 'growing']);
exports.MsmePocketInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.PocketCategorySchema,
});
exports.MsmeOnboardingInputSchema = zod_1.z.object({
    segment: zod_1.z.literal('msme'),
    businessName: zod_1.z.string().min(1).max(100),
    // maps to plans.expected_income_amount (see commitMsme)
    monthlyRevenue: zod_1.z.number().positive(),
    // sum of recurring business obligations (rent, salaries, licences, taxes…)
    fixedTotal: zod_1.z.number().nonnegative(),
    fixedExpenses: zod_1.z.array(exports.FixedExpenseInputSchema).optional(),
    hasEmployees: zod_1.z.boolean().optional(),
    businessStage: exports.BusinessStageSchema.optional(),
    savingsGoal: exports.SavingsGoalInputSchema.optional(),
    // custom pocket names — max 6, validated server-side (§2.2)
    customPockets: zod_1.z.array(exports.MsmePocketInputSchema).max(6).optional(),
});
// ============================================================================
// MSME Project Funding (§6.3) — Funding Cascade Engine (Phase 3)
// ============================================================================
exports.ProjectKindSchema = zod_1.z.enum(['catering', 'wedding', 'trip', 'tour', 'contract', 'construction', 'agri', 'other']);
exports.FundingTierSchema = zod_1.z.enum(['priorities', 'needs', 'wants']); // exactly 3, §12:231
exports.FundingStatusSchema = zod_1.z.enum(['in_progress', 'complete']);
exports.ProjectStatusSchema = zod_1.z.enum(['draft', 'active', 'completed', 'cancelled']);
exports.ProjectCreateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    kind: exports.ProjectKindSchema,
    contractValue: zod_1.z.number().positive(),
    tiers: zod_1.z.object({
        priorities: zod_1.z.number().positive(), // target amounts
        needs: zod_1.z.number().positive(),
        wants: zod_1.z.number().positive(),
    }).refine(v => v.priorities + v.needs + v.wants > 0, { message: 'At least one tier target required' }),
    // optional: allow wants=0 for lean projects — service normalizes
}).refine(v => Math.abs((v.tiers.priorities + v.tiers.needs + v.tiers.wants) - v.contractValue) < 0.01, { message: 'Tier targets must sum to contract value', path: ['contractValue'] });
exports.ProjectIncomeInputSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    source: zod_1.z.string().min(1).max(100), // Deposit / Progress / Final
    label: zod_1.z.string().max(200).optional(),
    date: zod_1.z.string().date(),
});
exports.TierSummarySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tier: exports.FundingTierSchema,
    sortOrder: zod_1.z.number().int().min(1).max(3),
    targetAmount: zod_1.z.number().positive(),
    allocatedAmount: zod_1.z.number().nonnegative(),
    spentAmount: zod_1.z.number().nonnegative(),
    remainingCash: zod_1.z.number().nonnegative(), // allocated - spent
    fundingStatus: exports.FundingStatusSchema,
    fundingPercent: zod_1.z.number().min(0).max(100),
});
exports.SpendingControlsSchema = zod_1.z.object({
    lockWantsUntilPrioritiesAndNeedsFunded: zod_1.z.boolean().default(false),
    warnOnLowPrioritySpend: zod_1.z.boolean().default(false),
});
exports.ProjectSummarySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    kind: exports.ProjectKindSchema,
    contractValue: zod_1.z.number(),
    status: exports.ProjectStatusSchema,
    isActiveCascade: zod_1.z.boolean(),
    // Phase 5 spending controls (§20) — defaults mirror DB DEFAULT.
    spendingControls: exports.SpendingControlsSchema.optional(),
    completionResolvedAt: zod_1.z.string().datetime().nullable().optional(),
    completionResolvedTo: zod_1.z.enum(['savings', 'keep']).nullable().optional(),
    tiers: zod_1.z.array(exports.TierSummarySchema).length(3),
    nextIncomeGoesTo: exports.FundingTierSchema.nullable(), // null if all funded
    totalAllocated: zod_1.z.number(),
    totalSpent: zod_1.z.number(),
    totalRemaining: zod_1.z.number(),
    excessPending: zod_1.z.number().nullable(),
});
// ============================================================================
// MSME Project Database Table Schemas (Phase 3 - 017_msme_projects.sql)
// ============================================================================
exports.MsmeProjectSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100),
    kind: exports.ProjectKindSchema,
    contractValue: zod_1.z.number().positive(),
    status: exports.ProjectStatusSchema,
    isActiveCascade: zod_1.z.boolean(),
    spendingControls: exports.SpendingControlsSchema.optional(),
    completionResolvedAt: zod_1.z.string().datetime().nullable().optional(),
    completionResolvedTo: zod_1.z.enum(['savings', 'keep']).nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().nullable().optional(),
    cancelledAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.MsmeProjectTierSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    tier: exports.FundingTierSchema,
    sortOrder: zod_1.z.number().int().min(1).max(3),
    targetAmount: zod_1.z.number().positive(),
    allocatedAmount: zod_1.z.number().nonnegative(),
    spentAmount: zod_1.z.number().nonnegative(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.MsmeProjectIncomeEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    source: zod_1.z.string().min(1).max(100),
    label: zod_1.z.string().max(200).nullable().optional(),
    date: zod_1.z.string().date(),
    createdAt: zod_1.z.string().datetime(),
});
exports.MsmeProjectAllocationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    tierId: zod_1.z.string().uuid(),
    incomeEventId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    createdAt: zod_1.z.string().datetime(),
});
exports.MsmeProjectSpendSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tierId: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    merchant: zod_1.z.string().nullable().optional(),
    category: zod_1.z.string().nullable().optional(),
    note: zod_1.z.string().max(300).nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.ExcessPromptStatusSchema = zod_1.z.enum(['pending', 'resolved', 'dismissed']);
exports.ExcessPromptTargetSchema = zod_1.z.enum(['needs', 'wants', 'savings', 'keep']);
exports.MsmeProjectExcessPromptSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    projectId: zod_1.z.string().uuid(),
    incomeEventId: zod_1.z.string().uuid(),
    excessAmount: zod_1.z.number().positive(),
    chosenTarget: exports.ExcessPromptTargetSchema.nullable().optional(),
    status: exports.ExcessPromptStatusSchema,
    createdAt: zod_1.z.string().datetime(),
    resolvedAt: zod_1.z.string().datetime().nullable().optional(),
});
exports.ExcessResolveInputSchema = zod_1.z.object({
    chosenTarget: exports.ExcessPromptTargetSchema,
    // §21:525 — moving excess to Savings requires explicit second confirmation.
    confirmSavings: zod_1.z.boolean().optional(),
});
exports.SpendControlsUpdateInputSchema = exports.SpendingControlsSchema.partial();
exports.ProjectCompleteResultSchema = zod_1.z.object({
    project: exports.ProjectSummarySchema,
    remainingPerTier: zod_1.z.array(zod_1.z.object({
        tier: exports.FundingTierSchema,
        remainingCash: zod_1.z.number().nonnegative(),
        targetAmount: zod_1.z.number(),
        allocatedAmount: zod_1.z.number(),
    })),
    totalRemaining: zod_1.z.number().nonnegative(),
    suggestion: zod_1.z.string(),
    requiresResolution: zod_1.z.boolean(),
});
exports.ProjectCompletionResolveInputSchema = zod_1.z.object({
    target: zod_1.z.enum(['savings', 'keep']),
    confirmSavings: zod_1.z.boolean().optional(),
});
exports.ProjectSpendInputSchema = zod_1.z.object({
    tierId: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
    merchant: zod_1.z.string().min(1).max(100).optional(),
    category: zod_1.z.string().max(100).optional(),
    note: zod_1.z.string().max(300).optional(),
    // §20 — bypass Wants lock when user confirms risky spend.
    confirmRisky: zod_1.z.boolean().optional(),
});
// ============================================================================
// MSME Invoicing & Receivables (020_msme_invoices.sql) — eTIMS-ready
// ============================================================================
exports.InvoiceStatusSchema = zod_1.z.enum(['draft', 'sent', 'paid', 'void']);
exports.EtimsStatusSchema = zod_1.z.enum(['pending', 'submitted', 'accepted']);
// KRA PIN: A + 9 digits + A (e.g. P051234567A) — 11 chars, uppercase.
exports.KraPinSchema = zod_1.z.string().regex(/^[A-Z][0-9]{9}[A-Z]$/, {
    message: 'KRA PIN must be 11 characters: letter + 9 digits + letter (e.g. P051234567A)',
});
// Draft/sent invoice creation — amount >0, due_date is ISO date, pin optional but validated when present.
exports.InvoiceCreateInputSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(1).max(100),
    customerPin: exports.KraPinSchema.optional().nullable(),
    amount: zod_1.z.number().positive(),
    dueDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be YYYY-MM-DD' }),
    description: zod_1.z.string().max(200).optional().nullable(),
});
// PATCH /msme/invoices/:id — partial update; status transitions validated in service, not here.
exports.InvoiceUpdateInputSchema = zod_1.z.object({
    customerName: zod_1.z.string().min(1).max(100).optional(),
    customerPin: exports.KraPinSchema.optional().nullable(),
    amount: zod_1.z.number().positive().optional(),
    dueDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    description: zod_1.z.string().max(200).optional().nullable(),
    status: exports.InvoiceStatusSchema.optional(),
    etimsStatus: exports.EtimsStatusSchema.optional().nullable(),
});
exports.InvoiceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(),
    customerName: zod_1.z.string().min(1).max(100),
    customerPin: exports.KraPinSchema.nullable().optional(),
    amount: zod_1.z.number().positive(),
    dueDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: exports.InvoiceStatusSchema,
    description: zod_1.z.string().max(200).nullable().optional(),
    etimsStatus: exports.EtimsStatusSchema.nullable().optional(),
    paidAt: zod_1.z.string().datetime().nullable().optional(),
    voidedAt: zod_1.z.string().datetime().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    // Derived, not stored — overdue is dueDate < today AND status in draft/sent
    isOverdue: zod_1.z.boolean().optional(),
});
// ============================================================================
// MSME Operational Insights (Invoices + Projects) — real aggregates, no mocks
// ============================================================================
exports.MsmeInvoiceStatsSchema = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative(),
    draft: zod_1.z.number().int().nonnegative(),
    sent: zod_1.z.number().int().nonnegative(),
    paid: zod_1.z.number().int().nonnegative(),
    voidCount: zod_1.z.number().int().nonnegative(),
    overdue: zod_1.z.number().int().nonnegative(),
    outstanding: zod_1.z.number().nonnegative(),
    overdueAmount: zod_1.z.number().nonnegative(),
    paidAmount: zod_1.z.number().nonnegative(),
    collectionRate: zod_1.z.number().min(0).max(100),
});
exports.MsmeProjectStatsSchema = zod_1.z.object({
    total: zod_1.z.number().int().nonnegative(),
    active: zod_1.z.number().int().nonnegative(),
    draft: zod_1.z.number().int().nonnegative(),
    completed: zod_1.z.number().int().nonnegative(),
    totalContractValue: zod_1.z.number().nonnegative(),
    totalAllocated: zod_1.z.number().nonnegative(),
    totalSpent: zod_1.z.number().nonnegative(),
    fundingPercent: zod_1.z.number().min(0).max(100),
});
exports.MsmeAlertSchema = zod_1.z.object({
    type: zod_1.z.enum(['overdue_receivables', 'funding_stalled', 'wants_discipline', 'no_data']),
    message: zod_1.z.string(),
    severity: zod_1.z.enum(['info', 'warn', 'critical']),
});
exports.MsmeOperationalInsightsSchema = zod_1.z.object({
    invoices: exports.MsmeInvoiceStatsSchema,
    projects: exports.MsmeProjectStatsSchema,
    fundingVelocityDays: zod_1.z.number().nonnegative().nullable(),
    alerts: zod_1.z.array(exports.MsmeAlertSchema),
});
// ============================================================================
// MSME Stock & Inventory (021_msme_stock.sql)
// ============================================================================
exports.StockItemCreateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    sku: zod_1.z.string().min(1).max(30).optional().nullable(),
    qtyOnHand: zod_1.z.number().nonnegative().optional(),
    unitCost: zod_1.z.number().nonnegative(),
    unitPrice: zod_1.z.number().nonnegative(),
    lowStockThreshold: zod_1.z.number().nonnegative().optional(),
    location: zod_1.z.string().max(100).optional().nullable(),
});
exports.StockItemUpdateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    sku: zod_1.z.string().min(1).max(30).optional().nullable(),
    unitCost: zod_1.z.number().nonnegative().optional(),
    unitPrice: zod_1.z.number().nonnegative().optional(),
    lowStockThreshold: zod_1.z.number().nonnegative().optional(),
    location: zod_1.z.string().max(100).optional().nullable(),
});
exports.StockMovementTypeSchema = zod_1.z.enum(['in', 'out', 'adjust']);
exports.StockMovementCreateInputSchema = zod_1.z.object({
    type: exports.StockMovementTypeSchema,
    qty: zod_1.z.number().positive(),
    unitCost: zod_1.z.number().nonnegative().optional().nullable(),
    note: zod_1.z.string().max(200).optional().nullable(),
    pocketId: zod_1.z.string().uuid().optional().nullable(),
});
exports.StockItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(100),
    sku: zod_1.z.string().max(30).nullable().optional(),
    qtyOnHand: zod_1.z.number().nonnegative(),
    unitCost: zod_1.z.number().nonnegative(),
    unitPrice: zod_1.z.number().nonnegative(),
    lowStockThreshold: zod_1.z.number().nonnegative(),
    location: zod_1.z.string().max(100).nullable().optional(),
    isLowStock: zod_1.z.boolean().optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.StockMovementSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    itemId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    type: exports.StockMovementTypeSchema,
    qty: zod_1.z.number().positive(),
    unitCost: zod_1.z.number().nonnegative().nullable().optional(),
    totalCost: zod_1.z.number().nonnegative(),
    note: zod_1.z.string().max(200).nullable().optional(),
    pocketId: zod_1.z.string().uuid().nullable().optional(),
    createdAt: zod_1.z.string().datetime(),
});
exports.PlanAssignReasonSchema = zod_1.z.object({
    rule: zod_1.z.string(),
    reason: zod_1.z.string(),
    // Numeric context for "why this plan" templates (§2.6).
    needsRatio: zod_1.z.number().nonnegative().optional(),
    needsBand: exports.NeedsBandSchema.optional(),
    // Populated only on the 'savings_goal_capacity_shortfall' reason (§4.2):
    // the literal derived rate needed to hit the goal on time would exceed
    // the sane-share cap, so these carry the numbers the client renders as
    // "would take ~N months longer" / "would need ~X% of your spendable
    // income" instead of silently forcing or silently ignoring the goal.
    goalMonthsNeeded: zod_1.z.number().nonnegative().optional(),
    goalRequiredSharePercent: zod_1.z.number().nonnegative().optional(),
});
exports.OnboardingAssignResultSchema = zod_1.z.object({
    // Which segment this assignment targets (individual assign flows omit it;
    // MSME always sets 'msme' — see assignMsmePlan).
    segment: exports.SegmentSchema.optional(),
    plan: exports.PlanNameSchema,
    planType: exports.PlanTypeSchema,
    incomePattern: exports.IncomePatternSchema,
    // Set only when incomePattern resolves to 'freelancer' — see
    // IncomeConcentrationSchema. Undefined for salaried/mix.
    incomeConcentration: exports.IncomeConcentrationSchema.optional(),
    // Set only when the onboarding answer was 'mix' (stable base + irregular
    // side income) — audit_team.md item 2's salaried-with-side-income
    // persona. Undefined for pure 'salaried' and for 'freelancer'.
    hasSideIncome: zod_1.z.boolean().optional(),
    reasons: zod_1.z.array(exports.PlanAssignReasonSchema),
    remainingAfterFixed: zod_1.z.number(),
    savingsTarget: zod_1.z.number(),
    spendableAmount: zod_1.z.number(),
    needsRatio: zod_1.z.number().nonnegative(),
    needsBand: exports.NeedsBandSchema,
});
exports.CategoryAllocationPreviewSchema = zod_1.z.object({
    category: exports.SpendableCategorySchema,
    name: zod_1.z.string(),
    amount: zod_1.z.number().nonnegative(),
    percentage: zod_1.z.number().nonnegative(),
    dailyCap: zod_1.z.number().nonnegative().optional(),
});
/** POST/PATCH /onboarding/plan-preview — assign result plus an editable
 *  per-category breakdown of the spendable amount, used by the onboarding
 *  result screen's percentage editor (audit_team.md item 3). */
exports.PlanPreviewResultSchema = exports.OnboardingAssignResultSchema.extend({
    categoryBreakdown: zod_1.z.array(exports.CategoryAllocationPreviewSchema),
    // The percentages actually used to compute categoryBreakdown — either the
    // caller's categoryPercentages echoed back, or the rules engine's default
    // weighting when none was supplied. Lets the client seed sliders/inputs
    // with sane defaults on first render.
    categoryPercentages: zod_1.z.record(zod_1.z.string(), zod_1.z.number().min(0).max(100)),
});
exports.OnboardingCommitResultSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
    pockets: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        kind: exports.PocketKindSchema, // Includes 'loan' for compatibility, though onboarding doesn't create loans
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
    // Reserve-based runway fields
    discretionaryReserve: zod_1.z.number().nonnegative().optional(),
    fixedObligations: zod_1.z.number().nonnegative().optional(),
    dailyBudget: zod_1.z.number().nonnegative().optional(),
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
    // 'individual' (default, keeps existing behavior) | 'msme' (ADR-001 §5.1)
    segment: exports.SegmentSchema.optional(),
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
    // Which segment owns this pocket ('individual' default | 'msme'), derived
    // from the plan — not stored on the pocket — for client filtering (§6.1).
    segment: exports.SegmentSchema.optional(),
    name: zod_1.z.string(),
    kind: exports.PocketKindSchema, // 'savings' | 'fixed' | 'spendable'
    category: exports.PocketCategorySchema.optional(), // for spendable: 'food' | 'transport' | 'leisure' | …
    isTimeLocked: zod_1.z.boolean().default(false),
    lockUntil: zod_1.z.string().datetime().optional(),
    monthlyAllocation: zod_1.z.number().nonnegative(),
    dailyCap: zod_1.z.number().nonnegative().optional(), // for daily plans
    // Sub-pockets (audit_team.md item 10): null/absent for a top-level
    // pocket, set for a sub-pocket nested one level under a parent pocket.
    // See docs on POST /pockets/:id/sub-pockets — depth is capped at one
    // level (a sub-pocket can't itself have children).
    parentPocketId: zod_1.z.string().uuid().nullable().optional(),
    // Source of truth for a sub-pocket's share of its parent
    // (010_sub_pocket_split_percentage.sql / SUB_POCKET_SPLITS.md).
    // Undefined/null for top-level pockets. `monthlyAllocation` above is
    // kept in sync as a derived cache whenever the parent's allocation
    // changes — see pockets.service.ts recomputeSubPocketAllocations.
    splitPercentage: zod_1.z.number().positive().max(100).nullable().optional(),
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
/** POST /pockets/:id/sub-pockets — creates a sub-pocket nested under the
 *  :id parent. The parent's own kind/lock status are not client-settable
 *  here: a sub-pocket inherits its parent's `kind` (see
 *  pockets.service.ts createSubPocket) so merchant-scope rules
 *  (pocket-rules.ts) and spend checks behave the same as any other pocket
 *  of that kind, with `category` free to differ from the parent so e.g. a
 *  Loan pocket's purpose sub-pockets can each have their own category.
 *
 *  `splitPercentage` (not a flat KSh amount) is the share of the parent's
 *  allocation this sub-pocket claims going forward — see
 *  010_sub_pocket_split_percentage.sql. Combined with existing siblings it
 *  must not exceed 100; enforced in pockets.service.ts, which needs
 *  sibling context a schema alone can't see. */
exports.SubPocketCreateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.PocketCategorySchema.optional(),
    splitPercentage: zod_1.z.number().positive().max(100),
});
/** PATCH /pockets/:id/rebalance — bulk-updates a full sibling set's
 *  splitPercentage in one call (the rebalance bottom-sheet's sliders edit
 *  several siblings at once). `:id` is any sibling in the group; the
 *  service resolves the shared parent from it. Percentages must sum to
 *  <= 100 across the provided set plus any siblings NOT included in this
 *  call (their existing percentage still counts against the ceiling) —
 *  validated in pockets.service.ts. `confirmPartial` opts into the
 *  partial-rebalance-now-plus-catch-up-next-income-event path when the
 *  edit needs more money than currently exists to move immediately;
 *  without it, an underfunded rebalance is rejected with the shortfall
 *  amount so the client can show the confirm prompt first. */
exports.SubPocketRebalanceInputSchema = zod_1.z.object({
    splits: zod_1.z
        .array(zod_1.z.object({
        pocketId: zod_1.z.string().uuid(),
        splitPercentage: zod_1.z.number().positive().max(100),
    }))
        .min(1),
    confirmPartial: zod_1.z.boolean().optional().default(false),
});
// ============================================================================
// Emergency Unlock Schemas - runway-impact model for freelancers
// ============================================================================
exports.EmergencyUnlockEligibilityReasonSchema = zod_1.z.enum([
    'not_freelancer_plan',
    'insufficient_history',
    'monthly_limit_reached',
    'no_discretionary_runway',
    'reserve_protected',
]);
exports.RunwayImpactOptionSchema = zod_1.z.object({
    emergency_amount: zod_1.z.number().positive(),
    runway_days_before: zod_1.z.number().nonnegative(),
    runway_days_after: zod_1.z.number().nonnegative(),
    runway_reduction_days: zod_1.z.number().nonnegative(),
});
exports.SpendingAnalysisSchema = zod_1.z.object({
    least_daily_spend: zod_1.z.number().nonnegative(),
    most_daily_spend: zod_1.z.number().nonnegative(),
    average_daily_spend: zod_1.z.number().nonnegative(),
    days_of_history: zod_1.z.number().int().nonnegative(),
});
exports.DiscretionaryRunwaySchema = zod_1.z.object({
    total_reserve: zod_1.z.number().nonnegative(),
    fixed_obligations: zod_1.z.number().nonnegative(),
    discretionary_reserve: zod_1.z.number().nonnegative(),
    daily_budget: zod_1.z.number().nonnegative(),
    runway_days: zod_1.z.number().nonnegative(),
});
exports.EmergencyUnlockEligibilityResponseSchema = zod_1.z.object({
    eligible: zod_1.z.boolean(),
    reason: exports.EmergencyUnlockEligibilityReasonSchema.optional(),
    message: zod_1.z.string().optional(),
    analysis: exports.SpendingAnalysisSchema.optional(),
    discretionary_runway: exports.DiscretionaryRunwaySchema.optional(),
    // Pre-calculated options for the UI slider
    runway_impact_options: zod_1.z.array(exports.RunwayImpactOptionSchema).optional(),
    last_used: zod_1.z.string().datetime().optional(),
    next_available: zod_1.z.string().datetime().optional(),
});
exports.EmergencyUnlockRequestSchema = zod_1.z.object({
    amount: zod_1.z.number().positive(),
    confirm_impact: zod_1.z.boolean(),
});
exports.EmergencyUnlockAllocationSchema = zod_1.z.object({
    pocket_id: zod_1.z.string().uuid(),
    pocket_name: zod_1.z.string(),
    amount: zod_1.z.number().positive(),
    percentage: zod_1.z.number().nonnegative(),
});
exports.EmergencyUnlockResponseSchema = zod_1.z.object({
    applied: zod_1.z.boolean(),
    unlock: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        amount: zod_1.z.number().positive(),
        runway_days_before: zod_1.z.number().nonnegative(),
        runway_days_after: zod_1.z.number().nonnegative(),
        runway_reduction_days: zod_1.z.number().nonnegative(),
        allocations: zod_1.z.array(exports.EmergencyUnlockAllocationSchema),
    }).optional(),
    error: zod_1.z.string().optional(),
    message: zod_1.z.string().optional(),
    next_available: zod_1.z.string().datetime().optional(),
});
// ============================================================================
// Loan Schemas - audit_team.md item 9
// ============================================================================
exports.RepaymentCadenceSchema = zod_1.z.enum(['weekly', 'biweekly', 'monthly']);
exports.RepaymentScheduleSchema = zod_1.z.object({
    totalAmount: zod_1.z.number().positive(),
    repaymentAmount: zod_1.z.number().positive(),
    cadence: exports.RepaymentCadenceSchema,
    startDate: zod_1.z.string(), // ISO date string
    endDate: zod_1.z.string(), // ISO date string
    nextDueDate: zod_1.z.string(), // ISO date string
    totalPayments: zod_1.z.number().int().positive(),
    paymentsMade: zod_1.z.number().int().nonnegative(),
});
exports.LoanCreateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    totalAmount: zod_1.z.number().positive(),
    repaymentAmount: zod_1.z.number().positive(),
    cadence: exports.RepaymentCadenceSchema,
    startDate: zod_1.z.string(), // ISO date string
    endDate: zod_1.z.string(), // ISO date string
    dueDay: zod_1.z.number().int().min(1).max(31),
    loanProvider: zod_1.z.string().min(1).max(100).optional(),
    loanPurpose: zod_1.z.string().min(1).max(200).optional(),
});
exports.LoanUpdateInputSchema = zod_1.z.object({
    repaymentSchedule: exports.RepaymentScheduleSchema.partial().optional(),
    loanProvider: zod_1.z.string().min(1).max(100).optional(),
    loanPurpose: zod_1.z.string().min(1).max(200).optional(),
}).partial();
exports.LoanPurposePocketInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.PocketCategorySchema,
    splitPercentage: zod_1.z.number().min(0).max(100),
});
exports.LoanDetailSchema = exports.PocketSchema.extend({
    kind: zod_1.z.literal('loan'),
    repaymentSchedule: exports.RepaymentScheduleSchema,
    loanProvider: zod_1.z.string().nullable(),
    loanPurpose: zod_1.z.string().nullable(),
    dueDay: zod_1.z.number().int().min(1).max(31),
    subPockets: zod_1.z.array(exports.PocketSchema).optional(), // Repayment + purpose sub-pockets
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
    // Daily allocation linkage (migration 013)
    dailyAllocationId: zod_1.z.string().uuid().nullable().optional(),
});
// ============================================================================
// Daily Allocation Schema (migration 013)
// ============================================================================
exports.DailyAllocationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    allocationDate: zod_1.z.string().date(),
    plannedAmount: zod_1.z.number().nonnegative(),
    actualSpend: zod_1.z.number().nonnegative(),
    returnedAmount: zod_1.z.number().nonnegative(),
    overspendAmount: zod_1.z.number().nonnegative(),
    runwayDaysAtOpen: zod_1.z.number().nonnegative().nullable().optional(),
    runwayDaysAtClose: zod_1.z.number().nonnegative().nullable().optional(),
    status: zod_1.z.enum(['open', 'closed']),
    createdAt: zod_1.z.string().datetime(),
    closedAt: zod_1.z.string().datetime().nullable().optional(),
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
    Segment: exports.SegmentSchema,
    PocketKind: exports.PocketKindSchema,
    PocketCategory: exports.PocketCategorySchema,
    BusinessPocketCategory: exports.BusinessPocketCategorySchema,
    MSME_SPENDABLE_LABELS: exports.MSME_SPENDABLE_LABELS,
    IncomePattern: exports.IncomePatternSchema,
    SpendingHabit: exports.SpendingHabitSchema,
    LifeStage: exports.LifeStageSchema,
    EmergencyBuffer: exports.EmergencyBufferSchema,
    MoneyPersonality: exports.MoneyPersonalitySchema,
    NeedsBand: exports.NeedsBandSchema,
    SavingsGoalType: exports.SavingsGoalTypeSchema,
    SavingsGoalTimeframe: exports.SavingsGoalTimeframeSchema,
    SavingsGoalInput: exports.SavingsGoalInputSchema,
    PlanName: exports.PlanNameSchema,
    TransactionType: exports.TransactionTypeSchema,
    ReallocationStatus: exports.ReallocationStatusSchema,
    ReallocationReason: exports.ReallocationReasonSchema,
    MerchantCategory: exports.MerchantCategorySchema,
    PlanStatus: exports.PlanStatusSchema,
    SpendableCategory: exports.SpendableCategorySchema,
    SPENDABLE_CATEGORY_LABELS: exports.SPENDABLE_CATEGORY_LABELS,
    CategoryPercentages: exports.CategoryPercentagesSchema,
    IncomeConcentration: exports.IncomeConcentrationSchema,
    OnboardingInput: exports.OnboardingInputSchema,
    MsmeOnboardingInput: exports.MsmeOnboardingInputSchema,
    BusinessStage: exports.BusinessStageSchema,
    MsmePocketInput: exports.MsmePocketInputSchema,
    ProjectKind: exports.ProjectKindSchema,
    FundingTier: exports.FundingTierSchema,
    FundingStatus: exports.FundingStatusSchema,
    ProjectStatus: exports.ProjectStatusSchema,
    ProjectCreateInput: exports.ProjectCreateInputSchema,
    ProjectIncomeInput: exports.ProjectIncomeInputSchema,
    TierSummary: exports.TierSummarySchema,
    ProjectSummary: exports.ProjectSummarySchema,
    SpendingControls: exports.SpendingControlsSchema,
    ExcessResolveInput: exports.ExcessResolveInputSchema,
    SpendControlsUpdateInput: exports.SpendControlsUpdateInputSchema,
    ProjectCompleteResult: exports.ProjectCompleteResultSchema,
    ProjectCompletionResolveInput: exports.ProjectCompletionResolveInputSchema,
    ProjectSpendInput: exports.ProjectSpendInputSchema,
    MsmeProject: exports.MsmeProjectSchema,
    MsmeProjectTier: exports.MsmeProjectTierSchema,
    MsmeProjectIncomeEvent: exports.MsmeProjectIncomeEventSchema,
    MsmeProjectAllocation: exports.MsmeProjectAllocationSchema,
    MsmeProjectSpend: exports.MsmeProjectSpendSchema,
    ExcessPromptStatus: exports.ExcessPromptStatusSchema,
    ExcessPromptTarget: exports.ExcessPromptTargetSchema,
    MsmeProjectExcessPrompt: exports.MsmeProjectExcessPromptSchema,
    PlanAssignReason: exports.PlanAssignReasonSchema,
    OnboardingAssignResult: exports.OnboardingAssignResultSchema,
    CategoryAllocationPreview: exports.CategoryAllocationPreviewSchema,
    PlanPreviewResult: exports.PlanPreviewResultSchema,
    OnboardingCommitResult: exports.OnboardingCommitResultSchema,
    PlanRetakeResult: exports.PlanRetakeResultSchema,
    RetakeEligibility: exports.RetakeEligibilitySchema,
    User: exports.UserSchema,
    Plan: exports.PlanSchema,
    Pocket: exports.PocketSchema,
    PocketUpdateInput: exports.PocketUpdateInputSchema,
    SubPocketCreateInput: exports.SubPocketCreateInputSchema,
    SubPocketRebalanceInput: exports.SubPocketRebalanceInputSchema,
    EmergencyUnlockEligibilityResponse: exports.EmergencyUnlockEligibilityResponseSchema,
    EmergencyUnlockRequest: exports.EmergencyUnlockRequestSchema,
    EmergencyUnlockResponse: exports.EmergencyUnlockResponseSchema,
    RunwayImpactOption: exports.RunwayImpactOptionSchema,
    DiscretionaryRunway: exports.DiscretionaryRunwaySchema,
    EmergencyUnlockEligibilityReason: exports.EmergencyUnlockEligibilityReasonSchema,
    RepaymentCadence: exports.RepaymentCadenceSchema,
    RepaymentSchedule: exports.RepaymentScheduleSchema,
    LoanCreateInput: exports.LoanCreateInputSchema,
    LoanUpdateInput: exports.LoanUpdateInputSchema,
    LoanPurposePocketInput: exports.LoanPurposePocketInputSchema,
    LoanDetail: exports.LoanDetailSchema,
    FixedExpense: exports.FixedExpenseSchema,
    IncomeEvent: exports.IncomeEventSchema,
    Transaction: exports.TransactionSchema,
    DailyAllocation: exports.DailyAllocationSchema,
    Reallocation: exports.ReallocationSchema,
    ReallocationInput: exports.ReallocationInputSchema,
    ReallocationCompleteInput: exports.ReallocationCompleteInputSchema,
    MerchantClassification: exports.MerchantClassificationSchema,
    BehaviorEvent: exports.BehaviorEventSchema,
    DisciplineScore: exports.DisciplineScoreSchema,
    InvoiceStatus: exports.InvoiceStatusSchema,
    EtimsStatus: exports.EtimsStatusSchema,
    KraPin: exports.KraPinSchema,
    InvoiceCreateInput: exports.InvoiceCreateInputSchema,
    InvoiceUpdateInput: exports.InvoiceUpdateInputSchema,
    Invoice: exports.InvoiceSchema,
    MsmeInvoiceStats: exports.MsmeInvoiceStatsSchema,
    MsmeProjectStats: exports.MsmeProjectStatsSchema,
    MsmeAlert: exports.MsmeAlertSchema,
    MsmeOperationalInsights: exports.MsmeOperationalInsightsSchema,
    StockItemCreateInput: exports.StockItemCreateInputSchema,
    StockItemUpdateInput: exports.StockItemUpdateInputSchema,
    StockMovementType: exports.StockMovementTypeSchema,
    StockMovementCreateInput: exports.StockMovementCreateInputSchema,
    StockItem: exports.StockItemSchema,
    StockMovement: exports.StockMovementSchema,
};
