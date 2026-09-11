import { z } from 'zod';
export declare const PlanTypeSchema: z.ZodEnum<["structured", "daily"]>;
export type PlanType = z.infer<typeof PlanTypeSchema>;
export declare const SegmentSchema: z.ZodEnum<["individual", "msme"]>;
export type Segment = z.infer<typeof SegmentSchema>;
export declare const PocketKindSchema: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
export type PocketKind = z.infer<typeof PocketKindSchema>;
export declare const BusinessPocketCategorySchema: z.ZodEnum<["stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment"]>;
export type BusinessPocketCategory = z.infer<typeof BusinessPocketCategorySchema>;
export declare const PocketCategorySchema: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
export type PocketCategory = z.infer<typeof PocketCategorySchema>;
export declare const IncomePatternSchema: z.ZodEnum<["salaried", "freelancer", "mix"]>;
export type IncomePattern = z.infer<typeof IncomePatternSchema>;
export declare const IncomeIntervalBandSchema: z.ZodEnum<["weekly", "biweekly", "monthly", "irregular"]>;
export type IncomeIntervalBand = z.infer<typeof IncomeIntervalBandSchema>;
export declare const IncomeIntervalDaysByBand: Record<IncomeIntervalBand, number>;
export declare const SpendingHabitSchema: z.ZodEnum<["tracker", "week3", "off_guard"]>;
export type SpendingHabit = z.infer<typeof SpendingHabitSchema>;
export declare const PlanNameSchema: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Daily Budget", "Gig — Daily Budget", "Salaried + Side Income — Structured", "Salaried + Side Income — Daily Budget", "Business — Structured"]>;
export type PlanName = z.infer<typeof PlanNameSchema>;
export declare const IncomeConcentrationSchema: z.ZodEnum<["concentrated", "diversified"]>;
export type IncomeConcentration = z.infer<typeof IncomeConcentrationSchema>;
export declare const TransactionTypeSchema: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover", "reserve_release", "reserve_return", "daily_overspend_debit", "fixed_expense_earmark", "fixed_expense_carry_forward"]>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export declare const ReallocationStatusSchema: z.ZodEnum<["pending", "cooling_off", "completed", "skipped"]>;
export type ReallocationStatus = z.infer<typeof ReallocationStatusSchema>;
export declare const ReallocationReasonSchema: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
export type ReallocationReason = z.infer<typeof ReallocationReasonSchema>;
export declare const MerchantCategorySchema: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
export type MerchantCategory = z.infer<typeof MerchantCategorySchema>;
export declare const PlanStatusSchema: z.ZodEnum<["active", "inactive", "reassigned"]>;
export type PlanStatus = z.infer<typeof PlanStatusSchema>;
export declare const LifeStageSchema: z.ZodEnum<["student", "working_adult", "self_employed"]>;
export type LifeStage = z.infer<typeof LifeStageSchema>;
export declare const EmergencyBufferSchema: z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>;
export type EmergencyBuffer = z.infer<typeof EmergencyBufferSchema>;
/** Behavioral self-check — modifier layer, not a plan-type driver (§2.3). */
export declare const MoneyPersonalitySchema: z.ZodEnum<["spender", "saver", "avoider"]>;
export type MoneyPersonality = z.infer<typeof MoneyPersonalitySchema>;
export declare const NeedsBandSchema: z.ZodEnum<["high", "mid", "low"]>;
export type NeedsBand = z.infer<typeof NeedsBandSchema>;
export declare const SpendableCategorySchema: z.ZodEnum<["food", "transport", "leisure", "family"]>;
export type SpendableCategory = z.infer<typeof SpendableCategorySchema>;
/**
 * User-friendly labels for spendable categories.
 * These are the only categories that can appear for spendable pockets
 * (see pocket-provisioning.ts). Other categories like 'grocery', 'healthcare',
 * etc. are merchant classification categories, not spendable pocket categories.
 */
