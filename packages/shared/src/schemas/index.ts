import { z } from 'zod';

// ============================================================================
// Core Domain Enums - Pack 1 Specification
// ============================================================================

export const PlanTypeSchema = z.enum(['structured', 'daily']);
export type PlanType = z.infer<typeof PlanTypeSchema>;

export const PocketKindSchema = z.enum(['savings', 'fixed', 'spendable', 'loan']);
export type PocketKind = z.infer<typeof PocketKindSchema>;

export const PocketCategorySchema = z.enum([
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
  // Income-concentration split within the 'freelancer' income pattern
  // (audit_team.md item 8, Batch 4 / ONBOARDING_AND_SCORING_REDESIGN.md
  // §2.1). Display-only — the underlying `IncomePattern` stored on the plan
  // and used by runway/rollover logic is still just 'freelancer'; 'Gig' is
  // a plan-name/reasons distinction, not a new stored income pattern.
  'Gig — Structured',
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
]);
export type PlanName = z.infer<typeof PlanNameSchema>;

// Income-concentration signal within the 'freelancer' income pattern
// (audit_team.md item 8, Batch 4). Derived from `sourceCount`, already
// collected at onboarding: a handful of sources reads as gig/platform-style
// concentrated income (Bolt/Uber/delivery-app style — volatile day to day
// but with some payout-cadence predictability); several distinct sources
// reads as genuinely lumpy multi-client freelance income. Only meaningful
// when the resolved income pattern is 'freelancer' — undefined for
// salaried/mix.
export const IncomeConcentrationSchema = z.enum(['concentrated', 'diversified']);
export type IncomeConcentration = z.infer<typeof IncomeConcentrationSchema>;

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

export const LifeStageSchema = z.enum(['student', 'working_adult', 'self_employed']);
export type LifeStage = z.infer<typeof LifeStageSchema>;

export const EmergencyBufferSchema = z.enum([
  'none',
  'under_month',
  '1_to_3_months',
  '3_plus_months',
]);
export type EmergencyBuffer = z.infer<typeof EmergencyBufferSchema>;

/** Behavioral self-check — modifier layer, not a plan-type driver (§2.3). */
export const MoneyPersonalitySchema = z.enum(['spender', 'saver', 'avoider']);
export type MoneyPersonality = z.infer<typeof MoneyPersonalitySchema>;

export const NeedsBandSchema = z.enum(['high', 'mid', 'low']);
export type NeedsBand = z.infer<typeof NeedsBandSchema>;

// Spendable category pockets a user can rebalance at onboarding time (§3 of
// audit_team.md item 3). Deliberately narrower than PocketCategorySchema —
// only the categories the spendable-pocket provisioner ever creates.
export const SpendableCategorySchema = z.enum(['food', 'transport', 'leisure', 'family']);
export type SpendableCategory = z.infer<typeof SpendableCategorySchema>;

// Partial map of category -> percentage (0-100) of the spendable amount.
// Partial because which categories exist depends on persona (student gets
// only 'leisure'; dependents add 'family') — the server resolves which keys
// are expected and rejects a mismatched set rather than the schema trying to
// enforce that here.
export const CategoryPercentagesSchema = z.record(SpendableCategorySchema, z.number().min(0).max(100));
export type CategoryPercentages = z.infer<typeof CategoryPercentagesSchema>;

// ----------------------------------------------------------------------------
// Goal-driven savings (ONBOARDING_AND_SCORING_REDESIGN.md Part 4). Replaces
// the flat-rate-for-everyone savings model with an optional captured goal —
// what, roughly how much, roughly by when — that the rules engine derives a
// savings rate and lock length from (see rules-engine.ts's
// calculateSavingsTarget). Entirely optional: skipping this step falls back
// to the existing buffer-based rate with no goal-shortfall messaging.
// ----------------------------------------------------------------------------

export const SavingsGoalTypeSchema = z.enum([
  'emergency_fund',
  'purchase',
  'dependent_education',
  'other',
]);
export type SavingsGoalType = z.infer<typeof SavingsGoalTypeSchema>;

// Timeframe band, not an exact date — same honesty-over-precision reasoning
// as IncomeIntervalBandSchema for freelancers (§4.1: "target date or a
// rough timeframe band ... exact dates are unreliable, bands are honest").
export const SavingsGoalTimeframeSchema = z.enum([
  '3_months',
  '6_months',
  '1_year',
  '2_plus_years',
]);
export type SavingsGoalTimeframe = z.infer<typeof SavingsGoalTimeframeSchema>;

