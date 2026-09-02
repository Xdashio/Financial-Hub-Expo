import { z } from 'zod';

// ============================================================================
// Core Domain Enums - Pack 1 Specification
// ============================================================================

export const PlanTypeSchema = z.enum(['structured', 'daily']);
export type PlanType = z.infer<typeof PlanTypeSchema>;

// Individual vs MSME account segment (ADR-001 / MSME_PHASED_BUILD_PLAN §5.1).
// A user can hold *two* active plans simultaneously — one per segment — so
// segment discriminates plan ownership, not the user.
export const SegmentSchema = z.enum(['individual', 'msme']);
export type Segment = z.infer<typeof SegmentSchema>;

export const PocketKindSchema = z.enum(['savings', 'fixed', 'spendable', 'loan']);
export type PocketKind = z.infer<typeof PocketKindSchema>;

// MSME business pocket categories (ADR-001 D2 / MSME_PHASED_BUILD_PLAN §5.2).
// Kept separate from PocketCategorySchema so the Individual set stays
// untouched; they're merged at the union/PocketCategorySchema level.
export const BusinessPocketCategorySchema = z.enum([
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
export type BusinessPocketCategory = z.infer<typeof BusinessPocketCategorySchema>;

export const PocketCategorySchema = z.enum([
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
  'reserve_release',
  'reserve_return',
  'daily_overspend_debit',
  'fixed_expense_earmark',
  'fixed_expense_carry_forward',
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

/**
 * User-friendly labels for spendable categories.
 * These are the only categories that can appear for spendable pockets
 * (see pocket-provisioning.ts). Other categories like 'grocery', 'healthcare',
 * etc. are merchant classification categories, not spendable pocket categories.
 */
export const MSME_SPENDABLE_LABELS = {
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
} as const satisfies Record<BusinessPocketCategory, string>;

export const SPENDABLE_CATEGORY_LABELS = {
  food: 'Food & Groceries',
  transport: 'Transport',
  leisure: 'Personal & Leisure',
  family: 'Family & Dependents',
  // MSME business labels (MSME_PHASED_BUILD_PLAN §5.2) — spread from the
  // single source of truth so the two label maps stay in lockstep.
  ...MSME_SPENDABLE_LABELS,
} as const satisfies Partial<Record<PocketCategory, string>>;

// Partial map of category -> percentage (0-100) of the spendable amount.
// Partial because which categories exist depends on persona (student gets
// only 'leisure'; dependents add 'family') — the server resolves which keys
// are expected and rejects a mismatched set rather than the schema trying to
// enforce that here.
export const CategoryPercentagesSchema = z.record(z.string(), z.number().min(0).max(100));
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
  frequency: z.enum(['monthly', 'weekly', 'daily']).optional(),
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
  categoryPercentages: z.record(z.string(), z.number().min(0).max(100)).optional(),
});
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;

// ============================================================================
// MSME onboarding (§6.2) — the business-segment sibling of OnboardingInput.
// Deliberately separate: monthly revenue replaces incomeAmount (mapped to
// plans.expected_income_amount server-side) and customPockets (max 6, §2.2)
// lets a business name its own pockets instead of the individual persona set.
// ============================================================================

export const BusinessStageSchema = z.enum(['starting', 'stable', 'growing']);
export type BusinessStage = z.infer<typeof BusinessStageSchema>;

export const MsmePocketInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: PocketCategorySchema,
});
export type MsmePocketInput = z.infer<typeof MsmePocketInputSchema>;

export const MsmeOnboardingInputSchema = z.object({
  segment: z.literal('msme'),
  businessName: z.string().min(1).max(100),
  // maps to plans.expected_income_amount (see commitMsme)
  monthlyRevenue: z.number().positive(),
  // sum of recurring business obligations (rent, salaries, licences, taxes…)
  fixedTotal: z.number().nonnegative(),
  fixedExpenses: z.array(FixedExpenseInputSchema).optional(),
  hasEmployees: z.boolean().optional(),
  businessStage: BusinessStageSchema.optional(),
  savingsGoal: SavingsGoalInputSchema.optional(),
  // custom pocket names — max 6, validated server-side (§2.2)
  customPockets: z.array(MsmePocketInputSchema).max(6).optional(),
});
export type MsmeOnboardingInput = z.infer<typeof MsmeOnboardingInputSchema>;