export declare const MSME_SPENDABLE_LABELS: {
    readonly stock: "Stock & Inventory";
    readonly supplier: "Suppliers";
    readonly licence: "Licences";
    readonly tax: "Taxes";
    readonly salary: "Salaries & Wages";
    readonly rent: "Rent";
    readonly operations: "Operations";
    readonly profit: "Profit";
    readonly owner_draw: "Owner Draw";
    readonly growth: "Growth";
    readonly marketing: "Marketing";
    readonly equipment: "Equipment";
};
export declare const SPENDABLE_CATEGORY_LABELS: {
    readonly stock: "Stock & Inventory";
    readonly supplier: "Suppliers";
    readonly licence: "Licences";
    readonly tax: "Taxes";
    readonly salary: "Salaries & Wages";
    readonly rent: "Rent";
    readonly operations: "Operations";
    readonly profit: "Profit";
    readonly owner_draw: "Owner Draw";
    readonly growth: "Growth";
    readonly marketing: "Marketing";
    readonly equipment: "Equipment";
    readonly food: "Food & Groceries";
    readonly transport: "Transport";
    readonly leisure: "Personal & Leisure";
    readonly family: "Family & Dependents";
};
export declare const CategoryPercentagesSchema: z.ZodRecord<z.ZodString, z.ZodNumber>;
export type CategoryPercentages = z.infer<typeof CategoryPercentagesSchema>;
export declare const SavingsGoalTypeSchema: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
export type SavingsGoalType = z.infer<typeof SavingsGoalTypeSchema>;
export declare const SavingsGoalTimeframeSchema: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
export type SavingsGoalTimeframe = z.infer<typeof SavingsGoalTimeframeSchema>;
export declare const SavingsGoalTimeframeMonths: Record<SavingsGoalTimeframe, number>;
export declare const SavingsGoalLockDays: Record<SavingsGoalTimeframe, number>;
export declare const SavingsGoalInputSchema: z.ZodObject<{
    goalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
    goalLabel: z.ZodOptional<z.ZodString>;
    goalAmount: z.ZodOptional<z.ZodNumber>;
    goalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
}, "strip", z.ZodTypeAny, {
    goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
    goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
    goalLabel?: string | undefined;
    goalAmount?: number | undefined;
}, {
    goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
    goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
    goalLabel?: string | undefined;
    goalAmount?: number | undefined;
}>;
export type SavingsGoalInput = z.infer<typeof SavingsGoalInputSchema>;
export declare const FixedExpenseInputSchema: z.ZodObject<{
    name: z.ZodString;
    amount: z.ZodNumber;
    dueDay: z.ZodNumber;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
    frequency: z.ZodOptional<z.ZodEnum<["monthly", "weekly", "daily"]>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    amount: number;
    dueDay: number;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    frequency?: "daily" | "weekly" | "monthly" | undefined;
}, {
    name: string;
    amount: number;
    dueDay: number;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    frequency?: "daily" | "weekly" | "monthly" | undefined;
}>;
export type FixedExpenseInput = z.infer<typeof FixedExpenseInputSchema>;
export declare const OnboardingInputSchema: z.ZodObject<{
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    spendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
    incomeAmount: z.ZodNumber;
    fixedTotal: z.ZodNumber;
    sourceCount: z.ZodNumber;
    fixedExpenses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        amount: z.ZodNumber;
        dueDay: z.ZodNumber;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
        frequency: z.ZodOptional<z.ZodEnum<["monthly", "weekly", "daily"]>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }, {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }>, "many">>;
    incomeIntervalBand: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly", "irregular"]>>;
    lifeStage: z.ZodOptional<z.ZodEnum<["student", "working_adult", "self_employed"]>>;
    hasDependents: z.ZodOptional<z.ZodBoolean>;
    emergencyBuffer: z.ZodOptional<z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>>;
    moneyPersonality: z.ZodOptional<z.ZodEnum<["spender", "saver", "avoider"]>>;
    hasTransportNeed: z.ZodOptional<z.ZodBoolean>;
    savingsGoal: z.ZodOptional<z.ZodObject<{
        goalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
        goalLabel: z.ZodOptional<z.ZodString>;
        goalAmount: z.ZodOptional<z.ZodNumber>;
        goalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
    }, "strip", z.ZodTypeAny, {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    }, {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    }>>;
    categoryPercentages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    incomePattern: "salaried" | "freelancer" | "mix";
    spendingHabit: "tracker" | "week3" | "off_guard";
    incomeAmount: number;
    fixedTotal: number;
    sourceCount: number;
    fixedExpenses?: {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }[] | undefined;
    incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
    lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
    hasDependents?: boolean | undefined;
    emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
    moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
    hasTransportNeed?: boolean | undefined;
    savingsGoal?: {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    } | undefined;
    categoryPercentages?: Record<string, number> | undefined;
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    spendingHabit: "tracker" | "week3" | "off_guard";
    incomeAmount: number;
    fixedTotal: number;
    sourceCount: number;
    fixedExpenses?: {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }[] | undefined;
    incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
    lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
    hasDependents?: boolean | undefined;
    emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
    moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
    hasTransportNeed?: boolean | undefined;
    savingsGoal?: {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    } | undefined;
    categoryPercentages?: Record<string, number> | undefined;
}>;
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
export declare const BusinessStageSchema: z.ZodEnum<["starting", "stable", "growing"]>;
export type BusinessStage = z.infer<typeof BusinessStageSchema>;
export declare const MsmePocketInputSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
    percentage: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    percentage?: number | undefined;
}, {
    name: string;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    percentage?: number | undefined;
}>;
export type MsmePocketInput = z.infer<typeof MsmePocketInputSchema>;
export declare const MsmeOnboardingInputSchema: z.ZodObject<{
    segment: z.ZodLiteral<"msme">;
    businessName: z.ZodString;
    monthlyRevenue: z.ZodNumber;
    fixedTotal: z.ZodNumber;
    fixedExpenses: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        amount: z.ZodNumber;
        dueDay: z.ZodNumber;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
        frequency: z.ZodOptional<z.ZodEnum<["monthly", "weekly", "daily"]>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }, {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }>, "many">>;
    hasEmployees: z.ZodOptional<z.ZodBoolean>;
    businessStage: z.ZodOptional<z.ZodEnum<["starting", "stable", "growing"]>>;
    savingsGoal: z.ZodOptional<z.ZodObject<{
        goalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
        goalLabel: z.ZodOptional<z.ZodString>;
        goalAmount: z.ZodOptional<z.ZodNumber>;
        goalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
    }, "strip", z.ZodTypeAny, {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    }, {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    }>>;
    customPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
        percentage: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        percentage?: number | undefined;
    }, {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        percentage?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    fixedTotal: number;
    segment: "msme";
    businessName: string;
    monthlyRevenue: number;
    fixedExpenses?: {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }[] | undefined;
    savingsGoal?: {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    } | undefined;
    hasEmployees?: boolean | undefined;
    businessStage?: "starting" | "stable" | "growing" | undefined;
    customPockets?: {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        percentage?: number | undefined;
    }[] | undefined;
}, {
    fixedTotal: number;
    segment: "msme";
    businessName: string;
    monthlyRevenue: number;
    fixedExpenses?: {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        frequency?: "daily" | "weekly" | "monthly" | undefined;
    }[] | undefined;
    savingsGoal?: {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    } | undefined;
    hasEmployees?: boolean | undefined;
    businessStage?: "starting" | "stable" | "growing" | undefined;
    customPockets?: {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        percentage?: number | undefined;
    }[] | undefined;
}>;
export type MsmeOnboardingInput = z.infer<typeof MsmeOnboardingInputSchema>;
export declare const ProjectKindSchema: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
export type ProjectKind = z.infer<typeof ProjectKindSchema>;
export declare const FundingTierSchema: z.ZodEnum<["priorities", "needs", "wants"]>;
export type FundingTier = z.infer<typeof FundingTierSchema>;
export declare const FundingStatusSchema: z.ZodEnum<["in_progress", "complete"]>;
export type FundingStatus = z.infer<typeof FundingStatusSchema>;
export declare const ProjectStatusSchema: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export declare const TierSubPocketInputSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    targetAmount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    targetAmount: number;
    id?: string | undefined;
}, {
    name: string;
    targetAmount: number;
    id?: string | undefined;
}>;
export type TierSubPocketInput = z.infer<typeof TierSubPocketInputSchema>;
export declare const TierSubPocketSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    targetAmount: z.ZodNumber;
    allocatedAmount: z.ZodNumber;
    spentAmount: z.ZodNumber;
    remainingCash: z.ZodNumber;
    fundingPercent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingPercent: number;
}, {
    name: string;
    id: string;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingPercent: number;
}>;
export type TierSubPocketSummary = z.infer<typeof TierSubPocketSummarySchema>;
export declare const ProjectCreateInputSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
    contractValue: z.ZodNumber;
    tiers: z.ZodEffects<z.ZodObject<{
        priorities: z.ZodNumber;
        needs: z.ZodNumber;
        wants: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        priorities: number;
        needs: number;
        wants: number;
    }, {
        priorities: number;
        needs: number;
        wants: number;
    }>, {
        priorities: number;
        needs: number;
        wants: number;
    }, {
        priorities: number;
        needs: number;
        wants: number;
    }>;
    subPockets: z.ZodOptional<z.ZodObject<{
        priorities: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            targetAmount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }, {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }>, "many">>;
        needs: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            targetAmount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }, {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }>, "many">>;
        wants: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            name: z.ZodString;
            targetAmount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }, {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        priorities?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        needs?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        wants?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
    }, {
        priorities?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        needs?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        wants?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    tiers: {
        priorities: number;
        needs: number;
        wants: number;
    };
    subPockets?: {
        priorities?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        needs?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        wants?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
    } | undefined;
}, {
    name: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    tiers: {
        priorities: number;
        needs: number;
        wants: number;
    };
    subPockets?: {
        priorities?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        needs?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        wants?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
    } | undefined;
}>, {
    name: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    tiers: {
        priorities: number;
        needs: number;
        wants: number;
    };
    subPockets?: {
        priorities?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        needs?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        wants?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
    } | undefined;
}, {
    name: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    tiers: {
        priorities: number;
        needs: number;
        wants: number;
    };
    subPockets?: {
        priorities?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        needs?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
        wants?: {
            name: string;
            targetAmount: number;
            id?: string | undefined;
        }[] | undefined;
    } | undefined;
}>;
export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>;
export declare const ProjectIncomeInputSchema: z.ZodObject<{
    amount: z.ZodNumber;
    source: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    date: string;
    source: string;
    label?: string | undefined;
}, {
    amount: number;
    date: string;
    source: string;
    label?: string | undefined;
}>;
export type ProjectIncomeInput = z.infer<typeof ProjectIncomeInputSchema>;
export declare const TierSummarySchema: z.ZodObject<{
    id: z.ZodString;
    tier: z.ZodEnum<["priorities", "needs", "wants"]>;
    sortOrder: z.ZodNumber;
    targetAmount: z.ZodNumber;
    allocatedAmount: z.ZodNumber;
    spentAmount: z.ZodNumber;
    remainingCash: z.ZodNumber;
    fundingStatus: z.ZodEnum<["in_progress", "complete"]>;
    fundingPercent: z.ZodNumber;
    subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        targetAmount: z.ZodNumber;
        allocatedAmount: z.ZodNumber;
        spentAmount: z.ZodNumber;
        remainingCash: z.ZodNumber;
        fundingPercent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
    }, {
        name: string;
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingPercent: number;
    tier: "priorities" | "needs" | "wants";
    sortOrder: number;
    fundingStatus: "in_progress" | "complete";
    subPockets?: {
        name: string;
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
    }[] | undefined;
}, {
    id: string;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingCash: number;
    fundingPercent: number;
    tier: "priorities" | "needs" | "wants";
    sortOrder: number;
    fundingStatus: "in_progress" | "complete";
    subPockets?: {
        name: string;
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
    }[] | undefined;
}>;
export type TierSummary = z.infer<typeof TierSummarySchema>;
export declare const SpendingControlsSchema: z.ZodObject<{
    lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
    warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    lockWantsUntilPrioritiesAndNeedsFunded: boolean;
    warnOnLowPrioritySpend: boolean;
}, {
    lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
    warnOnLowPrioritySpend?: boolean | undefined;
}>;
export type SpendingControls = z.infer<typeof SpendingControlsSchema>;
export declare const ProjectSummarySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
    contractValue: z.ZodNumber;
    status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
    isActiveCascade: z.ZodBoolean;
    spendingControls: z.ZodOptional<z.ZodObject<{
        lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
        warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        lockWantsUntilPrioritiesAndNeedsFunded: boolean;
        warnOnLowPrioritySpend: boolean;
    }, {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    }>>;
    completionResolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionResolvedTo: z.ZodOptional<z.ZodNullable<z.ZodEnum<["savings", "keep"]>>>;
    tiers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tier: z.ZodEnum<["priorities", "needs", "wants"]>;
        sortOrder: z.ZodNumber;
        targetAmount: z.ZodNumber;
        allocatedAmount: z.ZodNumber;
        spentAmount: z.ZodNumber;
        remainingCash: z.ZodNumber;
        fundingStatus: z.ZodEnum<["in_progress", "complete"]>;
        fundingPercent: z.ZodNumber;
        subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            targetAmount: z.ZodNumber;
            allocatedAmount: z.ZodNumber;
            spentAmount: z.ZodNumber;
            remainingCash: z.ZodNumber;
            fundingPercent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }, {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        fundingStatus: "in_progress" | "complete";
        subPockets?: {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }[] | undefined;
    }, {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        fundingStatus: "in_progress" | "complete";
        subPockets?: {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }[] | undefined;
    }>, "many">;
    nextIncomeGoesTo: z.ZodNullable<z.ZodEnum<["priorities", "needs", "wants"]>>;
    totalAllocated: z.ZodNumber;
    totalSpent: z.ZodNumber;
    totalRemaining: z.ZodNumber;
    excessPending: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "active" | "draft" | "cancelled";
    name: string;
    id: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    tiers: {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        fundingStatus: "in_progress" | "complete";
        subPockets?: {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }[] | undefined;
    }[];
    isActiveCascade: boolean;
    nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    excessPending: number | null;
    spendingControls?: {
        lockWantsUntilPrioritiesAndNeedsFunded: boolean;
        warnOnLowPrioritySpend: boolean;
    } | undefined;
    completionResolvedAt?: string | null | undefined;
    completionResolvedTo?: "savings" | "keep" | null | undefined;
}, {
    status: "completed" | "active" | "draft" | "cancelled";
    name: string;
    id: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    tiers: {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        fundingStatus: "in_progress" | "complete";
        subPockets?: {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }[] | undefined;
    }[];
    isActiveCascade: boolean;
    nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    excessPending: number | null;
    spendingControls?: {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    } | undefined;
    completionResolvedAt?: string | null | undefined;
    completionResolvedTo?: "savings" | "keep" | null | undefined;
}>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export declare const MsmeProjectSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    planId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
    contractValue: z.ZodNumber;
    status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
    isActiveCascade: z.ZodBoolean;
    spendingControls: z.ZodOptional<z.ZodObject<{
        lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
        warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        lockWantsUntilPrioritiesAndNeedsFunded: boolean;
        warnOnLowPrioritySpend: boolean;
    }, {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    }>>;
    completionResolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    completionResolvedTo: z.ZodOptional<z.ZodNullable<z.ZodEnum<["savings", "keep"]>>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "active" | "draft" | "cancelled";
    name: string;
    id: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    isActiveCascade: boolean;
    userId: string;
    planId: string;
    createdAt: string;
    updatedAt: string;
    spendingControls?: {
        lockWantsUntilPrioritiesAndNeedsFunded: boolean;
        warnOnLowPrioritySpend: boolean;
    } | undefined;
    completionResolvedAt?: string | null | undefined;
    completionResolvedTo?: "savings" | "keep" | null | undefined;
    completedAt?: string | null | undefined;
    cancelledAt?: string | null | undefined;
}, {
    status: "completed" | "active" | "draft" | "cancelled";
    name: string;
    id: string;
    kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
    contractValue: number;
    isActiveCascade: boolean;
    userId: string;
    planId: string;
    createdAt: string;
    updatedAt: string;
    spendingControls?: {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    } | undefined;
    completionResolvedAt?: string | null | undefined;
    completionResolvedTo?: "savings" | "keep" | null | undefined;
    completedAt?: string | null | undefined;
    cancelledAt?: string | null | undefined;
}>;
export type MsmeProject = z.infer<typeof MsmeProjectSchema>;
export declare const MsmeProjectTierSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    tier: z.ZodEnum<["priorities", "needs", "wants"]>;
    sortOrder: z.ZodNumber;
    targetAmount: z.ZodNumber;
    allocatedAmount: z.ZodNumber;
    spentAmount: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    tier: "priorities" | "needs" | "wants";
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    projectId: string;
}, {
    id: string;
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    tier: "priorities" | "needs" | "wants";
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    projectId: string;
}>;
export type MsmeProjectTier = z.infer<typeof MsmeProjectTierSchema>;
export declare const MsmeProjectIncomeEventSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    userId: z.ZodString;
    amount: z.ZodNumber;
    source: z.ZodString;
    label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    date: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    date: string;
    id: string;
    source: string;
    userId: string;
    createdAt: string;
    projectId: string;
    label?: string | null | undefined;
}, {
    amount: number;
    date: string;
    id: string;
    source: string;
    userId: string;
    createdAt: string;
    projectId: string;
    label?: string | null | undefined;
}>;
export type MsmeProjectIncomeEvent = z.infer<typeof MsmeProjectIncomeEventSchema>;
export declare const MsmeProjectAllocationSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    tierId: z.ZodString;
    incomeEventId: z.ZodString;
    amount: z.ZodNumber;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    id: string;
    createdAt: string;
    projectId: string;
    tierId: string;
    incomeEventId: string;
}, {
    amount: number;
    id: string;
    createdAt: string;
    projectId: string;
    tierId: string;
    incomeEventId: string;
}>;
export type MsmeProjectAllocation = z.infer<typeof MsmeProjectAllocationSchema>;
export declare const MsmeProjectSpendSchema: z.ZodObject<{
    id: z.ZodString;
    tierId: z.ZodString;
    projectId: z.ZodString;
    amount: z.ZodNumber;
    merchant: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    id: string;
    createdAt: string;
    projectId: string;
    tierId: string;
    category?: string | null | undefined;
    merchant?: string | null | undefined;
    note?: string | null | undefined;
}, {
    amount: number;
    id: string;
    createdAt: string;
    projectId: string;
    tierId: string;
    category?: string | null | undefined;
    merchant?: string | null | undefined;
    note?: string | null | undefined;
}>;
export type MsmeProjectSpend = z.infer<typeof MsmeProjectSpendSchema>;
export declare const ExcessPromptStatusSchema: z.ZodEnum<["pending", "resolved", "dismissed"]>;
export type ExcessPromptStatus = z.infer<typeof ExcessPromptStatusSchema>;
export declare const ExcessPromptTargetSchema: z.ZodEnum<["needs", "wants", "savings", "keep"]>;
export type ExcessPromptTarget = z.infer<typeof ExcessPromptTargetSchema>;
export declare const MsmeProjectExcessPromptSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    incomeEventId: z.ZodString;
    excessAmount: z.ZodNumber;
    chosenTarget: z.ZodOptional<z.ZodNullable<z.ZodEnum<["needs", "wants", "savings", "keep"]>>>;
    status: z.ZodEnum<["pending", "resolved", "dismissed"]>;
    createdAt: z.ZodString;
    resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "resolved" | "dismissed";
    id: string;
    createdAt: string;
    projectId: string;
    incomeEventId: string;
    excessAmount: number;
    chosenTarget?: "savings" | "needs" | "wants" | "keep" | null | undefined;
    resolvedAt?: string | null | undefined;
}, {
    status: "pending" | "resolved" | "dismissed";
    id: string;
    createdAt: string;
    projectId: string;
    incomeEventId: string;
    excessAmount: number;
    chosenTarget?: "savings" | "needs" | "wants" | "keep" | null | undefined;
    resolvedAt?: string | null | undefined;
}>;
export type MsmeProjectExcessPrompt = z.infer<typeof MsmeProjectExcessPromptSchema>;
export declare const ExcessResolveInputSchema: z.ZodObject<{
    chosenTarget: z.ZodEnum<["needs", "wants", "savings", "keep"]>;
    confirmSavings: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    chosenTarget: "savings" | "needs" | "wants" | "keep";
    confirmSavings?: boolean | undefined;
}, {
    chosenTarget: "savings" | "needs" | "wants" | "keep";
    confirmSavings?: boolean | undefined;
}>;
export type ExcessResolveInput = z.infer<typeof ExcessResolveInputSchema>;
export declare const SpendControlsUpdateInputSchema: z.ZodObject<{
    lockWantsUntilPrioritiesAndNeedsFunded: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    warnOnLowPrioritySpend: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
    warnOnLowPrioritySpend?: boolean | undefined;
}, {
    lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
    warnOnLowPrioritySpend?: boolean | undefined;
}>;
export type SpendControlsUpdateInput = z.infer<typeof SpendControlsUpdateInputSchema>;
export declare const ProjectCompleteResultSchema: z.ZodObject<{
    project: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
        contractValue: z.ZodNumber;
        status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
        isActiveCascade: z.ZodBoolean;
        spendingControls: z.ZodOptional<z.ZodObject<{
            lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
            warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        }, {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        }>>;
        completionResolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completionResolvedTo: z.ZodOptional<z.ZodNullable<z.ZodEnum<["savings", "keep"]>>>;
        tiers: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            tier: z.ZodEnum<["priorities", "needs", "wants"]>;
            sortOrder: z.ZodNumber;
            targetAmount: z.ZodNumber;
            allocatedAmount: z.ZodNumber;
            spentAmount: z.ZodNumber;
            remainingCash: z.ZodNumber;
            fundingStatus: z.ZodEnum<["in_progress", "complete"]>;
            fundingPercent: z.ZodNumber;
            subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                targetAmount: z.ZodNumber;
                allocatedAmount: z.ZodNumber;
                spentAmount: z.ZodNumber;
                remainingCash: z.ZodNumber;
                fundingPercent: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }, {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }, {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }>, "many">;
        nextIncomeGoesTo: z.ZodNullable<z.ZodEnum<["priorities", "needs", "wants"]>>;
        totalAllocated: z.ZodNumber;
        totalSpent: z.ZodNumber;
        totalRemaining: z.ZodNumber;
        excessPending: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }[];
        isActiveCascade: boolean;
        nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
        totalAllocated: number;
        totalSpent: number;
        totalRemaining: number;
        excessPending: number | null;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
    }, {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }[];
        isActiveCascade: boolean;
        nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
        totalAllocated: number;
        totalSpent: number;
        totalRemaining: number;
        excessPending: number | null;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
    }>;
    remainingPerTier: z.ZodArray<z.ZodObject<{
        tier: z.ZodEnum<["priorities", "needs", "wants"]>;
        remainingCash: z.ZodNumber;
        targetAmount: z.ZodNumber;
        allocatedAmount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        targetAmount: number;
        allocatedAmount: number;
        remainingCash: number;
        tier: "priorities" | "needs" | "wants";
    }, {
        targetAmount: number;
        allocatedAmount: number;
        remainingCash: number;
        tier: "priorities" | "needs" | "wants";
    }>, "many">;
    totalRemaining: z.ZodNumber;
    suggestion: z.ZodString;
    requiresResolution: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    totalRemaining: number;
    project: {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }[];
        isActiveCascade: boolean;
        nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
        totalAllocated: number;
        totalSpent: number;
        totalRemaining: number;
        excessPending: number | null;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
    };
    remainingPerTier: {
        targetAmount: number;
        allocatedAmount: number;
        remainingCash: number;
        tier: "priorities" | "needs" | "wants";
    }[];
    suggestion: string;
    requiresResolution: boolean;
}, {
    totalRemaining: number;
    project: {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }[];
        isActiveCascade: boolean;
        nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
        totalAllocated: number;
        totalSpent: number;
        totalRemaining: number;
        excessPending: number | null;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
    };
    remainingPerTier: {
        targetAmount: number;
        allocatedAmount: number;
        remainingCash: number;
        tier: "priorities" | "needs" | "wants";
    }[];
    suggestion: string;
    requiresResolution: boolean;
}>;
export type ProjectCompleteResult = z.infer<typeof ProjectCompleteResultSchema>;
export declare const ProjectCompletionResolveInputSchema: z.ZodObject<{
    target: z.ZodEnum<["savings", "keep"]>;
    confirmSavings: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    target: "savings" | "keep";
    confirmSavings?: boolean | undefined;
}, {
    target: "savings" | "keep";
    confirmSavings?: boolean | undefined;
}>;
export type ProjectCompletionResolveInput = z.infer<typeof ProjectCompletionResolveInputSchema>;
export declare const ProjectSpendInputSchema: z.ZodObject<{
    tierId: z.ZodString;
    subPocketId: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    merchant: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    note: z.ZodOptional<z.ZodString>;
    confirmRisky: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    tierId: string;
    category?: string | undefined;
    merchant?: string | undefined;
    note?: string | undefined;
    subPocketId?: string | undefined;
    confirmRisky?: boolean | undefined;
}, {
    amount: number;
    tierId: string;
    category?: string | undefined;
    merchant?: string | undefined;
    note?: string | undefined;
    subPocketId?: string | undefined;
    confirmRisky?: boolean | undefined;
}>;
export type ProjectSpendInput = z.infer<typeof ProjectSpendInputSchema>;
export declare const InvoiceStatusSchema: z.ZodEnum<["draft", "sent", "paid", "void"]>;
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
export declare const EtimsStatusSchema: z.ZodEnum<["pending", "submitted", "accepted"]>;
export type EtimsStatus = z.infer<typeof EtimsStatusSchema>;
export declare const KraPinSchema: z.ZodString;
export type KraPin = z.infer<typeof KraPinSchema>;
export declare const InvoiceCreateInputSchema: z.ZodObject<{
    customerName: z.ZodString;
    customerPin: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amount: z.ZodNumber;
    dueDate: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    customerName: string;
    dueDate: string;
    customerPin?: string | null | undefined;
    description?: string | null | undefined;
}, {
    amount: number;
    customerName: string;
    dueDate: string;
    customerPin?: string | null | undefined;
    description?: string | null | undefined;
}>;
export type InvoiceCreateInput = z.infer<typeof InvoiceCreateInputSchema>;
export declare const InvoiceUpdateInputSchema: z.ZodObject<{
    customerName: z.ZodOptional<z.ZodString>;
    customerPin: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amount: z.ZodOptional<z.ZodNumber>;
    dueDate: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodEnum<["draft", "sent", "paid", "void"]>>;
    etimsStatus: z.ZodNullable<z.ZodOptional<z.ZodEnum<["pending", "submitted", "accepted"]>>>;
}, "strip", z.ZodTypeAny, {
    status?: "void" | "draft" | "sent" | "paid" | undefined;
    amount?: number | undefined;
    customerName?: string | undefined;
    customerPin?: string | null | undefined;
    dueDate?: string | undefined;
    description?: string | null | undefined;
    etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
}, {
    status?: "void" | "draft" | "sent" | "paid" | undefined;
    amount?: number | undefined;
    customerName?: string | undefined;
    customerPin?: string | null | undefined;
    dueDate?: string | undefined;
    description?: string | null | undefined;
    etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
}>;
export type InvoiceUpdateInput = z.infer<typeof InvoiceUpdateInputSchema>;
export declare const InvoiceSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    planId: z.ZodString;
    customerName: z.ZodString;
    customerPin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    amount: z.ZodNumber;
    dueDate: z.ZodString;
    status: z.ZodEnum<["draft", "sent", "paid", "void"]>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    etimsStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<["pending", "submitted", "accepted"]>>>;
    paidAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    voidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    isOverdue: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    status: "void" | "draft" | "sent" | "paid";
    amount: number;
    id: string;
    userId: string;
    planId: string;
    createdAt: string;
    updatedAt: string;
    customerName: string;
    dueDate: string;
    customerPin?: string | null | undefined;
    description?: string | null | undefined;
    etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
    paidAt?: string | null | undefined;
    voidedAt?: string | null | undefined;
    isOverdue?: boolean | undefined;
}, {
    status: "void" | "draft" | "sent" | "paid";
    amount: number;
    id: string;
    userId: string;
    planId: string;
    createdAt: string;
    updatedAt: string;
    customerName: string;
    dueDate: string;
    customerPin?: string | null | undefined;
    description?: string | null | undefined;
    etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
    paidAt?: string | null | undefined;
    voidedAt?: string | null | undefined;
    isOverdue?: boolean | undefined;
}>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export declare const MsmeInvoiceStatsSchema: z.ZodObject<{
    total: z.ZodNumber;
    draft: z.ZodNumber;
    sent: z.ZodNumber;
    paid: z.ZodNumber;
    voidCount: z.ZodNumber;
    overdue: z.ZodNumber;
    outstanding: z.ZodNumber;
    overdueAmount: z.ZodNumber;
    paidAmount: z.ZodNumber;
    collectionRate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    draft: number;
    sent: number;
    paid: number;
    total: number;
    voidCount: number;
    overdue: number;
    outstanding: number;
    overdueAmount: number;
    paidAmount: number;
    collectionRate: number;
}, {
    draft: number;
    sent: number;
    paid: number;
    total: number;
    voidCount: number;
    overdue: number;
    outstanding: number;
    overdueAmount: number;
    paidAmount: number;
    collectionRate: number;
}>;
export type MsmeInvoiceStats = z.infer<typeof MsmeInvoiceStatsSchema>;
export declare const MsmeProjectStatsSchema: z.ZodObject<{
    total: z.ZodNumber;
    active: z.ZodNumber;
    draft: z.ZodNumber;
    completed: z.ZodNumber;
    totalContractValue: z.ZodNumber;
    totalAllocated: z.ZodNumber;
    totalSpent: z.ZodNumber;
    fundingPercent: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    completed: number;
    active: number;
    draft: number;
    fundingPercent: number;
    totalAllocated: number;
    totalSpent: number;
    total: number;
    totalContractValue: number;
}, {
    completed: number;
    active: number;
    draft: number;
    fundingPercent: number;
    totalAllocated: number;
    totalSpent: number;
    total: number;
    totalContractValue: number;
}>;
export type MsmeProjectStats = z.infer<typeof MsmeProjectStatsSchema>;
export declare const MsmeAlertSchema: z.ZodObject<{
    type: z.ZodEnum<["overdue_receivables", "funding_stalled", "wants_discipline", "no_data"]>;
    message: z.ZodString;
    severity: z.ZodEnum<["info", "warn", "critical"]>;
}, "strip", z.ZodTypeAny, {
    message: string;
    type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
    severity: "info" | "warn" | "critical";
}, {
    message: string;
    type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
    severity: "info" | "warn" | "critical";
}>;
export type MsmeAlert = z.infer<typeof MsmeAlertSchema>;
export declare const MsmeOperationalInsightsSchema: z.ZodObject<{
    invoices: z.ZodObject<{
        total: z.ZodNumber;
        draft: z.ZodNumber;
        sent: z.ZodNumber;
        paid: z.ZodNumber;
        voidCount: z.ZodNumber;
        overdue: z.ZodNumber;
        outstanding: z.ZodNumber;
        overdueAmount: z.ZodNumber;
        paidAmount: z.ZodNumber;
        collectionRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        draft: number;
        sent: number;
        paid: number;
        total: number;
        voidCount: number;
        overdue: number;
        outstanding: number;
        overdueAmount: number;
        paidAmount: number;
        collectionRate: number;
    }, {
        draft: number;
        sent: number;
        paid: number;
        total: number;
        voidCount: number;
        overdue: number;
        outstanding: number;
        overdueAmount: number;
        paidAmount: number;
        collectionRate: number;
    }>;
    projects: z.ZodObject<{
        total: z.ZodNumber;
        active: z.ZodNumber;
        draft: z.ZodNumber;
        completed: z.ZodNumber;
        totalContractValue: z.ZodNumber;
        totalAllocated: z.ZodNumber;
        totalSpent: z.ZodNumber;
        fundingPercent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        completed: number;
        active: number;
        draft: number;
        fundingPercent: number;
        totalAllocated: number;
        totalSpent: number;
        total: number;
        totalContractValue: number;
    }, {
        completed: number;
        active: number;
        draft: number;
        fundingPercent: number;
        totalAllocated: number;
        totalSpent: number;
        total: number;
        totalContractValue: number;
    }>;
    fundingVelocityDays: z.ZodNullable<z.ZodNumber>;
    alerts: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["overdue_receivables", "funding_stalled", "wants_discipline", "no_data"]>;
        message: z.ZodString;
        severity: z.ZodEnum<["info", "warn", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
        severity: "info" | "warn" | "critical";
    }, {
        message: string;
        type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
        severity: "info" | "warn" | "critical";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    invoices: {
        draft: number;
        sent: number;
        paid: number;
        total: number;
        voidCount: number;
        overdue: number;
        outstanding: number;
        overdueAmount: number;
        paidAmount: number;
        collectionRate: number;
    };
    projects: {
        completed: number;
        active: number;
        draft: number;
        fundingPercent: number;
        totalAllocated: number;
        totalSpent: number;
        total: number;
        totalContractValue: number;
    };
    fundingVelocityDays: number | null;
    alerts: {
        message: string;
        type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
        severity: "info" | "warn" | "critical";
    }[];
}, {
    invoices: {
        draft: number;
        sent: number;
        paid: number;
        total: number;
        voidCount: number;
        overdue: number;
        outstanding: number;
        overdueAmount: number;
        paidAmount: number;
        collectionRate: number;
    };
    projects: {
        completed: number;
        active: number;
        draft: number;
        fundingPercent: number;
        totalAllocated: number;
        totalSpent: number;
        total: number;
        totalContractValue: number;
    };
    fundingVelocityDays: number | null;
    alerts: {
        message: string;
        type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
        severity: "info" | "warn" | "critical";
    }[];
}>;
export type MsmeOperationalInsights = z.infer<typeof MsmeOperationalInsightsSchema>;
export declare const StockItemCreateInputSchema: z.ZodObject<{
    name: z.ZodString;
    sku: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    qtyOnHand: z.ZodOptional<z.ZodNumber>;
    unitCost: z.ZodNumber;
    unitPrice: z.ZodNumber;
    lowStockThreshold: z.ZodOptional<z.ZodNumber>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    unitCost: number;
    unitPrice: number;
    sku?: string | null | undefined;
    qtyOnHand?: number | undefined;
    lowStockThreshold?: number | undefined;
    location?: string | null | undefined;
}, {
    name: string;
    unitCost: number;
    unitPrice: number;
    sku?: string | null | undefined;
    qtyOnHand?: number | undefined;
    lowStockThreshold?: number | undefined;
    location?: string | null | undefined;
}>;
export type StockItemCreateInput = z.infer<typeof StockItemCreateInputSchema>;
export declare const StockItemUpdateInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    sku: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    unitCost: z.ZodOptional<z.ZodNumber>;
    unitPrice: z.ZodOptional<z.ZodNumber>;
    lowStockThreshold: z.ZodOptional<z.ZodNumber>;
    location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    sku?: string | null | undefined;
    unitCost?: number | undefined;
    unitPrice?: number | undefined;
    lowStockThreshold?: number | undefined;
    location?: string | null | undefined;
}, {
    name?: string | undefined;
    sku?: string | null | undefined;
    unitCost?: number | undefined;
    unitPrice?: number | undefined;
    lowStockThreshold?: number | undefined;
    location?: string | null | undefined;
}>;
export type StockItemUpdateInput = z.infer<typeof StockItemUpdateInputSchema>;
export declare const StockMovementTypeSchema: z.ZodEnum<["in", "out", "adjust"]>;
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;
export declare const StockMovementCreateInputSchema: z.ZodObject<{
    type: z.ZodEnum<["in", "out", "adjust"]>;
    qty: z.ZodNumber;
    unitCost: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    note: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    pocketId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "in" | "out" | "adjust";
    qty: number;
    note?: string | null | undefined;
    unitCost?: number | null | undefined;
    pocketId?: string | null | undefined;
}, {
    type: "in" | "out" | "adjust";
    qty: number;
    note?: string | null | undefined;
    unitCost?: number | null | undefined;
    pocketId?: string | null | undefined;
}>;
export type StockMovementCreateInput = z.infer<typeof StockMovementCreateInputSchema>;
export declare const StockItemSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    planId: z.ZodString;
    name: z.ZodString;
    sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    qtyOnHand: z.ZodNumber;
    unitCost: z.ZodNumber;
    unitPrice: z.ZodNumber;
    lowStockThreshold: z.ZodNumber;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    isLowStock: z.ZodOptional<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    userId: string;
    planId: string;
    createdAt: string;
    updatedAt: string;
    qtyOnHand: number;
    unitCost: number;
    unitPrice: number;
    lowStockThreshold: number;
    sku?: string | null | undefined;
    location?: string | null | undefined;
    isLowStock?: boolean | undefined;
}, {
    name: string;
    id: string;
    userId: string;
    planId: string;
    createdAt: string;
    updatedAt: string;
    qtyOnHand: number;
    unitCost: number;
    unitPrice: number;
    lowStockThreshold: number;
    sku?: string | null | undefined;
    location?: string | null | undefined;
    isLowStock?: boolean | undefined;
}>;
export type StockItem = z.infer<typeof StockItemSchema>;
export declare const StockMovementSchema: z.ZodObject<{
    id: z.ZodString;
    itemId: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["in", "out", "adjust"]>;
    qty: z.ZodNumber;
    unitCost: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    totalCost: z.ZodNumber;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    pocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "in" | "out" | "adjust";
    id: string;
    userId: string;
    createdAt: string;
    qty: number;
    itemId: string;
    totalCost: number;
    note?: string | null | undefined;
    unitCost?: number | null | undefined;
    pocketId?: string | null | undefined;
}, {
    type: "in" | "out" | "adjust";
    id: string;
    userId: string;
    createdAt: string;
    qty: number;
    itemId: string;
    totalCost: number;
    note?: string | null | undefined;
    unitCost?: number | null | undefined;
    pocketId?: string | null | undefined;
}>;
export type StockMovement = z.infer<typeof StockMovementSchema>;
export declare const PlanAssignReasonSchema: z.ZodObject<{
    rule: z.ZodString;
    reason: z.ZodString;
    needsRatio: z.ZodOptional<z.ZodNumber>;
    needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
    goalMonthsNeeded: z.ZodOptional<z.ZodNumber>;
    goalRequiredSharePercent: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    rule: string;
    reason: string;
    needsRatio?: number | undefined;
    needsBand?: "high" | "mid" | "low" | undefined;
    goalMonthsNeeded?: number | undefined;
    goalRequiredSharePercent?: number | undefined;
}, {
    rule: string;
    reason: string;
    needsRatio?: number | undefined;
    needsBand?: "high" | "mid" | "low" | undefined;
    goalMonthsNeeded?: number | undefined;
    goalRequiredSharePercent?: number | undefined;
}>;
export type PlanAssignReason = z.infer<typeof PlanAssignReasonSchema>;
export declare const OnboardingAssignResultSchema: z.ZodObject<{
    segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
    plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Daily Budget", "Gig — Daily Budget", "Salaried + Side Income — Structured", "Salaried + Side Income — Daily Budget", "Business — Structured"]>;
    planType: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    incomeConcentration: z.ZodOptional<z.ZodEnum<["concentrated", "diversified"]>>;
    hasSideIncome: z.ZodOptional<z.ZodBoolean>;
    reasons: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
        needsRatio: z.ZodOptional<z.ZodNumber>;
        needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
        goalMonthsNeeded: z.ZodOptional<z.ZodNumber>;
        goalRequiredSharePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }>, "many">;
    remainingAfterFixed: z.ZodNumber;
    savingsTarget: z.ZodNumber;
    spendableAmount: z.ZodNumber;
    needsRatio: z.ZodNumber;
    needsBand: z.ZodEnum<["high", "mid", "low"]>;
}, "strip", z.ZodTypeAny, {
    incomePattern: "salaried" | "freelancer" | "mix";
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
    segment?: "individual" | "msme" | undefined;
    incomeConcentration?: "concentrated" | "diversified" | undefined;
    hasSideIncome?: boolean | undefined;
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
    segment?: "individual" | "msme" | undefined;
    incomeConcentration?: "concentrated" | "diversified" | undefined;
    hasSideIncome?: boolean | undefined;
}>;
export type OnboardingAssignResult = z.infer<typeof OnboardingAssignResultSchema>;
export declare const CategoryAllocationPreviewSchema: z.ZodObject<{
    category: z.ZodEnum<["food", "transport", "leisure", "family"]>;
    name: z.ZodString;
    amount: z.ZodNumber;
    percentage: z.ZodNumber;
    dailyCap: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    amount: number;
    category: "food" | "transport" | "leisure" | "family";
    percentage: number;
    dailyCap?: number | undefined;
}, {
    name: string;
    amount: number;
    category: "food" | "transport" | "leisure" | "family";
    percentage: number;
    dailyCap?: number | undefined;
}>;
export type CategoryAllocationPreview = z.infer<typeof CategoryAllocationPreviewSchema>;
/** POST/PATCH /onboarding/plan-preview — assign result plus an editable
 *  per-category breakdown of the spendable amount, used by the onboarding
 *  result screen's percentage editor (audit_team.md item 3). */