// Months-to-target used by the derived-rate calculation. '2_plus_years' is
// open-ended by definition — 24 is treated as a conservative floor (a
// longer real timeframe only makes the derived rate easier to hit, never
// harder), not a claim that the goal is exactly 2 years out.
export const SavingsGoalTimeframeMonths: Record<SavingsGoalTimeframe, number> = {
  '3_months': 3,
  '6_months': 6,
  '1_year': 12,
  '2_plus_years': 24,
};

// Savings-pocket lock length (days), matched to how far out the goal is
// (§4.2: "lock length becomes goal-derived too"). Shorter-horizon goals
// (e.g. an emergency buffer) get shorter lock cycles than a multi-year goal
// so the lock cadence doesn't feel arbitrary relative to what it's guarding.
export const SavingsGoalLockDays: Record<SavingsGoalTimeframe, number> = {
  '3_months': 30,
  '6_months': 60,
  '1_year': 90,
  '2_plus_years': 90,
};

export const SavingsGoalInputSchema = z.object({
  goalType: SavingsGoalTypeSchema,
  // Free-text personalization (e.g. "Amara's school fees"), same posture as
  // fixed-expense names already stored today — deliberately not a separate
  // structured dependent-name/relationship field, to avoid introducing a
  // new PII category beyond what the app already handles (open question 5
  // in ONBOARDING_AND_SCORING_REDESIGN.md).
  goalLabel: z.string().min(1).max(60).optional(),
  goalAmount: z.number().positive().optional(),
  goalTimeframe: SavingsGoalTimeframeSchema,
});
export type SavingsGoalInput = z.infer<typeof SavingsGoalInputSchema>;

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
  // Persona / deeper onboarding (Batches 3–4). Optional so older clients
  // keep working; provisioner + rules engine apply safe defaults.
  lifeStage: LifeStageSchema.optional(),
  hasDependents: z.boolean().optional(),
  emergencyBuffer: EmergencyBufferSchema.optional(),
  moneyPersonality: MoneyPersonalitySchema.optional(),
  // Tri-state, same shape as `hasDependents`: does this person regularly
  // spend money on transport/commuting? Left undefined when unasked/unknown
  // (treated as "normal" transport need — today's default even weighting).
  // Explicit `false` is the remote-worker signal from
  // ONBOARDING_AND_SCORING_REDESIGN.md §2.5 ("no stated transport need") —
  // folds the transport category into a smaller share of the spendable
  // split instead of an even split, without removing the category outright
  // (a remote worker still occasionally takes transport).
  hasTransportNeed: z.boolean().optional(),
  // Optional captured savings goal (Part 4) — see SavingsGoalInputSchema.
  // Omitted means "no stated goal": rules-engine falls back to the
  // existing buffer-based rate/default 30-day lock with no shortfall
  // messaging.
  savingsGoal: SavingsGoalInputSchema.optional(),
  // User-adjusted split across spendable category pockets, set on the
  // onboarding result screen (item 3 of audit_team.md). Optional — omitted
  // means "use the rules engine's default weighting". When present, must
  // cover exactly the categories the persona resolves to and sum to 100
  // (server-validated in validateCategoryPercentages, not here, since the
  // expected key set depends on lifeStage/hasDependents).
  categoryPercentages: CategoryPercentagesSchema.optional(),
});
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

export const PlanAssignReasonSchema = z.object({
  rule: z.string(),
  reason: z.string(),
  // Numeric context for "why this plan" templates (§2.6).
  needsRatio: z.number().nonnegative().optional(),
  needsBand: NeedsBandSchema.optional(),
  // Populated only on the 'savings_goal_capacity_shortfall' reason (§4.2):
  // the literal derived rate needed to hit the goal on time would exceed
  // the sane-share cap, so these carry the numbers the client renders as
  // "would take ~N months longer" / "would need ~X% of your spendable
  // income" instead of silently forcing or silently ignoring the goal.
  goalMonthsNeeded: z.number().nonnegative().optional(),
  goalRequiredSharePercent: z.number().nonnegative().optional(),
});
export type PlanAssignReason = z.infer<typeof PlanAssignReasonSchema>;

