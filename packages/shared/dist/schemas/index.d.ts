import { z } from 'zod';
export declare const PlanTypeSchema: z.ZodEnum<["structured", "daily"]>;
export type PlanType = z.infer<typeof PlanTypeSchema>;
export declare const PocketKindSchema: z.ZodEnum<["savings", "fixed", "spendable"]>;
export type PocketKind = z.infer<typeof PocketKindSchema>;
export declare const PocketCategorySchema: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
export type PocketCategory = z.infer<typeof PocketCategorySchema>;
export declare const IncomePatternSchema: z.ZodEnum<["salaried", "freelancer", "mix"]>;
export type IncomePattern = z.infer<typeof IncomePatternSchema>;
export declare const IncomeIntervalBandSchema: z.ZodEnum<["weekly", "biweekly", "monthly", "irregular"]>;
export type IncomeIntervalBand = z.infer<typeof IncomeIntervalBandSchema>;
export declare const IncomeIntervalDaysByBand: Record<IncomeIntervalBand, number>;
export declare const SpendingHabitSchema: z.ZodEnum<["tracker", "week3", "off_guard"]>;
export type SpendingHabit = z.infer<typeof SpendingHabitSchema>;
export declare const PlanNameSchema: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
export type PlanName = z.infer<typeof PlanNameSchema>;
export declare const TransactionTypeSchema: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover"]>;
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
export declare const CategoryPercentagesSchema: z.ZodRecord<z.ZodEnum<["food", "transport", "leisure", "family"]>, z.ZodNumber>;
export type CategoryPercentages = z.infer<typeof CategoryPercentagesSchema>;
export declare const FixedExpenseInputSchema: z.ZodObject<{
    name: z.ZodString;
    amount: z.ZodNumber;
    dueDay: z.ZodNumber;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    amount: number;
    dueDay: number;
    category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
}, {
    name: string;
    amount: number;
    dueDay: number;
    category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
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
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        dueDay: number;
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    }, {
        name: string;
        amount: number;
        dueDay: number;
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    }>, "many">>;
    incomeIntervalBand: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly", "irregular"]>>;
    lifeStage: z.ZodOptional<z.ZodEnum<["student", "working_adult", "self_employed"]>>;
    hasDependents: z.ZodOptional<z.ZodBoolean>;
    emergencyBuffer: z.ZodOptional<z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>>;
    moneyPersonality: z.ZodOptional<z.ZodEnum<["spender", "saver", "avoider"]>>;
    categoryPercentages: z.ZodOptional<z.ZodRecord<z.ZodEnum<["food", "transport", "leisure", "family"]>, z.ZodNumber>>;
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
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    }[] | undefined;
    incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
    lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
    hasDependents?: boolean | undefined;
    emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
    moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
    categoryPercentages?: Partial<Record<"food" | "transport" | "leisure" | "family", number>> | undefined;
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
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    }[] | undefined;
    incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
    lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
    hasDependents?: boolean | undefined;
    emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
    moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
    categoryPercentages?: Partial<Record<"food" | "transport" | "leisure" | "family", number>> | undefined;
}>;
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
export declare const PlanAssignReasonSchema: z.ZodObject<{
    rule: z.ZodString;
    reason: z.ZodString;
    needsRatio: z.ZodOptional<z.ZodNumber>;
    needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
}, "strip", z.ZodTypeAny, {
    rule: string;
    reason: string;
    needsRatio?: number | undefined;
    needsBand?: "high" | "mid" | "low" | undefined;
}, {
    rule: string;
    reason: string;
    needsRatio?: number | undefined;
    needsBand?: "high" | "mid" | "low" | undefined;
}>;
export type PlanAssignReason = z.infer<typeof PlanAssignReasonSchema>;
export declare const OnboardingAssignResultSchema: z.ZodObject<{
    plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
    planType: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    reasons: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
        needsRatio: z.ZodOptional<z.ZodNumber>;
        needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
    }, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
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
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
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
    plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
    planType: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    reasons: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
        needsRatio: z.ZodOptional<z.ZodNumber>;
        needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
    }, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
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
    categoryPercentages: z.ZodRecord<z.ZodEnum<["food", "transport", "leisure", "family"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    incomePattern: "salaried" | "freelancer" | "mix";
    categoryPercentages: Partial<Record<"food" | "transport" | "leisure" | "family", number>>;
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
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
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    categoryPercentages: Partial<Record<"food" | "transport" | "leisure" | "family", number>>;
    needsRatio: number;
    needsBand: "high" | "mid" | "low";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
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
}>;
export type PlanPreviewResult = z.infer<typeof PlanPreviewResultSchema>;
export declare const OnboardingCommitResultSchema: z.ZodObject<{
    planId: z.ZodString;
    pockets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    planId: string;
    pockets: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
}, {
    planId: string;
    pockets: {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
        kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        name: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
}, "strip", z.ZodTypeAny, {
    applicable: boolean;
    runwayDays?: number | undefined;
    expectedIntervalDays?: number | undefined;
    daysSinceLastIncome?: number | undefined;
    confidence?: "estimate" | "historical" | undefined;
}, {
    applicable: boolean;
    runwayDays?: number | undefined;
    expectedIntervalDays?: number | undefined;
    daysSinceLastIncome?: number | undefined;
    confidence?: "estimate" | "historical" | undefined;
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
    fullName: string;
    createdAt: string;
    updatedAt: string;
    email?: string | null | undefined;
}, {
    id: string;
    fullName: string;
    createdAt: string;
    updatedAt: string;
    email?: string | null | undefined;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const PlanSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    incomeIntervalDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodEnum<["active", "inactive", "reassigned"]>;
    createdAt: z.ZodString;
    reassignedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "structured" | "daily";
    status: "active" | "inactive" | "reassigned";
    incomePattern: "salaried" | "freelancer" | "mix";
    id: string;
    createdAt: string;
    userId: string;
    incomeIntervalDays?: number | null | undefined;
    reassignedAt?: string | undefined;
}, {
    type: "structured" | "daily";
    status: "active" | "inactive" | "reassigned";
    incomePattern: "salaried" | "freelancer" | "mix";
    id: string;
    createdAt: string;
    userId: string;
    incomeIntervalDays?: number | null | undefined;
    reassignedAt?: string | undefined;
}>;
export type Plan = z.infer<typeof PlanSchema>;
export declare const PocketSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
    isTimeLocked: z.ZodDefault<z.ZodBoolean>;
    lockUntil: z.ZodOptional<z.ZodString>;
    monthlyAllocation: z.ZodNumber;
    dailyCap: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    planId: string;
    id: string;
    kind: "savings" | "fixed" | "spendable";
    monthlyAllocation: number;
    createdAt: string;
    updatedAt: string;
    isTimeLocked: boolean;
    category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    dailyCap?: number | undefined;
    lockUntil?: string | undefined;
}, {
    name: string;
    planId: string;
    id: string;
    kind: "savings" | "fixed" | "spendable";
    monthlyAllocation: number;
    createdAt: string;
    updatedAt: string;
    category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    dailyCap?: number | undefined;
    isTimeLocked?: boolean | undefined;
    lockUntil?: string | undefined;
}>;
export type Pocket = z.infer<typeof PocketSchema>;
export declare const PocketUpdateInputSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
    dailyCap: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    name?: string | undefined;
    category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    dailyCap?: number | undefined;
}, {
    name?: string | undefined;
    category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
    dailyCap?: number | undefined;
}>;
export type PocketUpdateInput = z.infer<typeof PocketUpdateInputSchema>;
export declare const FixedExpenseSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    amount: z.ZodNumber;
    dueDay: z.ZodNumber;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    amount: number;
    dueDay: number;
    category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    id: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
}, {
    name: string;
    amount: number;
    dueDay: number;
    category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
    id: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
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
    createdAt: string;
    userId: string;
    source: string;
    label: string;
    runAllocation: boolean;
}, {
    amount: number;
    date: string;
    id: string;
    createdAt: string;
    userId: string;
    source: string;
    label: string;
    runAllocation?: boolean | undefined;
}>;
export type IncomeEvent = z.infer<typeof IncomeEventSchema>;
export declare const TransactionSchema: z.ZodObject<{
    id: z.ZodString;
    pocketId: z.ZodString;
    amount: z.ZodNumber;
    type: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover"]>;
    merchant: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover";
    amount: number;
    id: string;
    createdAt: string;
    pocketId: string;
    category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
    merchant?: string | undefined;
}, {
    type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover";
    amount: number;
    id: string;
    createdAt: string;
    pocketId: string;
    category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
    merchant?: string | undefined;
}>;
export type Transaction = z.infer<typeof TransactionSchema>;
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
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    id: string;
    createdAt: string;
    fromPocketId: string;
    toPocketId: string;
    disciplineCost: number;
    coolingOffEndsAt?: string | undefined;
    completedAt?: string | undefined;
}, {
    status: "pending" | "cooling_off" | "completed" | "skipped";
    amount: number;
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    id: string;
    createdAt: string;
    fromPocketId: string;
    toPocketId: string;
    coolingOffEndsAt?: string | undefined;
    disciplineCost?: number | undefined;
    completedAt?: string | undefined;
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
    PocketKind: z.ZodEnum<["savings", "fixed", "spendable"]>;
    PocketCategory: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
    IncomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    SpendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
    LifeStage: z.ZodEnum<["student", "working_adult", "self_employed"]>;
    EmergencyBuffer: z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>;
    MoneyPersonality: z.ZodEnum<["spender", "saver", "avoider"]>;
    NeedsBand: z.ZodEnum<["high", "mid", "low"]>;
    PlanName: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
    TransactionType: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover"]>;
    ReallocationStatus: z.ZodEnum<["pending", "cooling_off", "completed", "skipped"]>;
    ReallocationReason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
    MerchantCategory: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
    PlanStatus: z.ZodEnum<["active", "inactive", "reassigned"]>;
    SpendableCategory: z.ZodEnum<["food", "transport", "leisure", "family"]>;
    CategoryPercentages: z.ZodRecord<z.ZodEnum<["food", "transport", "leisure", "family"]>, z.ZodNumber>;
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
            category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            amount: number;
            dueDay: number;
            category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        }, {
            name: string;
            amount: number;
            dueDay: number;
            category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        }>, "many">>;
        incomeIntervalBand: z.ZodOptional<z.ZodEnum<["weekly", "biweekly", "monthly", "irregular"]>>;
        lifeStage: z.ZodOptional<z.ZodEnum<["student", "working_adult", "self_employed"]>>;
        hasDependents: z.ZodOptional<z.ZodBoolean>;
        emergencyBuffer: z.ZodOptional<z.ZodEnum<["none", "under_month", "1_to_3_months", "3_plus_months"]>>;
        moneyPersonality: z.ZodOptional<z.ZodEnum<["spender", "saver", "avoider"]>>;
        categoryPercentages: z.ZodOptional<z.ZodRecord<z.ZodEnum<["food", "transport", "leisure", "family"]>, z.ZodNumber>>;
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
            category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        }[] | undefined;
        incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
        lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
        hasDependents?: boolean | undefined;
        emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
        moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
        categoryPercentages?: Partial<Record<"food" | "transport" | "leisure" | "family", number>> | undefined;
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
            category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        }[] | undefined;
        incomeIntervalBand?: "weekly" | "biweekly" | "monthly" | "irregular" | undefined;
        lifeStage?: "student" | "working_adult" | "self_employed" | undefined;
        hasDependents?: boolean | undefined;
        emergencyBuffer?: "none" | "under_month" | "1_to_3_months" | "3_plus_months" | undefined;
        moneyPersonality?: "spender" | "saver" | "avoider" | undefined;
        categoryPercentages?: Partial<Record<"food" | "transport" | "leisure" | "family", number>> | undefined;
    }>;
    PlanAssignReason: z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
        needsRatio: z.ZodOptional<z.ZodNumber>;
        needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
    }, {
        rule: string;
        reason: string;
        needsRatio?: number | undefined;
        needsBand?: "high" | "mid" | "low" | undefined;
    }>;
    OnboardingAssignResult: z.ZodObject<{
        plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
        planType: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        reasons: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            reason: z.ZodString;
            needsRatio: z.ZodOptional<z.ZodNumber>;
            needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
        }, "strip", z.ZodTypeAny, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
        }, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
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
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
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
        plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
        planType: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        reasons: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            reason: z.ZodString;
            needsRatio: z.ZodOptional<z.ZodNumber>;
            needsBand: z.ZodOptional<z.ZodEnum<["high", "mid", "low"]>>;
        }, "strip", z.ZodTypeAny, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
        }, {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
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
        categoryPercentages: z.ZodRecord<z.ZodEnum<["food", "transport", "leisure", "family"]>, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        incomePattern: "salaried" | "freelancer" | "mix";
        categoryPercentages: Partial<Record<"food" | "transport" | "leisure" | "family", number>>;
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
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
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        categoryPercentages: Partial<Record<"food" | "transport" | "leisure" | "family", number>>;
        needsRatio: number;
        needsBand: "high" | "mid" | "low";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
            needsRatio?: number | undefined;
            needsBand?: "high" | "mid" | "low" | undefined;
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
    }>;
    OnboardingCommitResult: z.ZodObject<{
        planId: z.ZodString;
        pockets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
            category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
            monthlyAllocation: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        planId: string;
        pockets: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
    }, {
        planId: string;
        pockets: {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
    }>;
    PlanRetakeResult: z.ZodObject<{
        planId: z.ZodString;
        pockets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
            category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
            monthlyAllocation: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
            dailyCap?: number | undefined;
        }, {
            name: string;
            id: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
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
        fullName: string;
        createdAt: string;
        updatedAt: string;
        email?: string | null | undefined;
    }, {
        id: string;
        fullName: string;
        createdAt: string;
        updatedAt: string;
        email?: string | null | undefined;
    }>;
    Plan: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        type: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        incomeIntervalDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        status: z.ZodEnum<["active", "inactive", "reassigned"]>;
        createdAt: z.ZodString;
        reassignedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "structured" | "daily";
        status: "active" | "inactive" | "reassigned";
        incomePattern: "salaried" | "freelancer" | "mix";
        id: string;
        createdAt: string;
        userId: string;
        incomeIntervalDays?: number | null | undefined;
        reassignedAt?: string | undefined;
    }, {
        type: "structured" | "daily";
        status: "active" | "inactive" | "reassigned";
        incomePattern: "salaried" | "freelancer" | "mix";
        id: string;
        createdAt: string;
        userId: string;
        incomeIntervalDays?: number | null | undefined;
        reassignedAt?: string | undefined;
    }>;
    Pocket: z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
        isTimeLocked: z.ZodDefault<z.ZodBoolean>;
        lockUntil: z.ZodOptional<z.ZodString>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        planId: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        createdAt: string;
        updatedAt: string;
        isTimeLocked: boolean;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
        lockUntil?: string | undefined;
    }, {
        name: string;
        planId: string;
        id: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        createdAt: string;
        updatedAt: string;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
        isTimeLocked?: boolean | undefined;
        lockUntil?: string | undefined;
    }>;
    PocketUpdateInput: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>>;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        name?: string | undefined;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        name?: string | undefined;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other" | undefined;
        dailyCap?: number | undefined;
    }>;
    FixedExpense: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        name: z.ZodString;
        amount: z.ZodNumber;
        dueDay: z.ZodNumber;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "housing", "family", "other"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        amount: number;
        dueDay: number;
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        id: string;
        createdAt: string;
        updatedAt: string;
        userId: string;
    }, {
        name: string;
        amount: number;
        dueDay: number;
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "housing" | "family" | "other";
        id: string;
        createdAt: string;
        updatedAt: string;
        userId: string;
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
        createdAt: string;
        userId: string;
        source: string;
        label: string;
        runAllocation: boolean;
    }, {
        amount: number;
        date: string;
        id: string;
        createdAt: string;
        userId: string;
        source: string;
        label: string;
        runAllocation?: boolean | undefined;
    }>;
    Transaction: z.ZodObject<{
        id: z.ZodString;
        pocketId: z.ZodString;
        amount: z.ZodNumber;
        type: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover"]>;
        merchant: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover";
        amount: number;
        id: string;
        createdAt: string;
        pocketId: string;
        category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
        merchant?: string | undefined;
    }, {
        type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover";
        amount: number;
        id: string;
        createdAt: string;
        pocketId: string;
        category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
        merchant?: string | undefined;
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
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        id: string;
        createdAt: string;
        fromPocketId: string;
        toPocketId: string;
        disciplineCost: number;
        coolingOffEndsAt?: string | undefined;
        completedAt?: string | undefined;
    }, {
        status: "pending" | "cooling_off" | "completed" | "skipped";
        amount: number;
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        id: string;
        createdAt: string;
        fromPocketId: string;
        toPocketId: string;
        coolingOffEndsAt?: string | undefined;
        disciplineCost?: number | undefined;
        completedAt?: string | undefined;
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
};
//# sourceMappingURL=index.d.ts.map