export declare const PlanPreviewResultSchema: z.ZodObject<{
    segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
    plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Daily Budget", "Gig — Daily Budget", "Salaried + Side Income — Structured", "Salaried + Side Income — Daily Budget", "Business — Structured"]>;
    planType: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    incomeConcentration: z.ZodOptional<z.ZodEnum<["concentrated", "diversified"]>>;
    hasSideIncome: z.ZodOptional<z.ZodBoolean>;
    reasons: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
        needsRatio: z.ZodOptional<z.ZodNumber>;
        needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
        goalMonthsNeeded: z.ZodOptional<z.ZodNumber>;
        goalRequiredSharePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }>, "many">;
    remainingAfterFixed: z.ZodNumber;
    savingsTarget: z.ZodNumber;
    spendableAmount: z.ZodNumber;
    needsRatio: z.ZodNumber;
    needsBand: z.ZodEnum<["high", "mid", "low"]>;
} & {
    categoryBreakdown: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["food", "transport", "leisure", "family"]>;
        name: z.ZodString;
        amount: z.ZodNumber;
        percentage: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        category: "food" | "transport" | "leisure" | "family";
        percentage: number;
        dailyCap?: number | undefined;
    }, {
        name: string;
        amount: number;
        category: "food" | "transport" | "leisure" | "family";
        percentage: number;
        dailyCap?: number | undefined;
    }>, "many">;
    categoryPercentages: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    incomePattern: "salaried" | "freelancer" | "mix";
    categoryPercentages: Record<string, number>;
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
    categoryBreakdown: {
        name: string;
        amount: number;
        category: "food" | "transport" | "leisure" | "family";
        percentage: number;
        dailyCap?: number | undefined;
    }[];
    segment?: "individual" | "msme" | undefined;
    incomeConcentration?: "concentrated" | "diversified" | undefined;
    hasSideIncome?: boolean | undefined;
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    categoryPercentages: Record<string, number>;
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
    categoryBreakdown: {
        name: string;
        amount: number;
        category: "food" | "transport" | "leisure" | "family";
        percentage: number;
        dailyCap?: number | undefined;
    }[];
    segment?: "individual" | "msme" | undefined;
    incomeConcentration?: "concentrated" | "diversified" | undefined;
    hasSideIncome?: boolean | undefined;
}>;
export type PlanPreviewResult = z.infer<typeof PlanPreviewResultSchema>;
export declare const OnboardingCommitResultSchema: z.ZodObject<{
    planId: z.ZodString;
    pockets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    planId: string;
    pockets: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
}, {
    planId: string;
    pockets: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
}>;
export type OnboardingCommitResult = z.infer<typeof OnboardingCommitResultSchema>;
/** Why a balance moved from an old pocket to a new one during plan retake. */
export declare const RedistributionReasonSchema: z.ZodEnum<["category_match", "kind_match", "proportional", "spillover"]>;
export type RedistributionReason = z.infer<typeof RedistributionReasonSchema>;
export declare const RedistributionMovementSchema: z.ZodObject<{
    fromPocketName: z.ZodString;
    toPocketName: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodEnum<["category_match", "kind_match", "proportional", "spillover"]>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    reason: "category_match" | "kind_match" | "proportional" | "spillover";
    fromPocketName: string;
    toPocketName: string;
}, {
    amount: number;
    reason: "category_match" | "kind_match" | "proportional" | "spillover";
    fromPocketName: string;
    toPocketName: string;
}>;
export type RedistributionMovement = z.infer<typeof RedistributionMovementSchema>;
export declare const PlanRedistributionSchema: z.ZodObject<{
    totalMoved: z.ZodNumber;
    movements: z.ZodArray<z.ZodObject<{
        fromPocketName: z.ZodString;
        toPocketName: z.ZodString;
        amount: z.ZodNumber;
        reason: z.ZodEnum<["category_match", "kind_match", "proportional", "spillover"]>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        reason: "category_match" | "kind_match" | "proportional" | "spillover";
        fromPocketName: string;
        toPocketName: string;
    }, {
        amount: number;
        reason: "category_match" | "kind_match" | "proportional" | "spillover";
        fromPocketName: string;
        toPocketName: string;
    }>, "many">;
    previousPlanType: z.ZodEnum<["structured", "daily"]>;
    newPlanType: z.ZodEnum<["structured", "daily"]>;
    nextRetakeAvailableOn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    totalMoved: number;
    movements: {
        amount: number;
        reason: "category_match" | "kind_match" | "proportional" | "spillover";
        fromPocketName: string;
        toPocketName: string;
    }[];
    previousPlanType: "structured" | "daily";
    newPlanType: "structured" | "daily";
    nextRetakeAvailableOn: string;
}, {
    totalMoved: number;
    movements: {
        amount: number;
        reason: "category_match" | "kind_match" | "proportional" | "spillover";
        fromPocketName: string;
        toPocketName: string;
    }[];
    previousPlanType: "structured" | "daily";
    newPlanType: "structured" | "daily";
    nextRetakeAvailableOn: string;
}>;
export type PlanRedistribution = z.infer<typeof PlanRedistributionSchema>;
/** Result of POST /profile/plan/retake — commit shape plus money-migration summary. */
export declare const PlanRetakeResultSchema: z.ZodObject<{
    planId: z.ZodString;
    pockets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }>, "many">;
} & {
    redistribution: z.ZodObject<{
        totalMoved: z.ZodNumber;
        movements: z.ZodArray<z.ZodObject<{
            fromPocketName: z.ZodString;
            toPocketName: z.ZodString;
            amount: z.ZodNumber;
            reason: z.ZodEnum<["category_match", "kind_match", "proportional", "spillover"]>;
        }, "strip", z.ZodTypeAny, {
            amount: number;
            reason: "category_match" | "kind_match" | "proportional" | "spillover";
            fromPocketName: string;
            toPocketName: string;
        }, {
            amount: number;
            reason: "category_match" | "kind_match" | "proportional" | "spillover";
            fromPocketName: string;
            toPocketName: string;
        }>, "many">;
        previousPlanType: z.ZodEnum<["structured", "daily"]>;
        newPlanType: z.ZodEnum<["structured", "daily"]>;
        nextRetakeAvailableOn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        totalMoved: number;
        movements: {
            amount: number;
            reason: "category_match" | "kind_match" | "proportional" | "spillover";
            fromPocketName: string;
            toPocketName: string;
        }[];
        previousPlanType: "structured" | "daily";
        newPlanType: "structured" | "daily";
        nextRetakeAvailableOn: string;
    }, {
        totalMoved: number;
        movements: {
            amount: number;
            reason: "category_match" | "kind_match" | "proportional" | "spillover";
            fromPocketName: string;
            toPocketName: string;
        }[];
        previousPlanType: "structured" | "daily";
        newPlanType: "structured" | "daily";
        nextRetakeAvailableOn: string;
    }>;
}, "strip", z.ZodTypeAny, {
    planId: string;
    pockets: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
    redistribution: {
        totalMoved: number;
        movements: {
            amount: number;
            reason: "category_match" | "kind_match" | "proportional" | "spillover";
            fromPocketName: string;
            toPocketName: string;
        }[];
        previousPlanType: "structured" | "daily";
        newPlanType: "structured" | "daily";
        nextRetakeAvailableOn: string;
    };
}, {
    planId: string;
    pockets: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
    redistribution: {
        totalMoved: number;
        movements: {
            amount: number;
            reason: "category_match" | "kind_match" | "proportional" | "spillover";
            fromPocketName: string;
            toPocketName: string;
        }[];
        previousPlanType: "structured" | "daily";
        newPlanType: "structured" | "daily";
        nextRetakeAvailableOn: string;
    };
}>;
export type PlanRetakeResult = z.infer<typeof PlanRetakeResultSchema>;
/** GET /profile/plan/retake-eligibility — gates the Profile retake CTA. */
export declare const RetakeEligibilitySchema: z.ZodObject<{
    allowed: z.ZodBoolean;
    nextRetakeAvailableOn: z.ZodNullable<z.ZodString>;
    lastRetakenAt: z.ZodNullable<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    nextRetakeAvailableOn: string | null;
    allowed: boolean;
    lastRetakenAt: string | null;
    message?: string | undefined;
}, {
    nextRetakeAvailableOn: string | null;
    allowed: boolean;
    lastRetakenAt: string | null;
    message?: string | undefined;
}>;
export type RetakeEligibility = z.infer<typeof RetakeEligibilitySchema>;
export declare const RunwaySummarySchema: z.ZodObject<{
    applicable: z.ZodBoolean;
    runwayDays: z.ZodOptional<z.ZodNumber>;
    expectedIntervalDays: z.ZodOptional<z.ZodNumber>;
    daysSinceLastIncome: z.ZodOptional<z.ZodNumber>;
    confidence: z.ZodOptional<z.ZodEnum<["estimate", "historical"]>>;
    discretionaryReserve: z.ZodOptional<z.ZodNumber>;
    fixedObligations: z.ZodOptional<z.ZodNumber>;
    dailyBudget: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    applicable: boolean;
    runwayDays?: number | undefined;
    expectedIntervalDays?: number | undefined;
    daysSinceLastIncome?: number | undefined;
    confidence?: "estimate" | "historical" | undefined;
    discretionaryReserve?: number | undefined;
    fixedObligations?: number | undefined;
    dailyBudget?: number | undefined;
}, {
    applicable: boolean;
    runwayDays?: number | undefined;
    expectedIntervalDays?: number | undefined;
    daysSinceLastIncome?: number | undefined;
    confidence?: "estimate" | "historical" | undefined;
    discretionaryReserve?: number | undefined;
    fixedObligations?: number | undefined;
    dailyBudget?: number | undefined;
}>;
export type RunwaySummary = z.infer<typeof RunwaySummarySchema>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    fullName: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    updatedAt: string;
    fullName: string;
    email?: string | null | undefined;
}, {
    id: string;
    createdAt: string;
    updatedAt: string;
    fullName: string;
    email?: string | null | undefined;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const PlanSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
    incomeIntervalDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodEnum<["active", "inactive", "reassigned"]>;
    createdAt: z.ZodString;
    reassignedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "structured" | "daily";
    status: "active" | "inactive" | "reassigned";
    incomePattern: "salaried" | "freelancer" | "mix";
    id: string;
    userId: string;
    createdAt: string;
    segment?: "individual" | "msme" | undefined;
    incomeIntervalDays?: number | null | undefined;
    reassignedAt?: string | undefined;
}, {
    type: "structured" | "daily";
    status: "active" | "inactive" | "reassigned";
    incomePattern: "salaried" | "freelancer" | "mix";
    id: string;
    userId: string;
    createdAt: string;
    segment?: "individual" | "msme" | undefined;
    incomeIntervalDays?: number | null | undefined;
    reassignedAt?: string | undefined;
}>;
export type Plan = z.infer<typeof PlanSchema>;
export declare const PocketSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
    name: z.ZodString;
    kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
    isTimeLocked: z.ZodDefault<z.ZodBoolean>;
    lockUntil: z.ZodOptional<z.ZodString>;
    monthlyAllocation: z.ZodNumber;
    dailyCap: z.ZodOptional<z.ZodNumber>;
    parentPocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    splitPercentage: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    kind: "savings" | "fixed" | "spendable" | "loan";
    planId: string;
    createdAt: string;
    updatedAt: string;
    monthlyAllocation: number;
    isTimeLocked: boolean;
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    segment?: "individual" | "msme" | undefined;
    dailyCap?: number | undefined;
    lockUntil?: string | undefined;
    parentPocketId?: string | null | undefined;
    splitPercentage?: number | null | undefined;
}, {
    name: string;
    id: string;
    kind: "savings" | "fixed" | "spendable" | "loan";
    planId: string;
    createdAt: string;
    updatedAt: string;
    monthlyAllocation: number;
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    segment?: "individual" | "msme" | undefined;
    dailyCap?: number | undefined;
    isTimeLocked?: boolean | undefined;
    lockUntil?: string | undefined;
    parentPocketId?: string | null | undefined;
    splitPercentage?: number | null | undefined;
}>;
export type Pocket = z.infer<typeof PocketSchema>;
export declare const PocketUpdateInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
    dailyCap: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    dailyCap?: number | undefined;
}, {
    name?: string | undefined;
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    dailyCap?: number | undefined;
}>;
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
export declare const SubPocketCreateInputSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
    splitPercentage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    splitPercentage: number;
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
}, {
    name: string;
    splitPercentage: number;
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
}>;
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
export declare const SubPocketRebalanceInputSchema: z.ZodObject<{
    splits: z.ZodArray<z.ZodObject<{
        pocketId: z.ZodString;
        splitPercentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pocketId: string;
        splitPercentage: number;
    }, {
        pocketId: string;
        splitPercentage: number;
    }>, "many">;
    confirmPartial: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    splits: {
        pocketId: string;
        splitPercentage: number;
    }[];
    confirmPartial: boolean;
}, {
    splits: {
        pocketId: string;
        splitPercentage: number;
    }[];
    confirmPartial?: boolean | undefined;
}>;
export type SubPocketRebalanceInput = z.infer<typeof SubPocketRebalanceInputSchema>;
export declare const EmergencyUnlockEligibilityReasonSchema: z.ZodEnum<["not_freelancer_plan", "insufficient_history", "monthly_limit_reached", "no_discretionary_runway", "reserve_protected"]>;
export type EmergencyUnlockEligibilityReason = z.infer<typeof EmergencyUnlockEligibilityReasonSchema>;
export declare const RunwayImpactOptionSchema: z.ZodObject<{
    emergency_amount: z.ZodNumber;
    runway_days_before: z.ZodNumber;
    runway_days_after: z.ZodNumber;
    runway_reduction_days: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    emergency_amount: number;
    runway_days_before: number;
    runway_days_after: number;
    runway_reduction_days: number;
}, {
    emergency_amount: number;
    runway_days_before: number;
    runway_days_after: number;
    runway_reduction_days: number;
}>;
export type RunwayImpactOption = z.infer<typeof RunwayImpactOptionSchema>;
export declare const SpendingAnalysisSchema: z.ZodObject<{
    least_daily_spend: z.ZodNumber;
    most_daily_spend: z.ZodNumber;
    average_daily_spend: z.ZodNumber;
    days_of_history: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    least_daily_spend: number;
    most_daily_spend: number;
    average_daily_spend: number;
    days_of_history: number;
}, {
    least_daily_spend: number;
    most_daily_spend: number;
    average_daily_spend: number;
    days_of_history: number;
}>;
export type SpendingAnalysis = z.infer<typeof SpendingAnalysisSchema>;
export declare const DiscretionaryRunwaySchema: z.ZodObject<{
    total_reserve: z.ZodNumber;
    fixed_obligations: z.ZodNumber;
    discretionary_reserve: z.ZodNumber;
    daily_budget: z.ZodNumber;
    runway_days: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total_reserve: number;
    fixed_obligations: number;
    discretionary_reserve: number;
    daily_budget: number;
    runway_days: number;
}, {
    total_reserve: number;
    fixed_obligations: number;
    discretionary_reserve: number;
    daily_budget: number;
    runway_days: number;
}>;
export type DiscretionaryRunway = z.infer<typeof DiscretionaryRunwaySchema>;
export declare const EmergencyUnlockEligibilityResponseSchema: z.ZodObject<{
    eligible: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodEnum<["not_freelancer_plan", "insufficient_history", "monthly_limit_reached", "no_discretionary_runway", "reserve_protected"]>>;
    message: z.ZodOptional<z.ZodString>;
    analysis: z.ZodOptional<z.ZodObject<{
        least_daily_spend: z.ZodNumber;
        most_daily_spend: z.ZodNumber;
        average_daily_spend: z.ZodNumber;
        days_of_history: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        least_daily_spend: number;
        most_daily_spend: number;
        average_daily_spend: number;
        days_of_history: number;
    }, {
        least_daily_spend: number;
        most_daily_spend: number;
        average_daily_spend: number;
        days_of_history: number;
    }>>;
    discretionary_runway: z.ZodOptional<z.ZodObject<{
        total_reserve: z.ZodNumber;
        fixed_obligations: z.ZodNumber;
        discretionary_reserve: z.ZodNumber;
        daily_budget: z.ZodNumber;
        runway_days: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total_reserve: number;
        fixed_obligations: number;
        discretionary_reserve: number;
        daily_budget: number;
        runway_days: number;
    }, {
        total_reserve: number;
        fixed_obligations: number;
        discretionary_reserve: number;
        daily_budget: number;
        runway_days: number;
    }>>;
    runway_impact_options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        emergency_amount: z.ZodNumber;
        runway_days_before: z.ZodNumber;
        runway_days_after: z.ZodNumber;
        runway_reduction_days: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        emergency_amount: number;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
    }, {
        emergency_amount: number;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
    }>, "many">>;
    last_used: z.ZodOptional<z.ZodString>;
    next_available: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    eligible: boolean;
    message?: string | undefined;
    reason?: "not_freelancer_plan" | "insufficient_history" | "monthly_limit_reached" | "no_discretionary_runway" | "reserve_protected" | undefined;
    analysis?: {
        least_daily_spend: number;
        most_daily_spend: number;
        average_daily_spend: number;
        days_of_history: number;
    } | undefined;
    discretionary_runway?: {
        total_reserve: number;
        fixed_obligations: number;
        discretionary_reserve: number;
        daily_budget: number;
        runway_days: number;
    } | undefined;
    runway_impact_options?: {
        emergency_amount: number;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
    }[] | undefined;
    last_used?: string | undefined;
    next_available?: string | undefined;
}, {
    eligible: boolean;
    message?: string | undefined;
    reason?: "not_freelancer_plan" | "insufficient_history" | "monthly_limit_reached" | "no_discretionary_runway" | "reserve_protected" | undefined;
    analysis?: {
        least_daily_spend: number;
        most_daily_spend: number;
        average_daily_spend: number;
        days_of_history: number;
    } | undefined;
    discretionary_runway?: {
        total_reserve: number;
        fixed_obligations: number;
        discretionary_reserve: number;
        daily_budget: number;
        runway_days: number;
    } | undefined;
    runway_impact_options?: {
        emergency_amount: number;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
    }[] | undefined;
    last_used?: string | undefined;
    next_available?: string | undefined;
}>;
export type EmergencyUnlockEligibilityResponse = z.infer<typeof EmergencyUnlockEligibilityResponseSchema>;
export declare const EmergencyUnlockRequestSchema: z.ZodObject<{
    amount: z.ZodNumber;
    confirm_impact: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    amount: number;
    confirm_impact: boolean;
}, {
    amount: number;
    confirm_impact: boolean;
}>;
export type EmergencyUnlockRequest = z.infer<typeof EmergencyUnlockRequestSchema>;
export declare const EmergencyUnlockAllocationSchema: z.ZodObject<{
    pocket_id: z.ZodString;
    pocket_name: z.ZodString;
    amount: z.ZodNumber;
    percentage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    amount: number;
    percentage: number;
    pocket_id: string;
    pocket_name: string;
}, {
    amount: number;
    percentage: number;
    pocket_id: string;
    pocket_name: string;
}>;
export type EmergencyUnlockAllocation = z.infer<typeof EmergencyUnlockAllocationSchema>;
export declare const EmergencyUnlockResponseSchema: z.ZodObject<{
    applied: z.ZodBoolean;
    unlock: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        amount: z.ZodNumber;
        runway_days_before: z.ZodNumber;
        runway_days_after: z.ZodNumber;
        runway_reduction_days: z.ZodNumber;
        allocations: z.ZodArray<z.ZodObject<{
            pocket_id: z.ZodString;
            pocket_name: z.ZodString;
            amount: z.ZodNumber;
            percentage: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            amount: number;
            percentage: number;
            pocket_id: string;
            pocket_name: string;
        }, {
            amount: number;
            percentage: number;
            pocket_id: string;
            pocket_name: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        id: string;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
        allocations: {
            amount: number;
            percentage: number;
            pocket_id: string;
            pocket_name: string;
        }[];
    }, {
        amount: number;
        id: string;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
        allocations: {
            amount: number;
            percentage: number;
            pocket_id: string;
            pocket_name: string;
        }[];
    }>>;
    error: z.ZodOptional<z.ZodString>;
    message: z.ZodOptional<z.ZodString>;
    next_available: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    applied: boolean;
    message?: string | undefined;
    next_available?: string | undefined;
    unlock?: {
        amount: number;
        id: string;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
        allocations: {
            amount: number;
            percentage: number;
            pocket_id: string;
            pocket_name: string;
        }[];
    } | undefined;
    error?: string | undefined;
}, {
    applied: boolean;
    message?: string | undefined;
    next_available?: string | undefined;
    unlock?: {
        amount: number;
        id: string;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
        allocations: {
            amount: number;
            percentage: number;
            pocket_id: string;
            pocket_name: string;
        }[];
    } | undefined;
    error?: string | undefined;
}>;
export type EmergencyUnlockResponse = z.infer<typeof EmergencyUnlockResponseSchema>;
export declare const RepaymentCadenceSchema: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
export type RepaymentCadence = z.infer<typeof RepaymentCadenceSchema>;
export declare const RepaymentScheduleSchema: z.ZodObject<{
    totalAmount: z.ZodNumber;
    repaymentAmount: z.ZodNumber;
    cadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    nextDueDate: z.ZodString;
    totalPayments: z.ZodNumber;
    paymentsMade: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalAmount: number;
    repaymentAmount: number;
    cadence: "weekly" | "biweekly" | "monthly";
    startDate: string;
    endDate: string;
    nextDueDate: string;
    totalPayments: number;
    paymentsMade: number;
}, {
    totalAmount: number;
    repaymentAmount: number;
    cadence: "weekly" | "biweekly" | "monthly";
    startDate: string;
    endDate: string;
    nextDueDate: string;
    totalPayments: number;
    paymentsMade: number;
}>;
export type RepaymentSchedule = z.infer<typeof RepaymentScheduleSchema>;
export declare const LoanCreateInputSchema: z.ZodObject<{
    name: z.ZodString;
    totalAmount: z.ZodNumber;
    repaymentAmount: z.ZodNumber;
    cadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    dueDay: z.ZodNumber;
    loanProvider: z.ZodOptional<z.ZodString>;
    loanPurpose: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    dueDay: number;
    totalAmount: number;
    repaymentAmount: number;
    cadence: "weekly" | "biweekly" | "monthly";
    startDate: string;
    endDate: string;
    loanProvider?: string | undefined;
    loanPurpose?: string | undefined;
}, {
    name: string;
    dueDay: number;
    totalAmount: number;
    repaymentAmount: number;
    cadence: "weekly" | "biweekly" | "monthly";
    startDate: string;
    endDate: string;
    loanProvider?: string | undefined;
    loanPurpose?: string | undefined;
}>;
export type LoanCreateInput = z.infer<typeof LoanCreateInputSchema>;
export declare const LoanUpdateInputSchema: z.ZodObject<{
    repaymentSchedule: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        totalAmount: z.ZodOptional<z.ZodNumber>;
        repaymentAmount: z.ZodOptional<z.ZodNumber>;
        cadence: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly"]>>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
        nextDueDate: z.ZodOptional<z.ZodString>;
        totalPayments: z.ZodOptional<z.ZodNumber>;
        paymentsMade: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        totalAmount?: number | undefined;
        repaymentAmount?: number | undefined;
        cadence?: "weekly" | "biweekly" | "monthly" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        nextDueDate?: string | undefined;
        totalPayments?: number | undefined;
        paymentsMade?: number | undefined;
    }, {
        totalAmount?: number | undefined;
        repaymentAmount?: number | undefined;
        cadence?: "weekly" | "biweekly" | "monthly" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        nextDueDate?: string | undefined;
        totalPayments?: number | undefined;
        paymentsMade?: number | undefined;
    }>>>;
    loanProvider: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    loanPurpose: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    loanProvider?: string | undefined;
    loanPurpose?: string | undefined;
    repaymentSchedule?: {
        totalAmount?: number | undefined;
        repaymentAmount?: number | undefined;
        cadence?: "weekly" | "biweekly" | "monthly" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        nextDueDate?: string | undefined;
        totalPayments?: number | undefined;
        paymentsMade?: number | undefined;
    } | undefined;
}, {
    loanProvider?: string | undefined;
    loanPurpose?: string | undefined;
    repaymentSchedule?: {
        totalAmount?: number | undefined;
        repaymentAmount?: number | undefined;
        cadence?: "weekly" | "biweekly" | "monthly" | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
        nextDueDate?: string | undefined;
        totalPayments?: number | undefined;
        paymentsMade?: number | undefined;
    } | undefined;
}>;
export type LoanUpdateInput = z.infer<typeof LoanUpdateInputSchema>;
export declare const LoanPurposePocketInputSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
    splitPercentage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    splitPercentage: number;
}, {
    name: string;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    splitPercentage: number;
}>;
export type LoanPurposePocketInput = z.infer<typeof LoanPurposePocketInputSchema>;
export declare const LoanDetailSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
    name: z.ZodString;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
    isTimeLocked: z.ZodDefault<z.ZodBoolean>;
    lockUntil: z.ZodOptional<z.ZodString>;
    monthlyAllocation: z.ZodNumber;
    dailyCap: z.ZodOptional<z.ZodNumber>;
    parentPocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    splitPercentage: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
} & {
    kind: z.ZodLiteral<"loan">;
    repaymentSchedule: z.ZodObject<{
        totalAmount: z.ZodNumber;
        repaymentAmount: z.ZodNumber;
        cadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
        startDate: z.ZodString;
        endDate: z.ZodString;
        nextDueDate: z.ZodString;
        totalPayments: z.ZodNumber;
        paymentsMade: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        nextDueDate: string;
        totalPayments: number;
        paymentsMade: number;
    }, {
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        nextDueDate: string;
        totalPayments: number;
        paymentsMade: number;
    }>;
    loanProvider: z.ZodNullable<z.ZodString>;
    loanPurpose: z.ZodNullable<z.ZodString>;
    dueDay: z.ZodNumber;
    subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        isTimeLocked: z.ZodDefault<z.ZodBoolean>;
        lockUntil: z.ZodOptional<z.ZodString>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
        parentPocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        splitPercentage: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        isTimeLocked: boolean;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        dailyCap?: number | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        dailyCap?: number | undefined;
        isTimeLocked?: boolean | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    dueDay: number;
    id: string;
    kind: "loan";
    planId: string;
    createdAt: string;
    updatedAt: string;
    monthlyAllocation: number;
    isTimeLocked: boolean;
    loanProvider: string | null;
    loanPurpose: string | null;
    repaymentSchedule: {
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        nextDueDate: string;
        totalPayments: number;
        paymentsMade: number;
    };
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    segment?: "individual" | "msme" | undefined;
    subPockets?: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        isTimeLocked: boolean;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        dailyCap?: number | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }[] | undefined;
    dailyCap?: number | undefined;
    lockUntil?: string | undefined;
    parentPocketId?: string | null | undefined;
    splitPercentage?: number | null | undefined;
}, {
    name: string;
    dueDay: number;
    id: string;
    kind: "loan";
    planId: string;
    createdAt: string;
    updatedAt: string;
    monthlyAllocation: number;
    loanProvider: string | null;
    loanPurpose: string | null;
    repaymentSchedule: {
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        nextDueDate: string;
        totalPayments: number;
        paymentsMade: number;
    };
    category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    segment?: "individual" | "msme" | undefined;
    subPockets?: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        dailyCap?: number | undefined;
        isTimeLocked?: boolean | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }[] | undefined;
    dailyCap?: number | undefined;
    isTimeLocked?: boolean | undefined;
    lockUntil?: string | undefined;
    parentPocketId?: string | null | undefined;
    splitPercentage?: number | null | undefined;
}>;
export type LoanDetail = z.infer<typeof LoanDetailSchema>;
export declare const FixedExpenseSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    amount: z.ZodNumber;
    dueDay: z.ZodNumber;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    amount: number;
    dueDay: number;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}, {
    name: string;
    amount: number;
    dueDay: number;
    category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}>;