// ============================================================================
// MSME Project Funding (§6.3) — Funding Cascade Engine (Phase 3)
// ============================================================================

export const ProjectKindSchema = z.enum(['catering', 'wedding', 'trip', 'tour', 'contract', 'construction', 'agri', 'other']);
export type ProjectKind = z.infer<typeof ProjectKindSchema>;

export const FundingTierSchema = z.enum(['priorities', 'needs', 'wants']); // exactly 3, §12:231
export type FundingTier = z.infer<typeof FundingTierSchema>;

export const FundingStatusSchema = z.enum(['in_progress', 'complete']);
export type FundingStatus = z.infer<typeof FundingStatusSchema>;

export const ProjectStatusSchema = z.enum(['draft', 'active', 'completed', 'cancelled']);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const ProjectCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  kind: ProjectKindSchema,
  contractValue: z.number().positive(),
  tiers: z.object({
    priorities: z.number().positive(), // target amounts
    needs: z.number().positive(),
    wants: z.number().positive(),
  }).refine(v => v.priorities + v.needs + v.wants > 0, { message: 'At least one tier target required' }),
  // optional: allow wants=0 for lean projects — service normalizes
}).refine(v => Math.abs((v.tiers.priorities + v.tiers.needs + v.tiers.wants) - v.contractValue) < 0.01,
  { message: 'Tier targets must sum to contract value', path: ['contractValue'] });
export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>;

export const ProjectIncomeInputSchema = z.object({
  amount: z.number().positive(),
  source: z.string().min(1).max(100), // Deposit / Progress / Final
  label: z.string().max(200).optional(),
  date: z.string().date(),
});
export type ProjectIncomeInput = z.infer<typeof ProjectIncomeInputSchema>;

export const TierSummarySchema = z.object({
  id: z.string().uuid(),
  tier: FundingTierSchema,
  sortOrder: z.number().int().min(1).max(3),
  targetAmount: z.number().positive(),
  allocatedAmount: z.number().nonnegative(),
  spentAmount: z.number().nonnegative(),
  remainingCash: z.number().nonnegative(), // allocated - spent
  fundingStatus: FundingStatusSchema,
  fundingPercent: z.number().min(0).max(100),
});
export type TierSummary = z.infer<typeof TierSummarySchema>;

export const SpendingControlsSchema = z.object({
  lockWantsUntilPrioritiesAndNeedsFunded: z.boolean().default(false),
  warnOnLowPrioritySpend: z.boolean().default(false),
});
export type SpendingControls = z.infer<typeof SpendingControlsSchema>;

export const ProjectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: ProjectKindSchema,
  contractValue: z.number(),
  status: ProjectStatusSchema,
  isActiveCascade: z.boolean(),
  // Phase 5 spending controls (§20) — defaults mirror DB DEFAULT.
  spendingControls: SpendingControlsSchema.optional(),
  completionResolvedAt: z.string().datetime().nullable().optional(),
  completionResolvedTo: z.enum(['savings', 'keep']).nullable().optional(),
  tiers: z.array(TierSummarySchema).length(3),
  nextIncomeGoesTo: FundingTierSchema.nullable(), // null if all funded
  totalAllocated: z.number(),
  totalSpent: z.number(),
  totalRemaining: z.number(),
  excessPending: z.number().nullable(),
});
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

// ============================================================================
// MSME Project Database Table Schemas (Phase 3 - 017_msme_projects.sql)
// ============================================================================

export const MsmeProjectSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  name: z.string().min(1).max(100),
  kind: ProjectKindSchema,
  contractValue: z.number().positive(),
  status: ProjectStatusSchema,
  isActiveCascade: z.boolean(),
  spendingControls: SpendingControlsSchema.optional(),
  completionResolvedAt: z.string().datetime().nullable().optional(),
  completionResolvedTo: z.enum(['savings', 'keep']).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
});
export type MsmeProject = z.infer<typeof MsmeProjectSchema>;

