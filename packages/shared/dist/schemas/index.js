"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixedExpenseSchema = exports.LoanDetailSchema = exports.LoanPurposePocketInputSchema = exports.LoanUpdateInputSchema = exports.LoanCreateInputSchema = exports.RepaymentScheduleSchema = exports.RepaymentCadenceSchema = exports.SubPocketCreateInputSchema = exports.PocketUpdateInputSchema = exports.PocketSchema = exports.PlanSchema = exports.UserSchema = exports.RunwaySummarySchema = exports.RetakeEligibilitySchema = exports.PlanRetakeResultSchema = exports.PlanRedistributionSchema = exports.RedistributionMovementSchema = exports.RedistributionReasonSchema = exports.OnboardingCommitResultSchema = exports.PlanPreviewResultSchema = exports.CategoryAllocationPreviewSchema = exports.OnboardingAssignResultSchema = exports.PlanAssignReasonSchema = exports.OnboardingInputSchema = exports.FixedExpenseInputSchema = exports.SavingsGoalInputSchema = exports.SavingsGoalLockDays = exports.SavingsGoalTimeframeMonths = exports.SavingsGoalTimeframeSchema = exports.SavingsGoalTypeSchema = exports.CategoryPercentagesSchema = exports.SpendableCategorySchema = exports.NeedsBandSchema = exports.MoneyPersonalitySchema = exports.EmergencyBufferSchema = exports.LifeStageSchema = exports.PlanStatusSchema = exports.MerchantCategorySchema = exports.ReallocationReasonSchema = exports.ReallocationStatusSchema = exports.TransactionTypeSchema = exports.IncomeConcentrationSchema = exports.PlanNameSchema = exports.SpendingHabitSchema = exports.IncomeIntervalDaysByBand = exports.IncomeIntervalBandSchema = exports.IncomePatternSchema = exports.PocketCategorySchema = exports.PocketKindSchema = exports.PlanTypeSchema = void 0;
exports.schemas = exports.DisciplineScoreSchema = exports.BehaviorEventSchema = exports.MerchantClassificationSchema = exports.ReallocationCompleteInputSchema = exports.ReallocationInputSchema = exports.ReallocationSchema = exports.TransactionSchema = exports.IncomeEventSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Core Domain Enums - Pack 1 Specification
// ============================================================================
exports.PlanTypeSchema = zod_1.z.enum(['structured', 'daily']);
exports.PocketKindSchema = zod_1.z.enum(['savings', 'fixed', 'spendable', 'loan']);
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
    // Income-concentration split within the 'freelancer' income pattern
    // (audit_team.md item 8, Batch 4 / ONBOARDING_AND_SCORING_REDESIGN.md
    // §2.1). Display-only — the underlying `IncomePattern` stored on the plan
    // and used by runway/rollover logic is still just 'freelancer'; 'Gig' is
    // a plan-name/reasons distinction, not a new stored income pattern.
    'Gig — Structured',
    'Gig — Daily Budget',
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
// Partial map of category -> percentage (0-100) of the spendable amount.
// Partial because which categories exist depends on persona (student gets
// only 'leisure'; dependents add 'family') — the server resolves which keys
// are expected and rejects a mismatched set rather than the schema trying to
// enforce that here.
exports.CategoryPercentagesSchema = zod_1.z.record(exports.SpendableCategorySchema, zod_1.z.number().min(0).max(100));
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
    categoryPercentages: exports.CategoryPercentagesSchema.optional(),
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
    plan: exports.PlanNameSchema,
    planType: exports.PlanTypeSchema,
    incomePattern: exports.IncomePatternSchema,
    // Set only when incomePattern resolves to 'freelancer' — see
    // IncomeConcentrationSchema. Undefined for salaried/mix.
    incomeConcentration: exports.IncomeConcentrationSchema.optional(),
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
    categoryPercentages: exports.CategoryPercentagesSchema,
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
    // Sub-pockets (audit_team.md item 10): null/absent for a top-level
    // pocket, set for a sub-pocket nested one level under a parent pocket.
    // See docs on POST /pockets/:id/sub-pockets — depth is capped at one
    // level (a sub-pocket can't itself have children).
    parentPocketId: zod_1.z.string().uuid().nullable().optional(),
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
 *  Loan pocket's purpose sub-pockets can each have their own category. */
exports.SubPocketCreateInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    category: exports.PocketCategorySchema.optional(),
    monthlyAllocation: zod_1.z.number().nonnegative(),
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
    monthlyAllocation: zod_1.z.number().nonnegative(),
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
    CategoryPercentages: exports.CategoryPercentagesSchema,
    IncomeConcentration: exports.IncomeConcentrationSchema,
    OnboardingInput: exports.OnboardingInputSchema,
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
    RepaymentCadence: exports.RepaymentCadenceSchema,
    RepaymentSchedule: exports.RepaymentScheduleSchema,
    LoanCreateInput: exports.LoanCreateInputSchema,
    LoanUpdateInput: exports.LoanUpdateInputSchema,
    LoanPurposePocketInput: exports.LoanPurposePocketInputSchema,
    LoanDetail: exports.LoanDetailSchema,
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