export type FixedExpense = z.infer<typeof FixedExpenseSchema>;
export declare const IncomeEventSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    amount: z.ZodNumber;
    source: z.ZodString;
    label: z.ZodString;
    date: z.ZodString;
    runAllocation: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: number;
    date: string;
    id: string;
    source: string;
    label: string;
    userId: string;
    createdAt: string;
    runAllocation: boolean;
}, {
    amount: number;
    date: string;
    id: string;
    source: string;
    label: string;
    userId: string;
    createdAt: string;
    runAllocation?: boolean | undefined;
}>;
export type IncomeEvent = z.infer<typeof IncomeEventSchema>;
export declare const TransactionSchema: z.ZodObject<{
    id: z.ZodString;
    pocketId: z.ZodString;
    amount: z.ZodNumber;
    type: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover", "reserve_release", "reserve_return", "daily_overspend_debit", "fixed_expense_earmark", "fixed_expense_carry_forward"]>;
    merchant: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>>;
    createdAt: z.ZodString;
    dailyAllocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover" | "reserve_release" | "reserve_return" | "daily_overspend_debit" | "fixed_expense_earmark" | "fixed_expense_carry_forward";
    amount: number;
    id: string;
    createdAt: string;
    pocketId: string;
    category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
    merchant?: string | undefined;
    dailyAllocationId?: string | null | undefined;
}, {
    type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover" | "reserve_release" | "reserve_return" | "daily_overspend_debit" | "fixed_expense_earmark" | "fixed_expense_carry_forward";
    amount: number;
    id: string;
    createdAt: string;
    pocketId: string;
    category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
    merchant?: string | undefined;
    dailyAllocationId?: string | null | undefined;
}>;
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
export declare const DailyAllocationSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    userId: z.ZodString;
    allocationDate: z.ZodString;
    plannedAmount: z.ZodNumber;
    actualSpend: z.ZodNumber;
    returnedAmount: z.ZodNumber;
    overspendAmount: z.ZodNumber;
    runwayDaysAtOpen: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    runwayDaysAtClose: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodEnum<["open", "closed"]>;
    createdAt: z.ZodString;
    closedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "closed";
    id: string;
    userId: string;
    planId: string;
    createdAt: string;
    allocationDate: string;
    plannedAmount: number;
    actualSpend: number;
    returnedAmount: number;
    overspendAmount: number;
    runwayDaysAtOpen?: number | null | undefined;
    runwayDaysAtClose?: number | null | undefined;
    closedAt?: string | null | undefined;
}, {
    status: "open" | "closed";
    id: string;
    userId: string;
    planId: string;
    createdAt: string;
    allocationDate: string;
    plannedAmount: number;
    actualSpend: number;
    returnedAmount: number;
    overspendAmount: number;
    runwayDaysAtOpen?: number | null | undefined;
    runwayDaysAtClose?: number | null | undefined;
    closedAt?: string | null | undefined;
}>;
export type DailyAllocation = z.infer<typeof DailyAllocationSchema>;
export declare const ReallocationSchema: z.ZodObject<{
    id: z.ZodString;
    fromPocketId: z.ZodString;
    toPocketId: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
    status: z.ZodEnum<["pending", "cooling_off", "completed", "skipped"]>;
    coolingOffEndsAt: z.ZodOptional<z.ZodString>;
    disciplineCost: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodString;
    completedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "cooling_off" | "completed" | "skipped";
    amount: number;
    id: string;
    createdAt: string;
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    fromPocketId: string;
    toPocketId: string;
    disciplineCost: number;
    completedAt?: string | undefined;
    coolingOffEndsAt?: string | undefined;
}, {
    status: "pending" | "cooling_off" | "completed" | "skipped";
    amount: number;
    id: string;
    createdAt: string;
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    fromPocketId: string;
    toPocketId: string;
    completedAt?: string | undefined;
    coolingOffEndsAt?: string | undefined;
    disciplineCost?: number | undefined;
}>;
export type Reallocation = z.infer<typeof ReallocationSchema>;
export declare const ReallocationInputSchema: z.ZodObject<{
    fromPocketId: z.ZodString;
    toPocketId: z.ZodString;
    amount: z.ZodNumber;
    reason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    fromPocketId: string;
    toPocketId: string;
}, {
    amount: number;
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    fromPocketId: string;
    toPocketId: string;
}>;
export type ReallocationInput = z.infer<typeof ReallocationInputSchema>;
export declare const ReallocationCompleteInputSchema: z.ZodObject<{
    skipCoolingOff: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    skipCoolingOff: boolean;
}, {
    skipCoolingOff?: boolean | undefined;
}>;
export type ReallocationCompleteInput = z.infer<typeof ReallocationCompleteInputSchema>;
export declare const MerchantClassificationSchema: z.ZodObject<{
    id: z.ZodString;
    recipientKey: z.ZodString;
    category: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
    remember: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
    id: string;
    createdAt: string;
    recipientKey: string;
    remember: boolean;
}, {
    category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
    id: string;
    createdAt: string;
    recipientKey: string;
    remember?: boolean | undefined;
}>;
export type MerchantClassification = z.infer<typeof MerchantClassificationSchema>;
export declare const BehaviorEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    id: string;
    createdAt: string;
    payload: Record<string, unknown>;
}, {
    type: string;
    id: string;
    createdAt: string;
    payload: Record<string, unknown>;
}>;
export type BehaviorEvent = z.infer<typeof BehaviorEventSchema>;
export declare const DisciplineScoreSchema: z.ZodObject<{
    userId: z.ZodString;
    score: z.ZodNumber;
    delta: z.ZodNumber;
    period: z.ZodString;
    calculatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userId: string;
    score: number;
    delta: number;
    period: string;
    calculatedAt: string;
}, {
    userId: string;
    score: number;
    delta: number;
    period: string;
    calculatedAt: string;
}>;
export type DisciplineScore = z.infer<typeof DisciplineScoreSchema>;
export declare const schemas: {
    PlanType: z.ZodEnum<["structured", "daily"]>;
    Segment: z.ZodEnum<["individual", "msme"]>;
    PocketKind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
    PocketCategory: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
    BusinessPocketCategory: z.ZodEnum<["stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment"]>;
    MSME_SPENDABLE_LABELS: {
        readonly stock: "Stock & Inventory";
        readonly supplier: "Suppliers";
        readonly licence: "Licences";
        readonly tax: "Taxes";
        readonly salary: "Salaries & Wages";
        readonly rent: "Rent";
        readonly operations: "Operations";
        readonly profit: "Profit";
        readonly owner_draw: "Owner Draw";
        readonly growth: "Growth";
        readonly marketing: "Marketing";
        readonly equipment: "Equipment";
    };
    IncomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    SpendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
    LifeStage: z.ZodEnum<["student", "working_adult", "self_employed"]>;
    EmergencyBuffer: z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>;
    MoneyPersonality: z.ZodEnum<["spender", "saver", "avoider"]>;
    NeedsBand: z.ZodEnum<["high", "mid", "low"]>;
    SavingsGoalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
    SavingsGoalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
    SavingsGoalInput: z.ZodObject<{
        goalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
        goalLabel: z.ZodOptional<z.ZodString>;
        goalAmount: z.ZodOptional<z.ZodNumber>;
        goalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
    }, "strip", z.ZodTypeAny, {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    }, {
        goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
        goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
        goalLabel?: string | undefined;
        goalAmount?: number | undefined;
    }>;
    PlanName: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Daily Budget", "Gig — Daily Budget", "Salaried + Side Income — Structured", "Salaried + Side Income — Daily Budget", "Business — Structured"]>;
    TransactionType: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover", "reserve_release", "reserve_return", "daily_overspend_debit", "fixed_expense_earmark", "fixed_expense_carry_forward"]>;
    ReallocationStatus: z.ZodEnum<["pending", "cooling_off", "completed", "skipped"]>;
    ReallocationReason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
    MerchantCategory: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
    PlanStatus: z.ZodEnum<["active", "inactive", "reassigned"]>;
    SpendableCategory: z.ZodEnum<["food", "transport", "leisure", "family"]>;
    SPENDABLE_CATEGORY_LABELS: {
        readonly stock: "Stock & Inventory";
        readonly supplier: "Suppliers";
        readonly licence: "Licences";
        readonly tax: "Taxes";
        readonly salary: "Salaries & Wages";
        readonly rent: "Rent";
        readonly operations: "Operations";
        readonly profit: "Profit";
        readonly owner_draw: "Owner Draw";
        readonly growth: "Growth";
        readonly marketing: "Marketing";
        readonly equipment: "Equipment";
        readonly food: "Food & Groceries";
        readonly transport: "Transport";
        readonly leisure: "Personal & Leisure";
        readonly family: "Family & Dependents";
    };
    CategoryPercentages: z.ZodRecord<z.ZodString, z.ZodNumber>;
    IncomeConcentration: z.ZodEnum<["concentrated", "diversified"]>;
    OnboardingInput: z.ZodObject<{
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        spendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
        incomeAmount: z.ZodNumber;
        fixedTotal: z.ZodNumber;
        sourceCount: z.ZodNumber;
        fixedExpenses: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            amount: z.ZodNumber;
            dueDay: z.ZodNumber;
            category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
            frequency: z.ZodOptional<z.ZodEnum<["monthly", "weekly", "daily"]>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }, {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }>, "many">>;
        incomeIntervalBand: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly", "irregular"]>>;
        lifeStage: z.ZodOptional<z.ZodEnum<["student", "working_adult", "self_employed"]>>;
        hasDependents: z.ZodOptional<z.ZodBoolean>;
        emergencyBuffer: z.ZodOptional<z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>>;
        moneyPersonality: z.ZodOptional<z.ZodEnum<["spender", "saver", "avoider"]>>;
        hasTransportNeed: z.ZodOptional<z.ZodBoolean>;
        savingsGoal: z.ZodOptional<z.ZodObject<{
            goalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
            goalLabel: z.ZodOptional<z.ZodString>;
            goalAmount: z.ZodOptional<z.ZodNumber>;
            goalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
        }, "strip", z.ZodTypeAny, {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        }, {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        }>>;
        categoryPercentages: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        incomePattern: "salaried" | "freelancer" | "mix";
        spendingHabit: "tracker" | "week3" | "off_guard";
        incomeAmount: number;
        fixedTotal: number;
        sourceCount: number;
        fixedExpenses?: {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }[] | undefined;
        incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
        lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
        hasDependents?: boolean | undefined;
        emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
        moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
        hasTransportNeed?: boolean | undefined;
        savingsGoal?: {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        } | undefined;
        categoryPercentages?: Record<string, number> | undefined;
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        spendingHabit: "tracker" | "week3" | "off_guard";
        incomeAmount: number;
        fixedTotal: number;
        sourceCount: number;
        fixedExpenses?: {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }[] | undefined;
        incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
        lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
        hasDependents?: boolean | undefined;
        emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
        moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
        hasTransportNeed?: boolean | undefined;
        savingsGoal?: {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        } | undefined;
        categoryPercentages?: Record<string, number> | undefined;
    }>;
    MsmeOnboardingInput: z.ZodObject<{
        segment: z.ZodLiteral<"msme">;
        businessName: z.ZodString;
        monthlyRevenue: z.ZodNumber;
        fixedTotal: z.ZodNumber;
        fixedExpenses: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            amount: z.ZodNumber;
            dueDay: z.ZodNumber;
            category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
            frequency: z.ZodOptional<z.ZodEnum<["monthly", "weekly", "daily"]>>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }, {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }>, "many">>;
        hasEmployees: z.ZodOptional<z.ZodBoolean>;
        businessStage: z.ZodOptional<z.ZodEnum<["starting", "stable", "growing"]>>;
        savingsGoal: z.ZodOptional<z.ZodObject<{
            goalType: z.ZodEnum<["emergency_fund", "purchase", "dependent_education", "other"]>;
            goalLabel: z.ZodOptional<z.ZodString>;
            goalAmount: z.ZodOptional<z.ZodNumber>;
            goalTimeframe: z.ZodEnum<["3_months", "6_months", "1_year", "2_plus_years"]>;
        }, "strip", z.ZodTypeAny, {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        }, {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        }>>;
        customPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
            percentage: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            percentage?: number | undefined;
        }, {
            name: string;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            percentage?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        fixedTotal: number;
        segment: "msme";
        businessName: string;
        monthlyRevenue: number;
        fixedExpenses?: {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }[] | undefined;
        savingsGoal?: {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        } | undefined;
        hasEmployees?: boolean | undefined;
        businessStage?: "starting" | "stable" | "growing" | undefined;
        customPockets?: {
            name: string;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            percentage?: number | undefined;
        }[] | undefined;
    }, {
        fixedTotal: number;
        segment: "msme";
        businessName: string;
        monthlyRevenue: number;
        fixedExpenses?: {
            name: string;
            amount: number;
            dueDay: number;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            frequency?: "daily" | "weekly" | "monthly" | undefined;
        }[] | undefined;
        savingsGoal?: {
            goalType: "other" | "emergency_fund" | "purchase" | "dependent_education";
            goalTimeframe: "3_months" | "6_months" | "1_year" | "2_plus_years";
            goalLabel?: string | undefined;
            goalAmount?: number | undefined;
        } | undefined;
        hasEmployees?: boolean | undefined;
        businessStage?: "starting" | "stable" | "growing" | undefined;
        customPockets?: {
            name: string;
            category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
            percentage?: number | undefined;
        }[] | undefined;
    }>;
    BusinessStage: z.ZodEnum<["starting", "stable", "growing"]>;
    MsmePocketInput: z.ZodObject<{
        name: z.ZodString;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
        percentage: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        percentage?: number | undefined;
    }, {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        percentage?: number | undefined;
    }>;
    ProjectKind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
    FundingTier: z.ZodEnum<["priorities", "needs", "wants"]>;
    FundingStatus: z.ZodEnum<["in_progress", "complete"]>;
    ProjectStatus: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
    ProjectCreateInput: z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
        contractValue: z.ZodNumber;
        tiers: z.ZodEffects<z.ZodObject<{
            priorities: z.ZodNumber;
            needs: z.ZodNumber;
            wants: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            priorities: number;
            needs: number;
            wants: number;
        }, {
            priorities: number;
            needs: number;
            wants: number;
        }>, {
            priorities: number;
            needs: number;
            wants: number;
        }, {
            priorities: number;
            needs: number;
            wants: number;
        }>;
        subPockets: z.ZodOptional<z.ZodObject<{
            priorities: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                name: z.ZodString;
                targetAmount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }, {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }>, "many">>;
            needs: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                name: z.ZodString;
                targetAmount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }, {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }>, "many">>;
            wants: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                name: z.ZodString;
                targetAmount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }, {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            priorities?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            needs?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            wants?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
        }, {
            priorities?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            needs?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            wants?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            priorities: number;
            needs: number;
            wants: number;
        };
        subPockets?: {
            priorities?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            needs?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            wants?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            priorities: number;
            needs: number;
            wants: number;
        };
        subPockets?: {
            priorities?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            needs?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            wants?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
        } | undefined;
    }>, {
        name: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            priorities: number;
            needs: number;
            wants: number;
        };
        subPockets?: {
            priorities?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            needs?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            wants?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
        } | undefined;
    }, {
        name: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            priorities: number;
            needs: number;
            wants: number;
        };
        subPockets?: {
            priorities?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            needs?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
            wants?: {
                name: string;
                targetAmount: number;
                id?: string | undefined;
            }[] | undefined;
        } | undefined;
    }>;
    ProjectIncomeInput: z.ZodObject<{
        amount: z.ZodNumber;
        source: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        date: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        date: string;
        source: string;
        label?: string | undefined;
    }, {
        amount: number;
        date: string;
        source: string;
        label?: string | undefined;
    }>;
    TierSummary: z.ZodObject<{
        id: z.ZodString;
        tier: z.ZodEnum<["priorities", "needs", "wants"]>;
        sortOrder: z.ZodNumber;
        targetAmount: z.ZodNumber;
        allocatedAmount: z.ZodNumber;
        spentAmount: z.ZodNumber;
        remainingCash: z.ZodNumber;
        fundingStatus: z.ZodEnum<["in_progress", "complete"]>;
        fundingPercent: z.ZodNumber;
        subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            targetAmount: z.ZodNumber;
            allocatedAmount: z.ZodNumber;
            spentAmount: z.ZodNumber;
            remainingCash: z.ZodNumber;
            fundingPercent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }, {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        fundingStatus: "in_progress" | "complete";
        subPockets?: {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }[] | undefined;
    }, {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        remainingCash: number;
        fundingPercent: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        fundingStatus: "in_progress" | "complete";
        subPockets?: {
            name: string;
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
        }[] | undefined;
    }>;
    ProjectSummary: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
        contractValue: z.ZodNumber;
        status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
        isActiveCascade: z.ZodBoolean;
        spendingControls: z.ZodOptional<z.ZodObject<{
            lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
            warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        }, {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        }>>;
        completionResolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completionResolvedTo: z.ZodOptional<z.ZodNullable<z.ZodEnum<["savings", "keep"]>>>;
        tiers: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            tier: z.ZodEnum<["priorities", "needs", "wants"]>;
            sortOrder: z.ZodNumber;
            targetAmount: z.ZodNumber;
            allocatedAmount: z.ZodNumber;
            spentAmount: z.ZodNumber;
            remainingCash: z.ZodNumber;
            fundingStatus: z.ZodEnum<["in_progress", "complete"]>;
            fundingPercent: z.ZodNumber;
            subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodString;
                targetAmount: z.ZodNumber;
                allocatedAmount: z.ZodNumber;
                spentAmount: z.ZodNumber;
                remainingCash: z.ZodNumber;
                fundingPercent: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }, {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }, {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }>, "many">;
        nextIncomeGoesTo: z.ZodNullable<z.ZodEnum<["priorities", "needs", "wants"]>>;
        totalAllocated: z.ZodNumber;
        totalSpent: z.ZodNumber;
        totalRemaining: z.ZodNumber;
        excessPending: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }[];
        isActiveCascade: boolean;
        nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
        totalAllocated: number;
        totalSpent: number;
        totalRemaining: number;
        excessPending: number | null;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
    }, {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        tiers: {
            id: string;
            targetAmount: number;
            allocatedAmount: number;
            spentAmount: number;
            remainingCash: number;
            fundingPercent: number;
            tier: "priorities" | "needs" | "wants";
            sortOrder: number;
            fundingStatus: "in_progress" | "complete";
            subPockets?: {
                name: string;
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
            }[] | undefined;
        }[];
        isActiveCascade: boolean;
        nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
        totalAllocated: number;
        totalSpent: number;
        totalRemaining: number;
        excessPending: number | null;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
    }>;
    SpendingControls: z.ZodObject<{
        lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
        warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        lockWantsUntilPrioritiesAndNeedsFunded: boolean;
        warnOnLowPrioritySpend: boolean;
    }, {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    }>;
    ExcessResolveInput: z.ZodObject<{
        chosenTarget: z.ZodEnum<["needs", "wants", "savings", "keep"]>;
        confirmSavings: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        chosenTarget: "savings" | "needs" | "wants" | "keep";
        confirmSavings?: boolean | undefined;
    }, {
        chosenTarget: "savings" | "needs" | "wants" | "keep";
        confirmSavings?: boolean | undefined;
    }>;
    SpendControlsUpdateInput: z.ZodObject<{
        lockWantsUntilPrioritiesAndNeedsFunded: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        warnOnLowPrioritySpend: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    }, {
        lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
        warnOnLowPrioritySpend?: boolean | undefined;
    }>;
    ProjectCompleteResult: z.ZodObject<{
        project: z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
            contractValue: z.ZodNumber;
            status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
            isActiveCascade: z.ZodBoolean;
            spendingControls: z.ZodOptional<z.ZodObject<{
                lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
                warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                lockWantsUntilPrioritiesAndNeedsFunded: boolean;
                warnOnLowPrioritySpend: boolean;
            }, {
                lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
                warnOnLowPrioritySpend?: boolean | undefined;
            }>>;
            completionResolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            completionResolvedTo: z.ZodOptional<z.ZodNullable<z.ZodEnum<["savings", "keep"]>>>;
            tiers: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                tier: z.ZodEnum<["priorities", "needs", "wants"]>;
                sortOrder: z.ZodNumber;
                targetAmount: z.ZodNumber;
                allocatedAmount: z.ZodNumber;
                spentAmount: z.ZodNumber;
                remainingCash: z.ZodNumber;
                fundingStatus: z.ZodEnum<["in_progress", "complete"]>;
                fundingPercent: z.ZodNumber;
                subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    name: z.ZodString;
                    targetAmount: z.ZodNumber;
                    allocatedAmount: z.ZodNumber;
                    spentAmount: z.ZodNumber;
                    remainingCash: z.ZodNumber;
                    fundingPercent: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }, {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }>, "many">>;
            }, "strip", z.ZodTypeAny, {
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
                tier: "priorities" | "needs" | "wants";
                sortOrder: number;
                fundingStatus: "in_progress" | "complete";
                subPockets?: {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }[] | undefined;
            }, {
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
                tier: "priorities" | "needs" | "wants";
                sortOrder: number;
                fundingStatus: "in_progress" | "complete";
                subPockets?: {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }[] | undefined;
            }>, "many">;
            nextIncomeGoesTo: z.ZodNullable<z.ZodEnum<["priorities", "needs", "wants"]>>;
            totalAllocated: z.ZodNumber;
            totalSpent: z.ZodNumber;
            totalRemaining: z.ZodNumber;
            excessPending: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            status: "completed" | "active" | "draft" | "cancelled";
            name: string;
            id: string;
            kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
            contractValue: number;
            tiers: {
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
                tier: "priorities" | "needs" | "wants";
                sortOrder: number;
                fundingStatus: "in_progress" | "complete";
                subPockets?: {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }[] | undefined;
            }[];
            isActiveCascade: boolean;
            nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
            totalAllocated: number;
            totalSpent: number;
            totalRemaining: number;
            excessPending: number | null;
            spendingControls?: {
                lockWantsUntilPrioritiesAndNeedsFunded: boolean;
                warnOnLowPrioritySpend: boolean;
            } | undefined;
            completionResolvedAt?: string | null | undefined;
            completionResolvedTo?: "savings" | "keep" | null | undefined;
        }, {
            status: "completed" | "active" | "draft" | "cancelled";
            name: string;
            id: string;
            kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
            contractValue: number;
            tiers: {
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
                tier: "priorities" | "needs" | "wants";
                sortOrder: number;
                fundingStatus: "in_progress" | "complete";
                subPockets?: {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }[] | undefined;
            }[];
            isActiveCascade: boolean;
            nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
            totalAllocated: number;
            totalSpent: number;
            totalRemaining: number;
            excessPending: number | null;
            spendingControls?: {
                lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
                warnOnLowPrioritySpend?: boolean | undefined;
            } | undefined;
            completionResolvedAt?: string | null | undefined;
            completionResolvedTo?: "savings" | "keep" | null | undefined;
        }>;
        remainingPerTier: z.ZodArray<z.ZodObject<{
            tier: z.ZodEnum<["priorities", "needs", "wants"]>;
            remainingCash: z.ZodNumber;
            targetAmount: z.ZodNumber;
            allocatedAmount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            targetAmount: number;
            allocatedAmount: number;
            remainingCash: number;
            tier: "priorities" | "needs" | "wants";
        }, {
            targetAmount: number;
            allocatedAmount: number;
            remainingCash: number;
            tier: "priorities" | "needs" | "wants";
        }>, "many">;
        totalRemaining: z.ZodNumber;
        suggestion: z.ZodString;
        requiresResolution: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        totalRemaining: number;
        project: {
            status: "completed" | "active" | "draft" | "cancelled";
            name: string;
            id: string;
            kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
            contractValue: number;
            tiers: {
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
                tier: "priorities" | "needs" | "wants";
                sortOrder: number;
                fundingStatus: "in_progress" | "complete";
                subPockets?: {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }[] | undefined;
            }[];
            isActiveCascade: boolean;
            nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
            totalAllocated: number;
            totalSpent: number;
            totalRemaining: number;
            excessPending: number | null;
            spendingControls?: {
                lockWantsUntilPrioritiesAndNeedsFunded: boolean;
                warnOnLowPrioritySpend: boolean;
            } | undefined;
            completionResolvedAt?: string | null | undefined;
            completionResolvedTo?: "savings" | "keep" | null | undefined;
        };
        remainingPerTier: {
            targetAmount: number;
            allocatedAmount: number;
            remainingCash: number;
            tier: "priorities" | "needs" | "wants";
        }[];
        suggestion: string;
        requiresResolution: boolean;
    }, {
        totalRemaining: number;
        project: {
            status: "completed" | "active" | "draft" | "cancelled";
            name: string;
            id: string;
            kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
            contractValue: number;
            tiers: {
                id: string;
                targetAmount: number;
                allocatedAmount: number;
                spentAmount: number;
                remainingCash: number;
                fundingPercent: number;
                tier: "priorities" | "needs" | "wants";
                sortOrder: number;
                fundingStatus: "in_progress" | "complete";
                subPockets?: {
                    name: string;
                    id: string;
                    targetAmount: number;
                    allocatedAmount: number;
                    spentAmount: number;
                    remainingCash: number;
                    fundingPercent: number;
                }[] | undefined;
            }[];
            isActiveCascade: boolean;
            nextIncomeGoesTo: "priorities" | "needs" | "wants" | null;
            totalAllocated: number;
            totalSpent: number;
            totalRemaining: number;
            excessPending: number | null;
            spendingControls?: {
                lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
                warnOnLowPrioritySpend?: boolean | undefined;
            } | undefined;
            completionResolvedAt?: string | null | undefined;
            completionResolvedTo?: "savings" | "keep" | null | undefined;
        };
        remainingPerTier: {
            targetAmount: number;
            allocatedAmount: number;
            remainingCash: number;
            tier: "priorities" | "needs" | "wants";
        }[];
        suggestion: string;
        requiresResolution: boolean;
    }>;
    ProjectCompletionResolveInput: z.ZodObject<{
        target: z.ZodEnum<["savings", "keep"]>;
        confirmSavings: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        target: "savings" | "keep";
        confirmSavings?: boolean | undefined;
    }, {
        target: "savings" | "keep";
        confirmSavings?: boolean | undefined;
    }>;
    ProjectSpendInput: z.ZodObject<{
        tierId: z.ZodString;
        subPocketId: z.ZodOptional<z.ZodString>;
        amount: z.ZodNumber;
        merchant: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        note: z.ZodOptional<z.ZodString>;
        confirmRisky: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        tierId: string;
        category?: string | undefined;
        merchant?: string | undefined;
        note?: string | undefined;
        subPocketId?: string | undefined;
        confirmRisky?: boolean | undefined;
    }, {
        amount: number;
        tierId: string;
        category?: string | undefined;
        merchant?: string | undefined;
        note?: string | undefined;
        subPocketId?: string | undefined;
        confirmRisky?: boolean | undefined;
    }>;
    MsmeProject: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        planId: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["catering", "wedding", "trip", "tour", "contract", "construction", "agri", "other"]>;
        contractValue: z.ZodNumber;
        status: z.ZodEnum<["draft", "active", "completed", "cancelled"]>;
        isActiveCascade: z.ZodBoolean;
        spendingControls: z.ZodOptional<z.ZodObject<{
            lockWantsUntilPrioritiesAndNeedsFunded: z.ZodDefault<z.ZodBoolean>;
            warnOnLowPrioritySpend: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        }, {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        }>>;
        completionResolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        completionResolvedTo: z.ZodOptional<z.ZodNullable<z.ZodEnum<["savings", "keep"]>>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        completedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        cancelledAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        isActiveCascade: boolean;
        userId: string;
        planId: string;
        createdAt: string;
        updatedAt: string;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded: boolean;
            warnOnLowPrioritySpend: boolean;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
        completedAt?: string | null | undefined;
        cancelledAt?: string | null | undefined;
    }, {
        status: "completed" | "active" | "draft" | "cancelled";
        name: string;
        id: string;
        kind: "other" | "catering" | "wedding" | "trip" | "tour" | "contract" | "construction" | "agri";
        contractValue: number;
        isActiveCascade: boolean;
        userId: string;
        planId: string;
        createdAt: string;
        updatedAt: string;
        spendingControls?: {
            lockWantsUntilPrioritiesAndNeedsFunded?: boolean | undefined;
            warnOnLowPrioritySpend?: boolean | undefined;
        } | undefined;
        completionResolvedAt?: string | null | undefined;
        completionResolvedTo?: "savings" | "keep" | null | undefined;
        completedAt?: string | null | undefined;
        cancelledAt?: string | null | undefined;
    }>;
    MsmeProjectTier: z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        tier: z.ZodEnum<["priorities", "needs", "wants"]>;
        sortOrder: z.ZodNumber;
        targetAmount: z.ZodNumber;
        allocatedAmount: z.ZodNumber;
        spentAmount: z.ZodNumber;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
        projectId: string;
    }, {
        id: string;
        targetAmount: number;
        allocatedAmount: number;
        spentAmount: number;
        tier: "priorities" | "needs" | "wants";
        sortOrder: number;
        createdAt: string;
        updatedAt: string;
        projectId: string;
    }>;
    MsmeProjectIncomeEvent: z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        userId: z.ZodString;
        amount: z.ZodNumber;
        source: z.ZodString;
        label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        date: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        date: string;
        id: string;
        source: string;
        userId: string;
        createdAt: string;
        projectId: string;
        label?: string | null | undefined;
    }, {
        amount: number;
        date: string;
        id: string;
        source: string;
        userId: string;
        createdAt: string;
        projectId: string;
        label?: string | null | undefined;
    }>;
    MsmeProjectAllocation: z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        tierId: z.ZodString;
        incomeEventId: z.ZodString;
        amount: z.ZodNumber;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        id: string;
        createdAt: string;
        projectId: string;
        tierId: string;
        incomeEventId: string;
    }, {
        amount: number;
        id: string;
        createdAt: string;
        projectId: string;
        tierId: string;
        incomeEventId: string;
    }>;
    MsmeProjectSpend: z.ZodObject<{
        id: z.ZodString;
        tierId: z.ZodString;
        projectId: z.ZodString;
        amount: z.ZodNumber;
        merchant: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        id: string;
        createdAt: string;
        projectId: string;
        tierId: string;
        category?: string | null | undefined;
        merchant?: string | null | undefined;
        note?: string | null | undefined;
    }, {
        amount: number;
        id: string;
        createdAt: string;
        projectId: string;
        tierId: string;
        category?: string | null | undefined;
        merchant?: string | null | undefined;
        note?: string | null | undefined;
    }>;
    ExcessPromptStatus: z.ZodEnum<["pending", "resolved", "dismissed"]>;
    ExcessPromptTarget: z.ZodEnum<["needs", "wants", "savings", "keep"]>;
    MsmeProjectExcessPrompt: z.ZodObject<{
        id: z.ZodString;
        projectId: z.ZodString;
        incomeEventId: z.ZodString;
        excessAmount: z.ZodNumber;
        chosenTarget: z.ZodOptional<z.ZodNullable<z.ZodEnum<["needs", "wants", "savings", "keep"]>>>;
        status: z.ZodEnum<["pending", "resolved", "dismissed"]>;
        createdAt: z.ZodString;
        resolvedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "resolved" | "dismissed";
        id: string;
        createdAt: string;
        projectId: string;
        incomeEventId: string;
        excessAmount: number;
        chosenTarget?: "savings" | "needs" | "wants" | "keep" | null | undefined;
        resolvedAt?: string | null | undefined;
    }, {
        status: "pending" | "resolved" | "dismissed";
        id: string;
        createdAt: string;
        projectId: string;
        incomeEventId: string;
        excessAmount: number;
        chosenTarget?: "savings" | "needs" | "wants" | "keep" | null | undefined;
        resolvedAt?: string | null | undefined;
    }>;
    PlanAssignReason: z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
        needsRatio: z.ZodOptional<z.ZodNumber>;
        needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
        goalMonthsNeeded: z.ZodOptional<z.ZodNumber>;
        goalRequiredSharePercent: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
        goalMonthsNeeded?: number | undefined;
        goalRequiredSharePercent?: number | undefined;
    }>;
    OnboardingAssignResult: z.ZodObject<{
        segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
        plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Daily Budget", "Gig — Daily Budget", "Salaried + Side Income — Structured", "Salaried + Side Income — Daily Budget", "Business — Structured"]>;
        planType: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        incomeConcentration: z.ZodOptional<z.ZodEnum<["concentrated", "diversified"]>>;
        hasSideIncome: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            reason: z.ZodString;
            needsRatio: z.ZodOptional<z.ZodNumber>;
            needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
            goalMonthsNeeded: z.ZodOptional<z.ZodNumber>;
            goalRequiredSharePercent: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }>, "many">;
        remainingAfterFixed: z.ZodNumber;
        savingsTarget: z.ZodNumber;
        spendableAmount: z.ZodNumber;
        needsRatio: z.ZodNumber;
        needsBand: z.ZodEnum<["high", "mid", "low"]>;
    }, "strip", z.ZodTypeAny, {
        incomePattern: "salaried" | "freelancer" | "mix";
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
        segment?: "individual" | "msme" | undefined;
        incomeConcentration?: "concentrated" | "diversified" | undefined;
        hasSideIncome?: boolean | undefined;
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
        segment?: "individual" | "msme" | undefined;
        incomeConcentration?: "concentrated" | "diversified" | undefined;
        hasSideIncome?: boolean | undefined;
    }>;
    CategoryAllocationPreview: z.ZodObject<{
        category: z.ZodEnum<["food", "transport", "leisure", "family"]>;
        name: z.ZodString;
        amount: z.ZodNumber;
        percentage: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        category: "food" | "transport" | "leisure" | "family";
        percentage: number;
        dailyCap?: number | undefined;
    }, {
        name: string;
        amount: number;
        category: "food" | "transport" | "leisure" | "family";
        percentage: number;
        dailyCap?: number | undefined;
    }>;
    PlanPreviewResult: z.ZodObject<{
        segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
        plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Daily Budget", "Gig — Daily Budget", "Salaried + Side Income — Structured", "Salaried + Side Income — Daily Budget", "Business — Structured"]>;
        planType: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        incomeConcentration: z.ZodOptional<z.ZodEnum<["concentrated", "diversified"]>>;
        hasSideIncome: z.ZodOptional<z.ZodBoolean>;
        reasons: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            reason: z.ZodString;
            needsRatio: z.ZodOptional<z.ZodNumber>;
            needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
            goalMonthsNeeded: z.ZodOptional<z.ZodNumber>;
            goalRequiredSharePercent: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }>, "many">;
        remainingAfterFixed: z.ZodNumber;
        savingsTarget: z.ZodNumber;
        spendableAmount: z.ZodNumber;
        needsRatio: z.ZodNumber;
        needsBand: z.ZodEnum<["high", "mid", "low"]>;
    } & {
        categoryBreakdown: z.ZodArray<z.ZodObject<{
            category: z.ZodEnum<["food", "transport", "leisure", "family"]>;
            name: z.ZodString;
            amount: z.ZodNumber;
            percentage: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            amount: number;
            category: "food" | "transport" | "leisure" | "family";
            percentage: number;
            dailyCap?: number | undefined;
        }, {
            name: string;
            amount: number;
            category: "food" | "transport" | "leisure" | "family";
            percentage: number;
            dailyCap?: number | undefined;
        }>, "many">;
        categoryPercentages: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        incomePattern: "salaried" | "freelancer" | "mix";
        categoryPercentages: Record<string, number>;
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
        categoryBreakdown: {
            name: string;
            amount: number;
            category: "food" | "transport" | "leisure" | "family";
            percentage: number;
            dailyCap?: number | undefined;
        }[];
        segment?: "individual" | "msme" | undefined;
        incomeConcentration?: "concentrated" | "diversified" | undefined;
        hasSideIncome?: boolean | undefined;
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        categoryPercentages: Record<string, number>;
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Daily Budget" | "Gig — Daily Budget" | "Salaried + Side Income — Structured" | "Salaried + Side Income — Daily Budget" | "Business — Structured";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
            goalMonthsNeeded?: number | undefined;
            goalRequiredSharePercent?: number | undefined;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
        categoryBreakdown: {
            name: string;
            amount: number;
            category: "food" | "transport" | "leisure" | "family";
            percentage: number;
            dailyCap?: number | undefined;
        }[];
        segment?: "individual" | "msme" | undefined;
        incomeConcentration?: "concentrated" | "diversified" | undefined;
        hasSideIncome?: boolean | undefined;
    }>;
    OnboardingCommitResult: z.ZodObject<{
        planId: z.ZodString;
        pockets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
            category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
            monthlyAllocation: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        planId: string;
        pockets: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
    }, {
        planId: string;
        pockets: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
    }>;
    PlanRetakeResult: z.ZodObject<{
        planId: z.ZodString;
        pockets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
            category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
            monthlyAllocation: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }>, "many">;
    } & {
        redistribution: z.ZodObject<{
            totalMoved: z.ZodNumber;
            movements: z.ZodArray<z.ZodObject<{
                fromPocketName: z.ZodString;
                toPocketName: z.ZodString;
                amount: z.ZodNumber;
                reason: z.ZodEnum<["category_match", "kind_match", "proportional", "spillover"]>;
            }, "strip", z.ZodTypeAny, {
                amount: number;
                reason: "category_match" | "kind_match" | "proportional" | "spillover";
                fromPocketName: string;
                toPocketName: string;
            }, {
                amount: number;
                reason: "category_match" | "kind_match" | "proportional" | "spillover";
                fromPocketName: string;
                toPocketName: string;
            }>, "many">;
            previousPlanType: z.ZodEnum<["structured", "daily"]>;
            newPlanType: z.ZodEnum<["structured", "daily"]>;
            nextRetakeAvailableOn: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            totalMoved: number;
            movements: {
                amount: number;
                reason: "category_match" | "kind_match" | "proportional" | "spillover";
                fromPocketName: string;
                toPocketName: string;
            }[];
            previousPlanType: "structured" | "daily";
            newPlanType: "structured" | "daily";
            nextRetakeAvailableOn: string;
        }, {
            totalMoved: number;
            movements: {
                amount: number;
                reason: "category_match" | "kind_match" | "proportional" | "spillover";
                fromPocketName: string;
                toPocketName: string;
            }[];
            previousPlanType: "structured" | "daily";
            newPlanType: "structured" | "daily";
            nextRetakeAvailableOn: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        planId: string;
        pockets: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
        redistribution: {
            totalMoved: number;
            movements: {
                amount: number;
                reason: "category_match" | "kind_match" | "proportional" | "spillover";
                fromPocketName: string;
                toPocketName: string;
            }[];
            previousPlanType: "structured" | "daily";
            newPlanType: "structured" | "daily";
            nextRetakeAvailableOn: string;
        };
    }, {
        planId: string;
        pockets: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
        redistribution: {
            totalMoved: number;
            movements: {
                amount: number;
                reason: "category_match" | "kind_match" | "proportional" | "spillover";
                fromPocketName: string;
                toPocketName: string;
            }[];
            previousPlanType: "structured" | "daily";
            newPlanType: "structured" | "daily";
            nextRetakeAvailableOn: string;
        };
    }>;
    RetakeEligibility: z.ZodObject<{
        allowed: z.ZodBoolean;
        nextRetakeAvailableOn: z.ZodNullable<z.ZodString>;
        lastRetakenAt: z.ZodNullable<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        nextRetakeAvailableOn: string | null;
        allowed: boolean;
        lastRetakenAt: string | null;
        message?: string | undefined;
    }, {
        nextRetakeAvailableOn: string | null;
        allowed: boolean;
        lastRetakenAt: string | null;
        message?: string | undefined;
    }>;
    User: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        fullName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        updatedAt: string;
        fullName: string;
        email?: string | null | undefined;
    }, {
        id: string;
        createdAt: string;
        updatedAt: string;
        fullName: string;
        email?: string | null | undefined;
    }>;
    Plan: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        type: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
        incomeIntervalDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        status: z.ZodEnum<["active", "inactive", "reassigned"]>;
        createdAt: z.ZodString;
        reassignedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "structured" | "daily";
        status: "active" | "inactive" | "reassigned";
        incomePattern: "salaried" | "freelancer" | "mix";
        id: string;
        userId: string;
        createdAt: string;
        segment?: "individual" | "msme" | undefined;
        incomeIntervalDays?: number | null | undefined;
        reassignedAt?: string | undefined;
    }, {
        type: "structured" | "daily";
        status: "active" | "inactive" | "reassigned";
        incomePattern: "salaried" | "freelancer" | "mix";
        id: string;
        userId: string;
        createdAt: string;
        segment?: "individual" | "msme" | undefined;
        incomeIntervalDays?: number | null | undefined;
        reassignedAt?: string | undefined;
    }>;
    Pocket: z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        isTimeLocked: z.ZodDefault<z.ZodBoolean>;
        lockUntil: z.ZodOptional<z.ZodString>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
        parentPocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        splitPercentage: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        isTimeLocked: boolean;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        dailyCap?: number | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable" | "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        dailyCap?: number | undefined;
        isTimeLocked?: boolean | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }>;
    PocketUpdateInput: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        name?: string | undefined;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        name?: string | undefined;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }>;
    SubPocketCreateInput: z.ZodObject<{
        name: z.ZodString;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        splitPercentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        splitPercentage: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    }, {
        name: string;
        splitPercentage: number;
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    }>;
    SubPocketRebalanceInput: z.ZodObject<{
        splits: z.ZodArray<z.ZodObject<{
            pocketId: z.ZodString;
            splitPercentage: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            pocketId: string;
            splitPercentage: number;
        }, {
            pocketId: string;
            splitPercentage: number;
        }>, "many">;
        confirmPartial: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        splits: {
            pocketId: string;
            splitPercentage: number;
        }[];
        confirmPartial: boolean;
    }, {
        splits: {
            pocketId: string;
            splitPercentage: number;
        }[];
        confirmPartial?: boolean | undefined;
    }>;
    EmergencyUnlockEligibilityResponse: z.ZodObject<{
        eligible: z.ZodBoolean;
        reason: z.ZodOptional<z.ZodEnum<["not_freelancer_plan", "insufficient_history", "monthly_limit_reached", "no_discretionary_runway", "reserve_protected"]>>;
        message: z.ZodOptional<z.ZodString>;
        analysis: z.ZodOptional<z.ZodObject<{
            least_daily_spend: z.ZodNumber;
            most_daily_spend: z.ZodNumber;
            average_daily_spend: z.ZodNumber;
            days_of_history: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            least_daily_spend: number;
            most_daily_spend: number;
            average_daily_spend: number;
            days_of_history: number;
        }, {
            least_daily_spend: number;
            most_daily_spend: number;
            average_daily_spend: number;
            days_of_history: number;
        }>>;
        discretionary_runway: z.ZodOptional<z.ZodObject<{
            total_reserve: z.ZodNumber;
            fixed_obligations: z.ZodNumber;
            discretionary_reserve: z.ZodNumber;
            daily_budget: z.ZodNumber;
            runway_days: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            total_reserve: number;
            fixed_obligations: number;
            discretionary_reserve: number;
            daily_budget: number;
            runway_days: number;
        }, {
            total_reserve: number;
            fixed_obligations: number;
            discretionary_reserve: number;
            daily_budget: number;
            runway_days: number;
        }>>;
        runway_impact_options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            emergency_amount: z.ZodNumber;
            runway_days_before: z.ZodNumber;
            runway_days_after: z.ZodNumber;
            runway_reduction_days: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            emergency_amount: number;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
        }, {
            emergency_amount: number;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
        }>, "many">>;
        last_used: z.ZodOptional<z.ZodString>;
        next_available: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        eligible: boolean;
        message?: string | undefined;
        reason?: "not_freelancer_plan" | "insufficient_history" | "monthly_limit_reached" | "no_discretionary_runway" | "reserve_protected" | undefined;
        analysis?: {
            least_daily_spend: number;
            most_daily_spend: number;
            average_daily_spend: number;
            days_of_history: number;
        } | undefined;
        discretionary_runway?: {
            total_reserve: number;
            fixed_obligations: number;
            discretionary_reserve: number;
            daily_budget: number;
            runway_days: number;
        } | undefined;
        runway_impact_options?: {
            emergency_amount: number;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
        }[] | undefined;
        last_used?: string | undefined;
        next_available?: string | undefined;
    }, {
        eligible: boolean;
        message?: string | undefined;
        reason?: "not_freelancer_plan" | "insufficient_history" | "monthly_limit_reached" | "no_discretionary_runway" | "reserve_protected" | undefined;
        analysis?: {
            least_daily_spend: number;
            most_daily_spend: number;
            average_daily_spend: number;
            days_of_history: number;
        } | undefined;
        discretionary_runway?: {
            total_reserve: number;
            fixed_obligations: number;
            discretionary_reserve: number;
            daily_budget: number;
            runway_days: number;
        } | undefined;
        runway_impact_options?: {
            emergency_amount: number;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
        }[] | undefined;
        last_used?: string | undefined;
        next_available?: string | undefined;
    }>;
    EmergencyUnlockRequest: z.ZodObject<{
        amount: z.ZodNumber;
        confirm_impact: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        confirm_impact: boolean;
    }, {
        amount: number;
        confirm_impact: boolean;
    }>;
    EmergencyUnlockResponse: z.ZodObject<{
        applied: z.ZodBoolean;
        unlock: z.ZodOptional<z.ZodObject<{
            id: z.ZodString;
            amount: z.ZodNumber;
            runway_days_before: z.ZodNumber;
            runway_days_after: z.ZodNumber;
            runway_reduction_days: z.ZodNumber;
            allocations: z.ZodArray<z.ZodObject<{
                pocket_id: z.ZodString;
                pocket_name: z.ZodString;
                amount: z.ZodNumber;
                percentage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                amount: number;
                percentage: number;
                pocket_id: string;
                pocket_name: string;
            }, {
                amount: number;
                percentage: number;
                pocket_id: string;
                pocket_name: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            amount: number;
            id: string;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
            allocations: {
                amount: number;
                percentage: number;
                pocket_id: string;
                pocket_name: string;
            }[];
        }, {
            amount: number;
            id: string;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
            allocations: {
                amount: number;
                percentage: number;
                pocket_id: string;
                pocket_name: string;
            }[];
        }>>;
        error: z.ZodOptional<z.ZodString>;
        message: z.ZodOptional<z.ZodString>;
        next_available: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        applied: boolean;
        message?: string | undefined;
        next_available?: string | undefined;
        unlock?: {
            amount: number;
            id: string;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
            allocations: {
                amount: number;
                percentage: number;
                pocket_id: string;
                pocket_name: string;
            }[];
        } | undefined;
        error?: string | undefined;
    }, {
        applied: boolean;
        message?: string | undefined;
        next_available?: string | undefined;
        unlock?: {
            amount: number;
            id: string;
            runway_days_before: number;
            runway_days_after: number;
            runway_reduction_days: number;
            allocations: {
                amount: number;
                percentage: number;
                pocket_id: string;
                pocket_name: string;
            }[];
        } | undefined;
        error?: string | undefined;
    }>;
    RunwayImpactOption: z.ZodObject<{
        emergency_amount: z.ZodNumber;
        runway_days_before: z.ZodNumber;
        runway_days_after: z.ZodNumber;
        runway_reduction_days: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        emergency_amount: number;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
    }, {
        emergency_amount: number;
        runway_days_before: number;
        runway_days_after: number;
        runway_reduction_days: number;
    }>;
    DiscretionaryRunway: z.ZodObject<{
        total_reserve: z.ZodNumber;
        fixed_obligations: z.ZodNumber;
        discretionary_reserve: z.ZodNumber;
        daily_budget: z.ZodNumber;
        runway_days: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        total_reserve: number;
        fixed_obligations: number;
        discretionary_reserve: number;
        daily_budget: number;
        runway_days: number;
    }, {
        total_reserve: number;
        fixed_obligations: number;
        discretionary_reserve: number;
        daily_budget: number;
        runway_days: number;
    }>;
    EmergencyUnlockEligibilityReason: z.ZodEnum<["not_freelancer_plan", "insufficient_history", "monthly_limit_reached", "no_discretionary_runway", "reserve_protected"]>;
    RepaymentCadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
    RepaymentSchedule: z.ZodObject<{
        totalAmount: z.ZodNumber;
        repaymentAmount: z.ZodNumber;
        cadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
        startDate: z.ZodString;
        endDate: z.ZodString;
        nextDueDate: z.ZodString;
        totalPayments: z.ZodNumber;
        paymentsMade: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        nextDueDate: string;
        totalPayments: number;
        paymentsMade: number;
    }, {
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        nextDueDate: string;
        totalPayments: number;
        paymentsMade: number;
    }>;
    LoanCreateInput: z.ZodObject<{
        name: z.ZodString;
        totalAmount: z.ZodNumber;
        repaymentAmount: z.ZodNumber;
        cadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
        startDate: z.ZodString;
        endDate: z.ZodString;
        dueDay: z.ZodNumber;
        loanProvider: z.ZodOptional<z.ZodString>;
        loanPurpose: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dueDay: number;
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        loanProvider?: string | undefined;
        loanPurpose?: string | undefined;
    }, {
        name: string;
        dueDay: number;
        totalAmount: number;
        repaymentAmount: number;
        cadence: "weekly" | "biweekly" | "monthly";
        startDate: string;
        endDate: string;
        loanProvider?: string | undefined;
        loanPurpose?: string | undefined;
    }>;
    LoanUpdateInput: z.ZodObject<{
        repaymentSchedule: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalAmount: z.ZodOptional<z.ZodNumber>;
            repaymentAmount: z.ZodOptional<z.ZodNumber>;
            cadence: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly"]>>;
            startDate: z.ZodOptional<z.ZodString>;
            endDate: z.ZodOptional<z.ZodString>;
            nextDueDate: z.ZodOptional<z.ZodString>;
            totalPayments: z.ZodOptional<z.ZodNumber>;
            paymentsMade: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            totalAmount?: number | undefined;
            repaymentAmount?: number | undefined;
            cadence?: "weekly" | "biweekly" | "monthly" | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            nextDueDate?: string | undefined;
            totalPayments?: number | undefined;
            paymentsMade?: number | undefined;
        }, {
            totalAmount?: number | undefined;
            repaymentAmount?: number | undefined;
            cadence?: "weekly" | "biweekly" | "monthly" | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            nextDueDate?: string | undefined;
            totalPayments?: number | undefined;
            paymentsMade?: number | undefined;
        }>>>;
        loanProvider: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        loanPurpose: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        loanProvider?: string | undefined;
        loanPurpose?: string | undefined;
        repaymentSchedule?: {
            totalAmount?: number | undefined;
            repaymentAmount?: number | undefined;
            cadence?: "weekly" | "biweekly" | "monthly" | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            nextDueDate?: string | undefined;
            totalPayments?: number | undefined;
            paymentsMade?: number | undefined;
        } | undefined;
    }, {
        loanProvider?: string | undefined;
        loanPurpose?: string | undefined;
        repaymentSchedule?: {
            totalAmount?: number | undefined;
            repaymentAmount?: number | undefined;
            cadence?: "weekly" | "biweekly" | "monthly" | undefined;
            startDate?: string | undefined;
            endDate?: string | undefined;
            nextDueDate?: string | undefined;
            totalPayments?: number | undefined;
            paymentsMade?: number | undefined;
        } | undefined;
    }>;
    LoanPurposePocketInput: z.ZodObject<{
        name: z.ZodString;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
        splitPercentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        splitPercentage: number;
    }, {
        name: string;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        splitPercentage: number;
    }>;
    LoanDetail: z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
        name: z.ZodString;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
        isTimeLocked: z.ZodDefault<z.ZodBoolean>;
        lockUntil: z.ZodOptional<z.ZodString>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
        parentPocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        splitPercentage: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    } & {
        kind: z.ZodLiteral<"loan">;
        repaymentSchedule: z.ZodObject<{
            totalAmount: z.ZodNumber;
            repaymentAmount: z.ZodNumber;
            cadence: z.ZodEnum<["weekly", "biweekly", "monthly"]>;
            startDate: z.ZodString;
            endDate: z.ZodString;
            nextDueDate: z.ZodString;
            totalPayments: z.ZodNumber;
            paymentsMade: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            totalAmount: number;
            repaymentAmount: number;
            cadence: "weekly" | "biweekly" | "monthly";
            startDate: string;
            endDate: string;
            nextDueDate: string;
            totalPayments: number;
            paymentsMade: number;
        }, {
            totalAmount: number;
            repaymentAmount: number;
            cadence: "weekly" | "biweekly" | "monthly";
            startDate: string;
            endDate: string;
            nextDueDate: string;
            totalPayments: number;
            paymentsMade: number;
        }>;
        loanProvider: z.ZodNullable<z.ZodString>;
        loanPurpose: z.ZodNullable<z.ZodString>;
        dueDay: z.ZodNumber;
        subPockets: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            planId: z.ZodString;
            segment: z.ZodOptional<z.ZodEnum<["individual", "msme"]>>;
            name: z.ZodString;
            kind: z.ZodEnum<["savings", "fixed", "spendable", "loan"]>;
            category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>>;
            isTimeLocked: z.ZodDefault<z.ZodBoolean>;
            lockUntil: z.ZodOptional<z.ZodString>;
            monthlyAllocation: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
            parentPocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            splitPercentage: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            planId: string;
            createdAt: string;
            updatedAt: string;
            monthlyAllocation: number;
            isTimeLocked: boolean;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            segment?: "individual" | "msme" | undefined;
            dailyCap?: number | undefined;
            lockUntil?: string | undefined;
            parentPocketId?: string | null | undefined;
            splitPercentage?: number | null | undefined;
        }, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            planId: string;
            createdAt: string;
            updatedAt: string;
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            segment?: "individual" | "msme" | undefined;
            dailyCap?: number | undefined;
            isTimeLocked?: boolean | undefined;
            lockUntil?: string | undefined;
            parentPocketId?: string | null | undefined;
            splitPercentage?: number | null | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dueDay: number;
        id: string;
        kind: "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        isTimeLocked: boolean;
        loanProvider: string | null;
        loanPurpose: string | null;
        repaymentSchedule: {
            totalAmount: number;
            repaymentAmount: number;
            cadence: "weekly" | "biweekly" | "monthly";
            startDate: string;
            endDate: string;
            nextDueDate: string;
            totalPayments: number;
            paymentsMade: number;
        };
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        subPockets?: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            planId: string;
            createdAt: string;
            updatedAt: string;
            monthlyAllocation: number;
            isTimeLocked: boolean;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            segment?: "individual" | "msme" | undefined;
            dailyCap?: number | undefined;
            lockUntil?: string | undefined;
            parentPocketId?: string | null | undefined;
            splitPercentage?: number | null | undefined;
        }[] | undefined;
        dailyCap?: number | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }, {
        name: string;
        dueDay: number;
        id: string;
        kind: "loan";
        planId: string;
        createdAt: string;
        updatedAt: string;
        monthlyAllocation: number;
        loanProvider: string | null;
        loanPurpose: string | null;
        repaymentSchedule: {
            totalAmount: number;
            repaymentAmount: number;
            cadence: "weekly" | "biweekly" | "monthly";
            startDate: string;
            endDate: string;
            nextDueDate: string;
            totalPayments: number;
            paymentsMade: number;
        };
        category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        segment?: "individual" | "msme" | undefined;
        subPockets?: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable" | "loan";
            planId: string;
            createdAt: string;
            updatedAt: string;
            monthlyAllocation: number;
            category?: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            segment?: "individual" | "msme" | undefined;
            dailyCap?: number | undefined;
            isTimeLocked?: boolean | undefined;
            lockUntil?: string | undefined;
            parentPocketId?: string | null | undefined;
            splitPercentage?: number | null | undefined;
        }[] | undefined;
        dailyCap?: number | undefined;
        isTimeLocked?: boolean | undefined;
        lockUntil?: string | undefined;
        parentPocketId?: string | null | undefined;
        splitPercentage?: number | null | undefined;
    }>;
    FixedExpense: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        name: z.ZodString;
        amount: z.ZodNumber;
        dueDay: z.ZodNumber;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "stock", "supplier", "licence", "tax", "salary", "rent", "operations", "profit", "owner_draw", "growth", "marketing", "equipment", "other"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        id: string;
        userId: string;
        createdAt: string;
        updatedAt: string;
    }, {
        name: string;
        amount: number;
        dueDay: number;
        category: "stock" | "supplier" | "licence" | "tax" | "salary" | "rent" | "operations" | "profit" | "owner_draw" | "growth" | "marketing" | "equipment" | "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        id: string;
        userId: string;
        createdAt: string;
        updatedAt: string;
    }>;
    IncomeEvent: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        amount: z.ZodNumber;
        source: z.ZodString;
        label: z.ZodString;
        date: z.ZodString;
        runAllocation: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        date: string;
        id: string;
        source: string;
        label: string;
        userId: string;
        createdAt: string;
        runAllocation: boolean;
    }, {
        amount: number;
        date: string;
        id: string;
        source: string;
        label: string;
        userId: string;
        createdAt: string;
        runAllocation?: boolean | undefined;
    }>;
    Transaction: z.ZodObject<{
        id: z.ZodString;
        pocketId: z.ZodString;
        amount: z.ZodNumber;
        type: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover", "reserve_release", "reserve_return", "daily_overspend_debit", "fixed_expense_earmark", "fixed_expense_carry_forward"]>;
        merchant: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>>;
        createdAt: z.ZodString;
        dailyAllocationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover" | "reserve_release" | "reserve_return" | "daily_overspend_debit" | "fixed_expense_earmark" | "fixed_expense_carry_forward";
        amount: number;
        id: string;
        createdAt: string;
        pocketId: string;
        category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
        merchant?: string | undefined;
        dailyAllocationId?: string | null | undefined;
    }, {
        type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover" | "reserve_release" | "reserve_return" | "daily_overspend_debit" | "fixed_expense_earmark" | "fixed_expense_carry_forward";
        amount: number;
        id: string;
        createdAt: string;
        pocketId: string;
        category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
        merchant?: string | undefined;
        dailyAllocationId?: string | null | undefined;
    }>;
    DailyAllocation: z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        userId: z.ZodString;
        allocationDate: z.ZodString;
        plannedAmount: z.ZodNumber;
        actualSpend: z.ZodNumber;
        returnedAmount: z.ZodNumber;
        overspendAmount: z.ZodNumber;
        runwayDaysAtOpen: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        runwayDaysAtClose: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        status: z.ZodEnum<["open", "closed"]>;
        createdAt: z.ZodString;
        closedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "closed";
        id: string;
        userId: string;
        planId: string;
        createdAt: string;
        allocationDate: string;
        plannedAmount: number;
        actualSpend: number;
        returnedAmount: number;
        overspendAmount: number;
        runwayDaysAtOpen?: number | null | undefined;
        runwayDaysAtClose?: number | null | undefined;
        closedAt?: string | null | undefined;
    }, {
        status: "open" | "closed";
        id: string;
        userId: string;
        planId: string;
        createdAt: string;
        allocationDate: string;
        plannedAmount: number;
        actualSpend: number;
        returnedAmount: number;
        overspendAmount: number;
        runwayDaysAtOpen?: number | null | undefined;
        runwayDaysAtClose?: number | null | undefined;
        closedAt?: string | null | undefined;
    }>;
    Reallocation: z.ZodObject<{
        id: z.ZodString;
        fromPocketId: z.ZodString;
        toPocketId: z.ZodString;
        amount: z.ZodNumber;
        reason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
        status: z.ZodEnum<["pending", "cooling_off", "completed", "skipped"]>;
        coolingOffEndsAt: z.ZodOptional<z.ZodString>;
        disciplineCost: z.ZodDefault<z.ZodNumber>;
        createdAt: z.ZodString;
        completedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "cooling_off" | "completed" | "skipped";
        amount: number;
        id: string;
        createdAt: string;
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        fromPocketId: string;
        toPocketId: string;
        disciplineCost: number;
        completedAt?: string | undefined;
        coolingOffEndsAt?: string | undefined;
    }, {
        status: "pending" | "cooling_off" | "completed" | "skipped";
        amount: number;
        id: string;
        createdAt: string;
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        fromPocketId: string;
        toPocketId: string;
        completedAt?: string | undefined;
        coolingOffEndsAt?: string | undefined;
        disciplineCost?: number | undefined;
    }>;
    ReallocationInput: z.ZodObject<{
        fromPocketId: z.ZodString;
        toPocketId: z.ZodString;
        amount: z.ZodNumber;
        reason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        fromPocketId: string;
        toPocketId: string;
    }, {
        amount: number;
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        fromPocketId: string;
        toPocketId: string;
    }>;
    ReallocationCompleteInput: z.ZodObject<{
        skipCoolingOff: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        skipCoolingOff: boolean;
    }, {
        skipCoolingOff?: boolean | undefined;
    }>;
    MerchantClassification: z.ZodObject<{
        id: z.ZodString;
        recipientKey: z.ZodString;
        category: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
        remember: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
        id: string;
        createdAt: string;
        recipientKey: string;
        remember: boolean;
    }, {
        category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
        id: string;
        createdAt: string;
        recipientKey: string;
        remember?: boolean | undefined;
    }>;
    BehaviorEvent: z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: string;
        id: string;
        createdAt: string;
        payload: Record<string, unknown>;
    }, {
        type: string;
        id: string;
        createdAt: string;
        payload: Record<string, unknown>;
    }>;
    DisciplineScore: z.ZodObject<{
        userId: z.ZodString;
        score: z.ZodNumber;
        delta: z.ZodNumber;
        period: z.ZodString;
        calculatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        userId: string;
        score: number;
        delta: number;
        period: string;
        calculatedAt: string;
    }, {
        userId: string;
        score: number;
        delta: number;
        period: string;
        calculatedAt: string;
    }>;
    InvoiceStatus: z.ZodEnum<["draft", "sent", "paid", "void"]>;
    EtimsStatus: z.ZodEnum<["pending", "submitted", "accepted"]>;
    KraPin: z.ZodString;
    InvoiceCreateInput: z.ZodObject<{
        customerName: z.ZodString;
        customerPin: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        amount: z.ZodNumber;
        dueDate: z.ZodString;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        amount: number;
        customerName: string;
        dueDate: string;
        customerPin?: string | null | undefined;
        description?: string | null | undefined;
    }, {
        amount: number;
        customerName: string;
        dueDate: string;
        customerPin?: string | null | undefined;
        description?: string | null | undefined;
    }>;
    InvoiceUpdateInput: z.ZodObject<{
        customerName: z.ZodOptional<z.ZodString>;
        customerPin: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        amount: z.ZodOptional<z.ZodNumber>;
        dueDate: z.ZodOptional<z.ZodString>;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodEnum<["draft", "sent", "paid", "void"]>>;
        etimsStatus: z.ZodNullable<z.ZodOptional<z.ZodEnum<["pending", "submitted", "accepted"]>>>;
    }, "strip", z.ZodTypeAny, {
        status?: "void" | "draft" | "sent" | "paid" | undefined;
        amount?: number | undefined;
        customerName?: string | undefined;
        customerPin?: string | null | undefined;
        dueDate?: string | undefined;
        description?: string | null | undefined;
        etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
    }, {
        status?: "void" | "draft" | "sent" | "paid" | undefined;
        amount?: number | undefined;
        customerName?: string | undefined;
        customerPin?: string | null | undefined;
        dueDate?: string | undefined;
        description?: string | null | undefined;
        etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
    }>;
    Invoice: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        planId: z.ZodString;
        customerName: z.ZodString;
        customerPin: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        amount: z.ZodNumber;
        dueDate: z.ZodString;
        status: z.ZodEnum<["draft", "sent", "paid", "void"]>;
        description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        etimsStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<["pending", "submitted", "accepted"]>>>;
        paidAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        voidedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        isOverdue: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        status: "void" | "draft" | "sent" | "paid";
        amount: number;
        id: string;
        userId: string;
        planId: string;
        createdAt: string;
        updatedAt: string;
        customerName: string;
        dueDate: string;
        customerPin?: string | null | undefined;
        description?: string | null | undefined;
        etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
        paidAt?: string | null | undefined;
        voidedAt?: string | null | undefined;
        isOverdue?: boolean | undefined;
    }, {
        status: "void" | "draft" | "sent" | "paid";
        amount: number;
        id: string;
        userId: string;
        planId: string;
        createdAt: string;
        updatedAt: string;
        customerName: string;
        dueDate: string;
        customerPin?: string | null | undefined;
        description?: string | null | undefined;
        etimsStatus?: "pending" | "submitted" | "accepted" | null | undefined;
        paidAt?: string | null | undefined;
        voidedAt?: string | null | undefined;
        isOverdue?: boolean | undefined;
    }>;
    MsmeInvoiceStats: z.ZodObject<{
        total: z.ZodNumber;
        draft: z.ZodNumber;
        sent: z.ZodNumber;
        paid: z.ZodNumber;
        voidCount: z.ZodNumber;
        overdue: z.ZodNumber;
        outstanding: z.ZodNumber;
        overdueAmount: z.ZodNumber;
        paidAmount: z.ZodNumber;
        collectionRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        draft: number;
        sent: number;
        paid: number;
        total: number;
        voidCount: number;
        overdue: number;
        outstanding: number;
        overdueAmount: number;
        paidAmount: number;
        collectionRate: number;
    }, {
        draft: number;
        sent: number;
        paid: number;
        total: number;
        voidCount: number;
        overdue: number;
        outstanding: number;
        overdueAmount: number;
        paidAmount: number;
        collectionRate: number;
    }>;
    MsmeProjectStats: z.ZodObject<{
        total: z.ZodNumber;
        active: z.ZodNumber;
        draft: z.ZodNumber;
        completed: z.ZodNumber;
        totalContractValue: z.ZodNumber;
        totalAllocated: z.ZodNumber;
        totalSpent: z.ZodNumber;
        fundingPercent: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        completed: number;
        active: number;
        draft: number;
        fundingPercent: number;
        totalAllocated: number;
        totalSpent: number;
        total: number;
        totalContractValue: number;
    }, {
        completed: number;
        active: number;
        draft: number;
        fundingPercent: number;
        totalAllocated: number;
        totalSpent: number;
        total: number;
        totalContractValue: number;
    }>;
    MsmeAlert: z.ZodObject<{
        type: z.ZodEnum<["overdue_receivables", "funding_stalled", "wants_discipline", "no_data"]>;
        message: z.ZodString;
        severity: z.ZodEnum<["info", "warn", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
        severity: "info" | "warn" | "critical";
    }, {
        message: string;
        type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
        severity: "info" | "warn" | "critical";
    }>;
    MsmeOperationalInsights: z.ZodObject<{
        invoices: z.ZodObject<{
            total: z.ZodNumber;
            draft: z.ZodNumber;
            sent: z.ZodNumber;
            paid: z.ZodNumber;
            voidCount: z.ZodNumber;
            overdue: z.ZodNumber;
            outstanding: z.ZodNumber;
            overdueAmount: z.ZodNumber;
            paidAmount: z.ZodNumber;
            collectionRate: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            draft: number;
            sent: number;
            paid: number;
            total: number;
            voidCount: number;
            overdue: number;
            outstanding: number;
            overdueAmount: number;
            paidAmount: number;
            collectionRate: number;
        }, {
            draft: number;
            sent: number;
            paid: number;
            total: number;
            voidCount: number;
            overdue: number;
            outstanding: number;
            overdueAmount: number;
            paidAmount: number;
            collectionRate: number;
        }>;
        projects: z.ZodObject<{
            total: z.ZodNumber;
            active: z.ZodNumber;
            draft: z.ZodNumber;
            completed: z.ZodNumber;
            totalContractValue: z.ZodNumber;
            totalAllocated: z.ZodNumber;
            totalSpent: z.ZodNumber;
            fundingPercent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            completed: number;
            active: number;
            draft: number;
            fundingPercent: number;
            totalAllocated: number;
            totalSpent: number;
            total: number;
            totalContractValue: number;
        }, {
            completed: number;
            active: number;
            draft: number;
            fundingPercent: number;
            totalAllocated: number;
            totalSpent: number;
            total: number;
            totalContractValue: number;
        }>;
        fundingVelocityDays: z.ZodNullable<z.ZodNumber>;
        alerts: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["overdue_receivables", "funding_stalled", "wants_discipline", "no_data"]>;
            message: z.ZodString;
            severity: z.ZodEnum<["info", "warn", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
            severity: "info" | "warn" | "critical";
        }, {
            message: string;
            type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
            severity: "info" | "warn" | "critical";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        invoices: {
            draft: number;
            sent: number;
            paid: number;
            total: number;
            voidCount: number;
            overdue: number;
            outstanding: number;
            overdueAmount: number;
            paidAmount: number;
            collectionRate: number;
        };
        projects: {
            completed: number;
            active: number;
            draft: number;
            fundingPercent: number;
            totalAllocated: number;
            totalSpent: number;
            total: number;
            totalContractValue: number;
        };
        fundingVelocityDays: number | null;
        alerts: {
            message: string;
            type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
            severity: "info" | "warn" | "critical";
        }[];
    }, {
        invoices: {
            draft: number;
            sent: number;
            paid: number;
            total: number;
            voidCount: number;
            overdue: number;
            outstanding: number;
            overdueAmount: number;
            paidAmount: number;
            collectionRate: number;
        };
        projects: {
            completed: number;
            active: number;
            draft: number;
            fundingPercent: number;
            totalAllocated: number;
            totalSpent: number;
            total: number;
            totalContractValue: number;
        };
        fundingVelocityDays: number | null;
        alerts: {
            message: string;
            type: "overdue_receivables" | "funding_stalled" | "wants_discipline" | "no_data";
            severity: "info" | "warn" | "critical";
        }[];
    }>;
    StockItemCreateInput: z.ZodObject<{
        name: z.ZodString;
        sku: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        qtyOnHand: z.ZodOptional<z.ZodNumber>;
        unitCost: z.ZodNumber;
        unitPrice: z.ZodNumber;
        lowStockThreshold: z.ZodOptional<z.ZodNumber>;
        location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        unitCost: number;
        unitPrice: number;
        sku?: string | null | undefined;
        qtyOnHand?: number | undefined;
        lowStockThreshold?: number | undefined;
        location?: string | null | undefined;
    }, {
        name: string;
        unitCost: number;
        unitPrice: number;
        sku?: string | null | undefined;
        qtyOnHand?: number | undefined;
        lowStockThreshold?: number | undefined;
        location?: string | null | undefined;
    }>;
    StockItemUpdateInput: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        sku: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        unitCost: z.ZodOptional<z.ZodNumber>;
        unitPrice: z.ZodOptional<z.ZodNumber>;
        lowStockThreshold: z.ZodOptional<z.ZodNumber>;
        location: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        sku?: string | null | undefined;
        unitCost?: number | undefined;
        unitPrice?: number | undefined;
        lowStockThreshold?: number | undefined;
        location?: string | null | undefined;
    }, {
        name?: string | undefined;
        sku?: string | null | undefined;
        unitCost?: number | undefined;
        unitPrice?: number | undefined;
        lowStockThreshold?: number | undefined;
        location?: string | null | undefined;
    }>;
    StockMovementType: z.ZodEnum<["in", "out", "adjust"]>;
    StockMovementCreateInput: z.ZodObject<{
        type: z.ZodEnum<["in", "out", "adjust"]>;
        qty: z.ZodNumber;
        unitCost: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        note: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        pocketId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "in" | "out" | "adjust";
        qty: number;
        note?: string | null | undefined;
        unitCost?: number | null | undefined;
        pocketId?: string | null | undefined;
    }, {
        type: "in" | "out" | "adjust";
        qty: number;
        note?: string | null | undefined;
        unitCost?: number | null | undefined;
        pocketId?: string | null | undefined;
    }>;
    StockItem: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        planId: z.ZodString;
        name: z.ZodString;
        sku: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        qtyOnHand: z.ZodNumber;
        unitCost: z.ZodNumber;
        unitPrice: z.ZodNumber;
        lowStockThreshold: z.ZodNumber;
        location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        isLowStock: z.ZodOptional<z.ZodBoolean>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        userId: string;
        planId: string;
        createdAt: string;
        updatedAt: string;
        qtyOnHand: number;
        unitCost: number;
        unitPrice: number;
        lowStockThreshold: number;
        sku?: string | null | undefined;
        location?: string | null | undefined;
        isLowStock?: boolean | undefined;
    }, {
        name: string;
        id: string;
        userId: string;
        planId: string;
        createdAt: string;
        updatedAt: string;
        qtyOnHand: number;
        unitCost: number;
        unitPrice: number;
        lowStockThreshold: number;
        sku?: string | null | undefined;
        location?: string | null | undefined;
        isLowStock?: boolean | undefined;
    }>;
    StockMovement: z.ZodObject<{
        id: z.ZodString;
        itemId: z.ZodString;
        userId: z.ZodString;
        type: z.ZodEnum<["in", "out", "adjust"]>;
        qty: z.ZodNumber;
        unitCost: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        totalCost: z.ZodNumber;
        note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        pocketId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "in" | "out" | "adjust";
        id: string;
        userId: string;
        createdAt: string;
        qty: number;
        itemId: string;
        totalCost: number;
        note?: string | null | undefined;
        unitCost?: number | null | undefined;
        pocketId?: string | null | undefined;
    }, {
        type: "in" | "out" | "adjust";
        id: string;
        userId: string;
        createdAt: string;
        qty: number;
        itemId: string;
        totalCost: number;
        note?: string | null | undefined;
        unitCost?: number | null | undefined;
        pocketId?: string | null | undefined;
    }>;
};
//# sourceMappingURL=index.d.ts.map