export const MsmeProjectTierSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  tier: FundingTierSchema,
  sortOrder: z.number().int().min(1).max(3),
  targetAmount: z.number().positive(),
  allocatedAmount: z.number().nonnegative(),
  spentAmount: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MsmeProjectTier = z.infer<typeof MsmeProjectTierSchema>;

export const MsmeProjectIncomeEventSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  amount: z.number().positive(),
  source: z.string().min(1).max(100),
  label: z.string().max(200).nullable().optional(),
  date: z.string().date(),
  createdAt: z.string().datetime(),
});
export type MsmeProjectIncomeEvent = z.infer<typeof MsmeProjectIncomeEventSchema>;

export const MsmeProjectAllocationSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  tierId: z.string().uuid(),
  incomeEventId: z.string().uuid(),
  amount: z.number().positive(),
  createdAt: z.string().datetime(),
});
export type MsmeProjectAllocation = z.infer<typeof MsmeProjectAllocationSchema>;

export const MsmeProjectSpendSchema = z.object({
  id: z.string().uuid(),
  tierId: z.string().uuid(),
  projectId: z.string().uuid(),
  amount: z.number().positive(),
  merchant: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  note: z.string().max(300).nullable().optional(),
  createdAt: z.string().datetime(),
});
export type MsmeProjectSpend = z.infer<typeof MsmeProjectSpendSchema>;

export const ExcessPromptStatusSchema = z.enum(['pending', 'resolved', 'dismissed']);
export type ExcessPromptStatus = z.infer<typeof ExcessPromptStatusSchema>;

export const ExcessPromptTargetSchema = z.enum(['needs', 'wants', 'savings', 'keep']);
export type ExcessPromptTarget = z.infer<typeof ExcessPromptTargetSchema>;

export const MsmeProjectExcessPromptSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  incomeEventId: z.string().uuid(),
  excessAmount: z.number().positive(),
  chosenTarget: ExcessPromptTargetSchema.nullable().optional(),
  status: ExcessPromptStatusSchema,
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable().optional(),
});
export type MsmeProjectExcessPrompt = z.infer<typeof MsmeProjectExcessPromptSchema>;

export const ExcessResolveInputSchema = z.object({
  chosenTarget: ExcessPromptTargetSchema,
  // §21:525 — moving excess to Savings requires explicit second confirmation.
  confirmSavings: z.boolean().optional(),
});
export type ExcessResolveInput = z.infer<typeof ExcessResolveInputSchema>;

export const SpendControlsUpdateInputSchema = SpendingControlsSchema.partial();
export type SpendControlsUpdateInput = z.infer<typeof SpendControlsUpdateInputSchema>;

export const ProjectCompleteResultSchema = z.object({
  project: ProjectSummarySchema,
  remainingPerTier: z.array(z.object({
    tier: FundingTierSchema,
    remainingCash: z.number().nonnegative(),
    targetAmount: z.number(),
    allocatedAmount: z.number(),
  })),
  totalRemaining: z.number().nonnegative(),
  suggestion: z.string(),
  requiresResolution: z.boolean(),
});
export type ProjectCompleteResult = z.infer<typeof ProjectCompleteResultSchema>;

export const ProjectCompletionResolveInputSchema = z.object({
  target: z.enum(['savings', 'keep']),
  confirmSavings: z.boolean().optional(),
});
export type ProjectCompletionResolveInput = z.infer<typeof ProjectCompletionResolveInputSchema>;

export const ProjectSpendInputSchema = z.object({
  tierId: z.string().uuid(),
  amount: z.number().positive(),
  merchant: z.string().min(1).max(100).optional(),
  category: z.string().max(100).optional(),
  note: z.string().max(300).optional(),
  // §20 — bypass Wants lock when user confirms risky spend.
  confirmRisky: z.boolean().optional(),
});
export type ProjectSpendInput = z.infer<typeof ProjectSpendInputSchema>;

// ============================================================================
// MSME Invoicing & Receivables (020_msme_invoices.sql) — eTIMS-ready
// ============================================================================

export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'void']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const EtimsStatusSchema = z.enum(['pending', 'submitted', 'accepted']);
export type EtimsStatus = z.infer<typeof EtimsStatusSchema>;

