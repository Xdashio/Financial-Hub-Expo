import { z } from 'zod';
export declare const PlanTypeSchema: z.ZodEnum<["structured", "daily"]>;
export type PlanType = z.infer<typeof PlanTypeSchema>;
export declare const PocketKindSchema: z.ZodEnum<["savings", "fixed", "spendable"]>;
export type PocketKind = z.infer<typeof PocketKindSchema>;
export declare const PocketCategorySchema: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>;
export type PocketCategory = z.infer<typeof PocketCategorySchema>;
export declare const IncomePatternSchema: z.ZodEnum<["salaried", "freelancer", "mix"]>;
export type IncomePattern = z.infer<typeof IncomePatternSchema>;
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
export declare const OnboardingInputSchema: z.ZodObject<{
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    spendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
    incomeAmount: z.ZodNumber;
    fixedTotal: z.ZodNumber;
    sourceCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    incomePattern: "salaried" | "freelancer" | "mix";
    spendingHabit: "tracker" | "week3" | "off_guard";
    incomeAmount: number;
    fixedTotal: number;
    sourceCount: number;
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    spendingHabit: "tracker" | "week3" | "off_guard";
    incomeAmount: number;
    fixedTotal: number;
    sourceCount: number;
}>;
export type OnboardingInput = z.infer<typeof OnboardingInputSchema>;
export declare const PlanAssignReasonSchema: z.ZodObject<{
    rule: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    rule: string;
    reason: string;
}, {
    rule: string;
    reason: string;
}>;
export type PlanAssignReason = z.infer<typeof PlanAssignReasonSchema>;
export declare const OnboardingAssignResultSchema: z.ZodObject<{
    plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
    planType: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    reasons: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
    }, {
        rule: string;
        reason: string;
    }>, "many">;
    remainingAfterFixed: z.ZodNumber;
    savingsTarget: z.ZodNumber;
    spendableAmount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    incomePattern: "salaried" | "freelancer" | "mix";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
}, {
    incomePattern: "salaried" | "freelancer" | "mix";
    plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
    planType: "structured" | "daily";
    reasons: {
        rule: string;
        reason: string;
    }[];
    remainingAfterFixed: number;
    savingsTarget: number;
    spendableAmount: number;
}>;
export type OnboardingAssignResult = z.infer<typeof OnboardingAssignResultSchema>;
export declare const OnboardingCommitResultSchema: z.ZodObject<{
    planId: z.ZodString;
    pockets: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
        dailyCap?: number | undefined;
    }, {
        id: string;
        name: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
        dailyCap?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    planId: string;
    pockets: {
        id: string;
        name: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
}, {
    planId: string;
    pockets: {
        id: string;
        name: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
        dailyCap?: number | undefined;
    }[];
}>;
export type OnboardingCommitResult = z.infer<typeof OnboardingCommitResultSchema>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    fullName: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    fullName: string;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    email: string;
    fullName: string;
    createdAt: string;
    updatedAt: string;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const PlanSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    type: z.ZodEnum<["structured", "daily"]>;
    incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
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
    reassignedAt?: string | undefined;
}, {
    type: "structured" | "daily";
    status: "active" | "inactive" | "reassigned";
    incomePattern: "salaried" | "freelancer" | "mix";
    id: string;
    createdAt: string;
    userId: string;
    reassignedAt?: string | undefined;
}>;
export type Plan = z.infer<typeof PlanSchema>;
export declare const PocketSchema: z.ZodObject<{
    id: z.ZodString;
    planId: z.ZodString;
    name: z.ZodString;
    kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
    category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>>;
    isTimeLocked: z.ZodDefault<z.ZodBoolean>;
    lockUntil: z.ZodOptional<z.ZodString>;
    monthlyAllocation: z.ZodNumber;
    dailyCap: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    planId: string;
    id: string;
    name: string;
    kind: "savings" | "fixed" | "spendable";
    monthlyAllocation: number;
    createdAt: string;
    updatedAt: string;
    isTimeLocked: boolean;
    category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
    dailyCap?: number | undefined;
    lockUntil?: string | undefined;
}, {
    planId: string;
    id: string;
    name: string;
    kind: "savings" | "fixed" | "spendable";
    monthlyAllocation: number;
    createdAt: string;
    updatedAt: string;
    category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
    dailyCap?: number | undefined;
    isTimeLocked?: boolean | undefined;
    lockUntil?: string | undefined;
}>;
export type Pocket = z.infer<typeof PocketSchema>;
export declare const FixedExpenseSchema: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    amount: z.ZodNumber;
    dueDay: z.ZodNumber;
    category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other";
    createdAt: string;
    updatedAt: string;
    userId: string;
    amount: number;
    dueDay: number;
}, {
    id: string;
    name: string;
    category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other";
    createdAt: string;
    updatedAt: string;
    userId: string;
    amount: number;
    dueDay: number;
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
    date: string;
    id: string;
    createdAt: string;
    userId: string;
    amount: number;
    source: string;
    label: string;
    runAllocation: boolean;
}, {
    date: string;
    id: string;
    createdAt: string;
    userId: string;
    amount: number;
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
    id: string;
    createdAt: string;
    amount: number;
    pocketId: string;
    category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
    merchant?: string | undefined;
}, {
    type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover";
    id: string;
    createdAt: string;
    amount: number;
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
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    id: string;
    createdAt: string;
    amount: number;
    fromPocketId: string;
    toPocketId: string;
    disciplineCost: number;
    coolingOffEndsAt?: string | undefined;
    completedAt?: string | undefined;
}, {
    status: "pending" | "cooling_off" | "completed" | "skipped";
    reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
    id: string;
    createdAt: string;
    amount: number;
    fromPocketId: string;
    toPocketId: string;
    coolingOffEndsAt?: string | undefined;
    disciplineCost?: number | undefined;
    completedAt?: string | undefined;
}>;
export type Reallocation = z.infer<typeof ReallocationSchema>;
export declare const MerchantClassificationSchema: z.ZodObject<{
    id: z.ZodString;
    recipientKey: z.ZodString;
    category: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
    remember: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
    createdAt: string;
    recipientKey: string;
    remember: boolean;
}, {
    id: string;
    category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
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
    PocketCategory: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>;
    IncomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
    SpendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
    PlanName: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
    TransactionType: z.ZodEnum<["allocation", "spend", "reallocation_in", "reallocation_out", "rollover"]>;
    ReallocationStatus: z.ZodEnum<["pending", "cooling_off", "completed", "skipped"]>;
    ReallocationReason: z.ZodEnum<["emergency", "unexpected_expense", "income_change", "priority_shift", "other"]>;
    MerchantCategory: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
    PlanStatus: z.ZodEnum<["active", "inactive", "reassigned"]>;
    OnboardingInput: z.ZodObject<{
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        spendingHabit: z.ZodEnum<["tracker", "week3", "off_guard"]>;
        incomeAmount: z.ZodNumber;
        fixedTotal: z.ZodNumber;
        sourceCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        incomePattern: "salaried" | "freelancer" | "mix";
        spendingHabit: "tracker" | "week3" | "off_guard";
        incomeAmount: number;
        fixedTotal: number;
        sourceCount: number;
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        spendingHabit: "tracker" | "week3" | "off_guard";
        incomeAmount: number;
        fixedTotal: number;
        sourceCount: number;
    }>;
    PlanAssignReason: z.ZodObject<{
        rule: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rule: string;
        reason: string;
    }, {
        rule: string;
        reason: string;
    }>;
    OnboardingAssignResult: z.ZodObject<{
        plan: z.ZodEnum<["Salaried — Structured", "Salaried — Daily Budget", "Freelancer — Structured", "Freelancer — Daily Budget"]>;
        planType: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
        reasons: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            rule: string;
            reason: string;
        }, {
            rule: string;
            reason: string;
        }>, "many">;
        remainingAfterFixed: z.ZodNumber;
        savingsTarget: z.ZodNumber;
        spendableAmount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        incomePattern: "salaried" | "freelancer" | "mix";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
    }, {
        incomePattern: "salaried" | "freelancer" | "mix";
        plan: "Salaried — Structured" | "Salaried — Daily Budget" | "Freelancer — Structured" | "Freelancer — Daily Budget";
        planType: "structured" | "daily";
        reasons: {
            rule: string;
            reason: string;
        }[];
        remainingAfterFixed: number;
        savingsTarget: number;
        spendableAmount: number;
    }>;
    OnboardingCommitResult: z.ZodObject<{
        planId: z.ZodString;
        pockets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
            category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>>;
            monthlyAllocation: z.ZodNumber;
            dailyCap: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            name: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
            dailyCap?: number | undefined;
        }, {
            id: string;
            name: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
            dailyCap?: number | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        planId: string;
        pockets: {
            id: string;
            name: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
    }, {
        planId: string;
        pockets: {
            id: string;
            name: string;
            kind: "savings" | "fixed" | "spendable";
            monthlyAllocation: number;
            category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
            dailyCap?: number | undefined;
        }[];
    }>;
    User: z.ZodObject<{
        id: z.ZodString;
        email: z.ZodString;
        fullName: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        email: string;
        fullName: string;
        createdAt: string;
        updatedAt: string;
    }, {
        id: string;
        email: string;
        fullName: string;
        createdAt: string;
        updatedAt: string;
    }>;
    Plan: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        type: z.ZodEnum<["structured", "daily"]>;
        incomePattern: z.ZodEnum<["salaried", "freelancer", "mix"]>;
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
        reassignedAt?: string | undefined;
    }, {
        type: "structured" | "daily";
        status: "active" | "inactive" | "reassigned";
        incomePattern: "salaried" | "freelancer" | "mix";
        id: string;
        createdAt: string;
        userId: string;
        reassignedAt?: string | undefined;
    }>;
    Pocket: z.ZodObject<{
        id: z.ZodString;
        planId: z.ZodString;
        name: z.ZodString;
        kind: z.ZodEnum<["savings", "fixed", "spendable"]>;
        category: z.ZodOptional<z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>>;
        isTimeLocked: z.ZodDefault<z.ZodBoolean>;
        lockUntil: z.ZodOptional<z.ZodString>;
        monthlyAllocation: z.ZodNumber;
        dailyCap: z.ZodOptional<z.ZodNumber>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        planId: string;
        id: string;
        name: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        createdAt: string;
        updatedAt: string;
        isTimeLocked: boolean;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
        dailyCap?: number | undefined;
        lockUntil?: string | undefined;
    }, {
        planId: string;
        id: string;
        name: string;
        kind: "savings" | "fixed" | "spendable";
        monthlyAllocation: number;
        createdAt: string;
        updatedAt: string;
        category?: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other" | undefined;
        dailyCap?: number | undefined;
        isTimeLocked?: boolean | undefined;
        lockUntil?: string | undefined;
    }>;
    FixedExpense: z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        name: z.ZodString;
        amount: z.ZodNumber;
        dueDay: z.ZodNumber;
        category: z.ZodEnum<["food", "transport", "leisure", "personal", "utilities", "healthcare", "education", "other"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other";
        createdAt: string;
        updatedAt: string;
        userId: string;
        amount: number;
        dueDay: number;
    }, {
        id: string;
        name: string;
        category: "food" | "transport" | "leisure" | "personal" | "utilities" | "healthcare" | "education" | "other";
        createdAt: string;
        updatedAt: string;
        userId: string;
        amount: number;
        dueDay: number;
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
        date: string;
        id: string;
        createdAt: string;
        userId: string;
        amount: number;
        source: string;
        label: string;
        runAllocation: boolean;
    }, {
        date: string;
        id: string;
        createdAt: string;
        userId: string;
        amount: number;
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
        id: string;
        createdAt: string;
        amount: number;
        pocketId: string;
        category?: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified" | undefined;
        merchant?: string | undefined;
    }, {
        type: "allocation" | "spend" | "reallocation_in" | "reallocation_out" | "rollover";
        id: string;
        createdAt: string;
        amount: number;
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
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        id: string;
        createdAt: string;
        amount: number;
        fromPocketId: string;
        toPocketId: string;
        disciplineCost: number;
        coolingOffEndsAt?: string | undefined;
        completedAt?: string | undefined;
    }, {
        status: "pending" | "cooling_off" | "completed" | "skipped";
        reason: "other" | "emergency" | "unexpected_expense" | "income_change" | "priority_shift";
        id: string;
        createdAt: string;
        amount: number;
        fromPocketId: string;
        toPocketId: string;
        coolingOffEndsAt?: string | undefined;
        disciplineCost?: number | undefined;
        completedAt?: string | undefined;
    }>;
    MerchantClassification: z.ZodObject<{
        id: z.ZodString;
        recipientKey: z.ZodString;
        category: z.ZodEnum<["grocery", "landlord_rent", "utility", "transport", "healthcare", "education", "entertainment", "gambling_betting", "personal_care", "other", "unclassified"]>;
        remember: z.ZodDefault<z.ZodBoolean>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
        createdAt: string;
        recipientKey: string;
        remember: boolean;
    }, {
        id: string;
        category: "transport" | "healthcare" | "education" | "other" | "grocery" | "landlord_rent" | "utility" | "entertainment" | "gambling_betting" | "personal_care" | "unclassified";
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