export const OnboardingAssignResultSchema = z.object({
  plan: PlanNameSchema,
  planType: PlanTypeSchema,
  incomePattern: IncomePatternSchema,
  // Set only when incomePattern resolves to 'freelancer' — see
  // IncomeConcentrationSchema. Undefined for salaried/mix.
  incomeConcentration: IncomeConcentrationSchema.optional(),
  // Set only when the onboarding answer was 'mix' (stable base + irregular
  // side income) — audit_team.md item 2's salaried-with-side-income
  // persona. Undefined for pure 'salaried' and for 'freelancer'.
  hasSideIncome: z.boolean().optional(),
  reasons: z.array(PlanAssignReasonSchema),
  remainingAfterFixed: z.number(),
  savingsTarget: z.number(),
  spendableAmount: z.number(),
  needsRatio: z.number().nonnegative(),
  needsBand: NeedsBandSchema,
});
export type OnboardingAssignResult = z.infer<typeof OnboardingAssignResultSchema>;

export const CategoryAllocationPreviewSchema = z.object({
  category: SpendableCategorySchema,
  name: z.string(),
  amount: z.number().nonnegative(),
  percentage: z.number().nonnegative(),
  dailyCap: z.number().nonnegative().optional(),
});
export type CategoryAllocationPreview = z.infer<typeof CategoryAllocationPreviewSchema>;

/** POST/PATCH /onboarding/plan-preview — assign result plus an editable
 *  per-category breakdown of the spendable amount, used by the onboarding
 *  result screen's percentage editor (audit_team.md item 3). */
export const PlanPreviewResultSchema = OnboardingAssignResultSchema.extend({
  categoryBreakdown: z.array(CategoryAllocationPreviewSchema),
  // The percentages actually used to compute categoryBreakdown — either the
  // caller's categoryPercentages echoed back, or the rules engine's default
  // weighting when none was supplied. Lets the client seed sliders/inputs
  // with sane defaults on first render.
  categoryPercentages: CategoryPercentagesSchema,
});
export type PlanPreviewResult = z.infer<typeof PlanPreviewResultSchema>;

export const OnboardingCommitResultSchema = z.object({
  planId: z.string().uuid(),
  pockets: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    kind: PocketKindSchema, // Includes 'loan' for compatibility, though onboarding doesn't create loans
    category: PocketCategorySchema.optional(),
    monthlyAllocation: z.number().nonnegative(),
    dailyCap: z.number().nonnegative().optional(),
  })),
});
export type OnboardingCommitResult = z.infer<typeof OnboardingCommitResultSchema>;

/** Why a balance moved from an old pocket to a new one during plan retake. */
export const RedistributionReasonSchema = z.enum([
  'category_match',
  'kind_match',
  'proportional',
  'spillover',
]);
export type RedistributionReason = z.infer<typeof RedistributionReasonSchema>;

export const RedistributionMovementSchema = z.object({
  fromPocketName: z.string(),
  toPocketName: z.string(),
  amount: z.number().nonnegative(),
  reason: RedistributionReasonSchema,
});
export type RedistributionMovement = z.infer<typeof RedistributionMovementSchema>;

export const PlanRedistributionSchema = z.object({
  totalMoved: z.number().nonnegative(),
  movements: z.array(RedistributionMovementSchema),
  previousPlanType: PlanTypeSchema,
  newPlanType: PlanTypeSchema,
  nextRetakeAvailableOn: z.string(), // ISO date (YYYY-MM-DD) — first day of next UTC month
});
export type PlanRedistribution = z.infer<typeof PlanRedistributionSchema>;

/** Result of POST /profile/plan/retake — commit shape plus money-migration summary. */
export const PlanRetakeResultSchema = OnboardingCommitResultSchema.extend({
  redistribution: PlanRedistributionSchema,
});
export type PlanRetakeResult = z.infer<typeof PlanRetakeResultSchema>;

/** GET /profile/plan/retake-eligibility — gates the Profile retake CTA. */
export const RetakeEligibilitySchema = z.object({
  allowed: z.boolean(),
  nextRetakeAvailableOn: z.string().nullable(),
  lastRetakenAt: z.string().nullable(),
  message: z.string().optional(),
});
export type RetakeEligibility = z.infer<typeof RetakeEligibilitySchema>;

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
  // Sub-pockets (audit_team.md item 10): null/absent for a top-level
  // pocket, set for a sub-pocket nested one level under a parent pocket.
  // See docs on POST /pockets/:id/sub-pockets — depth is capped at one
  // level (a sub-pocket can't itself have children).
  parentPocketId: z.string().uuid().nullable().optional(),
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

/** POST /pockets/:id/sub-pockets — creates a sub-pocket nested under the
 *  :id parent. The parent's own kind/lock status are not client-settable
 *  here: a sub-pocket inherits its parent's `kind` (see
 *  pockets.service.ts createSubPocket) so merchant-scope rules
 *  (pocket-rules.ts) and spend checks behave the same as any other pocket
 *  of that kind, with `category` free to differ from the parent so e.g. a
 *  Loan pocket's purpose sub-pockets can each have their own category. */