// KRA PIN: A + 9 digits + A (e.g. P051234567A) — 11 chars, uppercase.
export const KraPinSchema = z.string().regex(/^[A-Z][0-9]{9}[A-Z]$/, {
  message: 'KRA PIN must be 11 characters: letter + 9 digits + letter (e.g. P051234567A)',
});
export type KraPin = z.infer<typeof KraPinSchema>;

// Draft/sent invoice creation — amount >0, due_date is ISO date, pin optional but validated when present.
export const InvoiceCreateInputSchema = z.object({
  customerName: z.string().min(1).max(100),
  customerPin: KraPinSchema.optional().nullable(),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'dueDate must be YYYY-MM-DD' }),
  description: z.string().max(200).optional().nullable(),
});
export type InvoiceCreateInput = z.infer<typeof InvoiceCreateInputSchema>;

// PATCH /msme/invoices/:id — partial update; status transitions validated in service, not here.
export const InvoiceUpdateInputSchema = z.object({
  customerName: z.string().min(1).max(100).optional(),
  customerPin: KraPinSchema.optional().nullable(),
  amount: z.number().positive().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(200).optional().nullable(),
  status: InvoiceStatusSchema.optional(),
  etimsStatus: EtimsStatusSchema.optional().nullable(),
});
export type InvoiceUpdateInput = z.infer<typeof InvoiceUpdateInputSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  customerName: z.string().min(1).max(100),
  customerPin: KraPinSchema.nullable().optional(),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: InvoiceStatusSchema,
  description: z.string().max(200).nullable().optional(),
  etimsStatus: EtimsStatusSchema.nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  voidedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Derived, not stored — overdue is dueDate < today AND status in draft/sent
  isOverdue: z.boolean().optional(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

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
  // Which segment this assignment targets (individual assign flows omit it;
  // MSME always sets 'msme' — see assignMsmePlan).
  segment: SegmentSchema.optional(),
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
  categoryPercentages: z.record(z.string(), z.number().min(0).max(100)),
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
  // Reserve-based runway fields
  discretionaryReserve: z.number().nonnegative().optional(),
  fixedObligations: z.number().nonnegative().optional(),
  dailyBudget: z.number().nonnegative().optional(),
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
  // 'individual' (default, keeps existing behavior) | 'msme' (ADR-001 §5.1)
  segment: SegmentSchema.optional(),
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
  // Which segment owns this pocket ('individual' default | 'msme'), derived
  // from the plan — not stored on the pocket — for client filtering (§6.1).
  segment: SegmentSchema.optional(),
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
  // Source of truth for a sub-pocket's share of its parent
  // (010_sub_pocket_split_percentage.sql / SUB_POCKET_SPLITS.md).
  // Undefined/null for top-level pockets. `monthlyAllocation` above is
  // kept in sync as a derived cache whenever the parent's allocation
  // changes — see pockets.service.ts recomputeSubPocketAllocations.
  splitPercentage: z.number().positive().max(100).nullable().optional(),
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
 *  Loan pocket's purpose sub-pockets can each have their own category.
 *
 *  `splitPercentage` (not a flat KSh amount) is the share of the parent's
 *  allocation this sub-pocket claims going forward — see
 *  010_sub_pocket_split_percentage.sql. Combined with existing siblings it
 *  must not exceed 100; enforced in pockets.service.ts, which needs
 *  sibling context a schema alone can't see. */
export const SubPocketCreateInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: PocketCategorySchema.optional(),
  splitPercentage: z.number().positive().max(100),
});
export type SubPocketCreateInput = z.infer<typeof SubPocketCreateInputSchema>;

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
export const SubPocketRebalanceInputSchema = z.object({
  splits: z
    .array(
      z.object({
        pocketId: z.string().uuid(),
        splitPercentage: z.number().positive().max(100),
      }),
    )
    .min(1),
  confirmPartial: z.boolean().optional().default(false),
});
export type SubPocketRebalanceInput = z.infer<typeof SubPocketRebalanceInputSchema>;

// ============================================================================
// Emergency Unlock Schemas - runway-impact model for freelancers
// ============================================================================