export const SubPocketCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: PocketCategorySchema.optional(),
  monthlyAllocation: z.number().nonnegative(),
});
export type SubPocketCreateInput = z.infer<typeof SubPocketCreateInputSchema>;

// ============================================================================
// Loan Schemas - audit_team.md item 9
// ============================================================================

export const RepaymentCadenceSchema = z.enum(['weekly', 'biweekly', 'monthly']);
export type RepaymentCadence = z.infer<typeof RepaymentCadenceSchema>;

export const RepaymentScheduleSchema = z.object({
  totalAmount: z.number().positive(),
  repaymentAmount: z.number().positive(),
  cadence: RepaymentCadenceSchema,
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  nextDueDate: z.string(), // ISO date string
  totalPayments: z.number().int().positive(),
  paymentsMade: z.number().int().nonnegative(),
});
export type RepaymentSchedule = z.infer<typeof RepaymentScheduleSchema>;

export const LoanCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  totalAmount: z.number().positive(),
  repaymentAmount: z.number().positive(),
  cadence: RepaymentCadenceSchema,
  startDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  dueDay: z.number().int().min(1).max(31),
  loanProvider: z.string().min(1).max(100).optional(),
  loanPurpose: z.string().min(1).max(200).optional(),
});
export type LoanCreateInput = z.infer<typeof LoanCreateInputSchema>;

export const LoanUpdateInputSchema = z.object({
  repaymentSchedule: RepaymentScheduleSchema.partial().optional(),
  loanProvider: z.string().min(1).max(100).optional(),
  loanPurpose: z.string().min(1).max(200).optional(),
}).partial();
export type LoanUpdateInput = z.infer<typeof LoanUpdateInputSchema>;

export const LoanPurposePocketInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: PocketCategorySchema,
  monthlyAllocation: z.number().nonnegative(),
});
export type LoanPurposePocketInput = z.infer<typeof LoanPurposePocketInputSchema>;

export const LoanDetailSchema = PocketSchema.extend({
  kind: z.literal('loan'),
  repaymentSchedule: RepaymentScheduleSchema,
  loanProvider: z.string().nullable(),
  loanPurpose: z.string().nullable(),
  dueDay: z.number().int().min(1).max(31),
  subPockets: z.array(PocketSchema).optional(), // Repayment + purpose sub-pockets
});
export type LoanDetail = z.infer<typeof LoanDetailSchema>;

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
  LifeStage: LifeStageSchema,
  EmergencyBuffer: EmergencyBufferSchema,
  MoneyPersonality: MoneyPersonalitySchema,
  NeedsBand: NeedsBandSchema,
  SavingsGoalType: SavingsGoalTypeSchema,
  SavingsGoalTimeframe: SavingsGoalTimeframeSchema,
  SavingsGoalInput: SavingsGoalInputSchema,
  PlanName: PlanNameSchema,
  TransactionType: TransactionTypeSchema,
  ReallocationStatus: ReallocationStatusSchema,
  ReallocationReason: ReallocationReasonSchema,
  MerchantCategory: MerchantCategorySchema,
  PlanStatus: PlanStatusSchema,
  SpendableCategory: SpendableCategorySchema,
  CategoryPercentages: CategoryPercentagesSchema,
  IncomeConcentration: IncomeConcentrationSchema,
  OnboardingInput: OnboardingInputSchema,
  PlanAssignReason: PlanAssignReasonSchema,
  OnboardingAssignResult: OnboardingAssignResultSchema,
  CategoryAllocationPreview: CategoryAllocationPreviewSchema,
  PlanPreviewResult: PlanPreviewResultSchema,
  OnboardingCommitResult: OnboardingCommitResultSchema,
  PlanRetakeResult: PlanRetakeResultSchema,
  RetakeEligibility: RetakeEligibilitySchema,
  User: UserSchema,
  Plan: PlanSchema,
  Pocket: PocketSchema,
  PocketUpdateInput: PocketUpdateInputSchema,
  SubPocketCreateInput: SubPocketCreateInputSchema,
  RepaymentCadence: RepaymentCadenceSchema,
  RepaymentSchedule: RepaymentScheduleSchema,
  LoanCreateInput: LoanCreateInputSchema,
  LoanUpdateInput: LoanUpdateInputSchema,
  LoanPurposePocketInput: LoanPurposePocketInputSchema,
  LoanDetail: LoanDetailSchema,
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