export const EmergencyUnlockEligibilityReasonSchema = z.enum([
  'not_freelancer_plan',
  'insufficient_history',
  'monthly_limit_reached',
  'no_discretionary_runway',
  'reserve_protected',
]);
export type EmergencyUnlockEligibilityReason = z.infer<typeof EmergencyUnlockEligibilityReasonSchema>;

export const RunwayImpactOptionSchema = z.object({
  emergency_amount: z.number().positive(),
  runway_days_before: z.number().nonnegative(),
  runway_days_after: z.number().nonnegative(),
  runway_reduction_days: z.number().nonnegative(),
});
export type RunwayImpactOption = z.infer<typeof RunwayImpactOptionSchema>;

export const SpendingAnalysisSchema = z.object({
  least_daily_spend: z.number().nonnegative(),
  most_daily_spend: z.number().nonnegative(),
  average_daily_spend: z.number().nonnegative(),
  days_of_history: z.number().int().nonnegative(),
});
export type SpendingAnalysis = z.infer<typeof SpendingAnalysisSchema>;

export const DiscretionaryRunwaySchema = z.object({
  total_reserve: z.number().nonnegative(),
  fixed_obligations: z.number().nonnegative(),
  discretionary_reserve: z.number().nonnegative(),
  daily_budget: z.number().nonnegative(),
  runway_days: z.number().nonnegative(),
});
export type DiscretionaryRunway = z.infer<typeof DiscretionaryRunwaySchema>;

export const EmergencyUnlockEligibilityResponseSchema = z.object({
  eligible: z.boolean(),
  reason: EmergencyUnlockEligibilityReasonSchema.optional(),
  message: z.string().optional(),
  analysis: SpendingAnalysisSchema.optional(),
  discretionary_runway: DiscretionaryRunwaySchema.optional(),
  // Pre-calculated options for the UI slider
  runway_impact_options: z.array(RunwayImpactOptionSchema).optional(),
  last_used: z.string().datetime().optional(),
  next_available: z.string().datetime().optional(),
});
export type EmergencyUnlockEligibilityResponse = z.infer<typeof EmergencyUnlockEligibilityResponseSchema>;

export const EmergencyUnlockRequestSchema = z.object({
  amount: z.number().positive(),
  confirm_impact: z.boolean(),
});
export type EmergencyUnlockRequest = z.infer<typeof EmergencyUnlockRequestSchema>;

export const EmergencyUnlockAllocationSchema = z.object({
  pocket_id: z.string().uuid(),
  pocket_name: z.string(),
  amount: z.number().positive(),
  percentage: z.number().nonnegative(),
});
export type EmergencyUnlockAllocation = z.infer<typeof EmergencyUnlockAllocationSchema>;

export const EmergencyUnlockResponseSchema = z.object({
  applied: z.boolean(),
  unlock: z.object({
    id: z.string().uuid(),
    amount: z.number().positive(),
    runway_days_before: z.number().nonnegative(),
    runway_days_after: z.number().nonnegative(),
    runway_reduction_days: z.number().nonnegative(),
    allocations: z.array(EmergencyUnlockAllocationSchema),
  }).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  next_available: z.string().datetime().optional(),
});
export type EmergencyUnlockResponse = z.infer<typeof EmergencyUnlockResponseSchema>;

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
  splitPercentage: z.number().min(0).max(100),
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
  // Daily allocation linkage (migration 013)
  dailyAllocationId: z.string().uuid().nullable().optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export type TransactionInsert = Omit<Transaction, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
  pocket_id: string;
  amount: number;
  type: TransactionType;
  merchant?: string | null;
  category?: MerchantCategory | null;
  emergency_unlock_id?: string | null;
  daily_allocation_id?: string | null;
};

// ============================================================================
// Daily Allocation Schema (migration 013)
// ============================================================================

export const DailyAllocationSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  userId: z.string().uuid(),
  allocationDate: z.string().date(),
  plannedAmount: z.number().nonnegative(),
  actualSpend: z.number().nonnegative(),
  returnedAmount: z.number().nonnegative(),
  overspendAmount: z.number().nonnegative(),
  runwayDaysAtOpen: z.number().nonnegative().nullable().optional(),
  runwayDaysAtClose: z.number().nonnegative().nullable().optional(),
  status: z.enum(['open', 'closed']),
  createdAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable().optional(),
});
export type DailyAllocation = z.infer<typeof DailyAllocationSchema>;

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
  Segment: SegmentSchema,
  PocketKind: PocketKindSchema,
  PocketCategory: PocketCategorySchema,
  BusinessPocketCategory: BusinessPocketCategorySchema,
  MSME_SPENDABLE_LABELS,
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
  SPENDABLE_CATEGORY_LABELS,
  CategoryPercentages: CategoryPercentagesSchema,
  IncomeConcentration: IncomeConcentrationSchema,
  OnboardingInput: OnboardingInputSchema,
  MsmeOnboardingInput: MsmeOnboardingInputSchema,
  BusinessStage: BusinessStageSchema,
  MsmePocketInput: MsmePocketInputSchema,
  ProjectKind: ProjectKindSchema,
  FundingTier: FundingTierSchema,
  FundingStatus: FundingStatusSchema,
  ProjectStatus: ProjectStatusSchema,
  ProjectCreateInput: ProjectCreateInputSchema,
  ProjectIncomeInput: ProjectIncomeInputSchema,
  TierSummary: TierSummarySchema,
  ProjectSummary: ProjectSummarySchema,
  SpendingControls: SpendingControlsSchema,
  ExcessResolveInput: ExcessResolveInputSchema,
  SpendControlsUpdateInput: SpendControlsUpdateInputSchema,
  ProjectCompleteResult: ProjectCompleteResultSchema,
  ProjectCompletionResolveInput: ProjectCompletionResolveInputSchema,
  ProjectSpendInput: ProjectSpendInputSchema,
  MsmeProject: MsmeProjectSchema,
  MsmeProjectTier: MsmeProjectTierSchema,
  MsmeProjectIncomeEvent: MsmeProjectIncomeEventSchema,
  MsmeProjectAllocation: MsmeProjectAllocationSchema,
  MsmeProjectSpend: MsmeProjectSpendSchema,
  ExcessPromptStatus: ExcessPromptStatusSchema,
  ExcessPromptTarget: ExcessPromptTargetSchema,
  MsmeProjectExcessPrompt: MsmeProjectExcessPromptSchema,
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
  SubPocketRebalanceInput: SubPocketRebalanceInputSchema,
  EmergencyUnlockEligibilityResponse: EmergencyUnlockEligibilityResponseSchema,
  EmergencyUnlockRequest: EmergencyUnlockRequestSchema,
  EmergencyUnlockResponse: EmergencyUnlockResponseSchema,
  RunwayImpactOption: RunwayImpactOptionSchema,
  DiscretionaryRunway: DiscretionaryRunwaySchema,
  EmergencyUnlockEligibilityReason: EmergencyUnlockEligibilityReasonSchema,
  RepaymentCadence: RepaymentCadenceSchema,
  RepaymentSchedule: RepaymentScheduleSchema,
  LoanCreateInput: LoanCreateInputSchema,
  LoanUpdateInput: LoanUpdateInputSchema,
  LoanPurposePocketInput: LoanPurposePocketInputSchema,
  LoanDetail: LoanDetailSchema,
  FixedExpense: FixedExpenseSchema,
  IncomeEvent: IncomeEventSchema,
  Transaction: TransactionSchema,
  DailyAllocation: DailyAllocationSchema,
  Reallocation: ReallocationSchema,
  ReallocationInput: ReallocationInputSchema,
  ReallocationCompleteInput: ReallocationCompleteInputSchema,
  MerchantClassification: MerchantClassificationSchema,
  BehaviorEvent: BehaviorEventSchema,
  DisciplineScore: DisciplineScoreSchema,
  InvoiceStatus: InvoiceStatusSchema,
  EtimsStatus: EtimsStatusSchema,
  KraPin: KraPinSchema,
  InvoiceCreateInput: InvoiceCreateInputSchema,
  InvoiceUpdateInput: InvoiceUpdateInputSchema,
  Invoice: InvoiceSchema,
};