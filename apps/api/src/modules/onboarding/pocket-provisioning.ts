import { v4 as uuidv4 } from 'uuid';
import type {
  CategoryPercentages,
  OnboardingInput,
  PocketCategory,
  PocketKind,
  SpendableCategory,
} from '@financial-hub/shared';
import type { PlanAssignment } from './rules-engine';
import { DEFAULT_SAVINGS_LOCK_DAYS } from './rules-engine';

export type { SpendableCategory };

export const CATEGORY_NAMES: Record<SpendableCategory, string> = {
  food: 'Food & Groceries',
  transport: 'Transport',
  leisure: 'Personal & Leisure',
  family: 'Family & obligations',
};

/** Default relative weights when splitting spendable money across category
 *  pockets. This is the baseline `resolveCategoryWeights` starts from — kept
 *  exported/named for tests and for `defaultCategoryPercentages` callers
 *  that don't have persona context to shape from. */
export const CATEGORY_WEIGHTS: Record<SpendableCategory, number> = {
  food: 3,
  transport: 2,
  leisure: 2,
  family: 2,
};

/**
 * Persona-shaped category weights (ONBOARDING_AND_SCORING_REDESIGN.md §2.5,
 * audit_team.md item 8 Batch 5) — starts from CATEGORY_WEIGHTS and adjusts:
 *
 * - Remote-worker transport handling: an explicit `hasTransportNeed: false`
 *   ("no stated transport need") folds transport into a smaller share of
 *   the split rather than an even weight — halved and floored at 1 so the
 *   category still exists (a remote worker still occasionally takes
 *   transport) but stops competing evenly with food/leisure/family.
 * - Dependents-aware category folding: family's weight scales with how
 *   confident the dependents signal is. An explicit `hasDependents: true`
 *   answer is a strong, deliberate signal — family is folded in as a
 *   first-class need on par with food (matches its weight) rather than the
 *   smaller leftover share it gets when only inferred from a family/
 *   education fixed expense line (`hasDependentsSignal` true but
 *   `hasDependents` not explicitly answered) — that weaker, inferred case
 *   keeps the original default weight.
 *
 * Only categories actually present in `categories` are included in the
 * result (mirrors `resolveSpendableCategories`'s output), so callers can
 * pass the result straight into a weighted split without filtering.
 */
export function resolveCategoryWeights(
  input: OnboardingInput,
  categories: SpendableCategory[],
): Record<SpendableCategory, number> {
  const weights = {} as Record<SpendableCategory, number>;

  for (const category of categories) {
    let weight = CATEGORY_WEIGHTS[category];

    if (category === 'transport' && input.hasTransportNeed === false) {
      weight = Math.max(1, Math.round(weight / 2));
    }

    if (category === 'family' && input.hasDependents === true) {
      weight = CATEGORY_WEIGHTS.food;
    }

    weights[category] = weight;
  }

  return weights;
}

export interface PocketInsertInput {
  id: string;
  plan_id: string;
  name: string;
  kind: PocketKind;
  category: PocketCategory | null;
  is_time_locked: boolean;
  lock_until: string | null;
  monthly_allocation: number;
  daily_cap: number | null;
}

/**
 * Builds the pocket set for a newly assigned plan.
 *
 * - Fixed: one pocket per submitted fixed expense (named, categorized,
 *   locked until the next due day). Falls back to a single lump pocket when
 *   only `fixedTotal` is known.
 * - Savings: locked for `assignment.savingsLockDays` (goal-derived when a
 *   savings goal was captured — see rules-engine.ts's calculateSavingsTarget
 *   — otherwise DEFAULT_SAVINGS_LOCK_DAYS).
 * - Spendable: persona-shaped — students get one flat daily/spendable pocket;
 *   working adults get Food/Transport/Leisure, plus Family when dependents
 *   are signaled (explicit flag or family/education fixed expenses).
 */
export function buildPocketInputs(
  planId: string,
  assignment: PlanAssignment,
  input: OnboardingInput,
): PocketInsertInput[] {
  const pockets: PocketInsertInput[] = [];

  pockets.push(...buildFixedPockets(planId, input));
  pockets.push(buildSavingsPocket(planId, assignment.savingsTarget, assignment.savingsLockDays));
  pockets.push(...buildSpendablePockets(planId, assignment, input));

  return pockets;
}

export function buildFixedPockets(planId: string, input: OnboardingInput): PocketInsertInput[] {
  const expenses = input.fixedExpenses ?? [];

  if (expenses.length > 0) {
    return expenses.map((expense) => ({
      id: uuidv4(),
      plan_id: planId,
      name: expense.name,
      kind: 'fixed' as PocketKind,
      category: expense.category,
      is_time_locked: true,
      lock_until: nextDueDateIso(expense.dueDay),
      monthly_allocation: expense.amount,
      daily_cap: null,
    }));
  }

  if (input.fixedTotal > 0) {
    return [
      {
        id: uuidv4(),
        plan_id: planId,
        name: 'Fixed Expenses',
        kind: 'fixed',
        category: null,
        is_time_locked: false,
        lock_until: null,
        monthly_allocation: input.fixedTotal,
        daily_cap: null,
      },
    ];
  }

  return [];
}

export function buildSavingsPocket(
  planId: string,
  savingsTarget: number,
  lockDays: number = DEFAULT_SAVINGS_LOCK_DAYS,
): PocketInsertInput {
  const lockUntil = new Date();
  lockUntil.setDate(lockUntil.getDate() + lockDays);
  return {
    id: uuidv4(),
    plan_id: planId,
    name: 'Savings',
    kind: 'savings',
    category: null,
    is_time_locked: true,
    lock_until: lockUntil.toISOString(),
    monthly_allocation: savingsTarget,
    daily_cap: null,
  };
}

export function buildSpendablePockets(
  planId: string,
  assignment: PlanAssignment,
  input: OnboardingInput,
): PocketInsertInput[] {
  const breakdown = previewSpendableBreakdown(assignment, input);

  return breakdown.map((entry) => ({
    id: uuidv4(),
    plan_id: planId,
    name: entry.name,
    kind: 'spendable' as PocketKind,
    category: entry.category as PocketCategory,
    is_time_locked: false,
    lock_until: null,
    monthly_allocation: entry.amount,
    daily_cap: assignment.planType === 'daily' ? (entry.dailyCap ?? null) : null,
  }));
}

export interface CategoryAllocationPreview {
  category: SpendableCategory;
  name: string;
  amount: number;
  percentage: number;
  dailyCap?: number;
}

/**
 * Single source of truth for splitting the spendable amount across category
 * pockets — used both to build real pockets at commit time and to render the
 * editable percentage preview on the onboarding result screen. Given the
 * same `assignment` and `input` (including any `input.categoryPercentages`
 * override), this always returns exactly what `buildSpendablePockets` would
 * turn into pockets, so a previewed split can never drift from what
 * actually gets committed.
 */
export function previewSpendableBreakdown(
  assignment: PlanAssignment,
  input: OnboardingInput,
): CategoryAllocationPreview[] {
  const categories = resolveSpendableCategories(input);
  const overrides = input.categoryPercentages;

  if (categories.length === 1 && categories[0] === 'leisure') {
    // Student persona: one flat pocket, no split to preview — always 100%.
    const isDaily = assignment.planType !== 'structured';
    const daysInMonth = spendableDaysInMonth(assignment);
    const dailyCap = isDaily ? round2(assignment.spendableAmount / daysInMonth) : undefined;
    return [
      {
        category: 'leisure',
        name: assignment.planType === 'structured' ? 'Spendable' : 'Daily spend',
        amount: round2(assignment.spendableAmount),
        percentage: 100,
        dailyCap,
      },
    ];
  }

  const weights = resolveCategoryWeights(input, categories);

  if (assignment.planType === 'structured') {
    const allocations = splitByWeights(assignment.spendableAmount, categories, weights, overrides);
    return categories.map((category) => ({
      category,
      name: CATEGORY_NAMES[category],
      amount: allocations[category],
      percentage: percentOf(allocations[category], assignment.spendableAmount),
      dailyCap: undefined,
    }));
  }

  // Daily plans: split the daily rate, then scale back up for the
  // month-equivalent `amount` shown in the preview / stored as the
  // pocket's planning ceiling.
  const daysInMonth = spendableDaysInMonth(assignment);
  const dailySpendable = assignment.spendableAmount / daysInMonth;
  const dailyByCategory = splitByWeights(dailySpendable, categories, weights, overrides);

  return categories.map((category) => {
    const dailyCap = round2(dailyByCategory[category]);
    const amount = round2(dailyCap * daysInMonth);
    return {
      category,
      name: CATEGORY_NAMES[category],
      amount,
      dailyCap,
      percentage: percentOf(amount, assignment.spendableAmount),
    };
  });
}

/** Default weighting (no user override) as percentages, for seeding the
 *  result-screen editor before the user has touched anything. `input` is
 *  optional so existing category-only callers keep working (falls back to
 *  the flat CATEGORY_WEIGHTS); pass it to get persona-shaped weights
 *  (remote-worker transport folding, dependents-aware family weighting —
 *  see `resolveCategoryWeights`). */
export function defaultCategoryPercentages(
  categories: SpendableCategory[],
  input?: OnboardingInput,
): CategoryPercentages {
  const weightMap = input ? resolveCategoryWeights(input, categories) : CATEGORY_WEIGHTS;
  const weights = categories.map((c) => weightMap[c]);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const result: CategoryPercentages = {};
  categories.forEach((category, i) => {
    result[category] = weightSum > 0 ? round2((weights[i] / weightSum) * 100) : 0;
  });
  return result;
}

/**
 * Validates a user-supplied `categoryPercentages` override against the
 * categories this persona actually resolves to. Only meaningful once
 * `resolveSpendableCategories` is known, so this can't live in the shared
 * zod schema (which has no access to the rest of the input). No-op when the
 * field is omitted — omitting it just means "use defaults".
 */
export function validateCategoryPercentages(input: OnboardingInput): string[] {
  const overrides = input.categoryPercentages;
  if (!overrides) return [];

  const errors: string[] = [];
  const categories = resolveSpendableCategories(input);

  if (categories.length === 1 && categories[0] === 'leisure') {
    errors.push('This plan has a single spendable pocket — there is nothing to split by percentage.');
    return errors;
  }

  const expectedKeys = new Set<string>(categories);
  const suppliedKeys = Object.keys(overrides);

  const missing = categories.filter((c) => !(c in overrides));
  const unexpected = suppliedKeys.filter((k) => !expectedKeys.has(k));

  if (missing.length > 0) {
    errors.push(`Missing percentage for: ${missing.join(', ')}`);
  }
  if (unexpected.length > 0) {
    errors.push(`Unexpected categories for this plan: ${unexpected.join(', ')}`);
  }

  if (missing.length === 0 && unexpected.length === 0) {
    const sum = categories.reduce((s, c) => s + (overrides[c] ?? 0), 0);
    // Small epsilon for float rounding from client-side sliders.
    if (Math.abs(sum - 100) > 0.5) {
      errors.push(`Category percentages must sum to 100 (got ${round2(sum)})`);
    }
  }

  return errors;
}

function spendableDaysInMonth(assignment: PlanAssignment): number {
  return assignment.incomePattern === 'freelancer' && assignment.incomeIntervalDays
    ? assignment.incomeIntervalDays
    : 30;
}

function percentOf(amount: number, total: number): number {
  if (total <= 0) return 0;
  return round2((amount / total) * 100);
}

/**
 * Student → single discretionary pocket.
 * Working adult / default → food + transport + leisure, plus family when
 * dependents are indicated.
 */
export function resolveSpendableCategories(input: OnboardingInput): SpendableCategory[] {
  const lifeStage = input.lifeStage ?? inferLifeStage(input);

  if (lifeStage === 'student') {
    return ['leisure'];
  }

  const categories: SpendableCategory[] = ['food', 'transport', 'leisure'];
  if (hasDependentsSignal(input)) {
    categories.push('family');
  }
  return categories;
}

export function hasDependentsSignal(input: OnboardingInput): boolean {
  if (input.hasDependents === true) return true;
  if (input.hasDependents === false) return false;
  return (input.fixedExpenses ?? []).some(
    (e) => e.category === 'family' || e.category === 'education',
  );
}

function inferLifeStage(input: OnboardingInput): 'student' | 'working_adult' | 'self_employed' {
  if (input.lifeStage) return input.lifeStage;
  // Without an explicit answer (Batch 4), freelancers map to self_employed
  // and everyone else to working_adult — never guess "student".
  if (input.incomePattern === 'freelancer') return 'self_employed';
  return 'working_adult';
}

/**
 * Next calendar occurrence of `dueDay` (1–31), clamped to the month's last
 * day. If that day has already passed this month (or is today after midnight
 * UTC start), advances to the following month. Returned as ISO so it can be
 * stored on `pockets.lock_until`.
 */
export function nextDueDateIso(dueDay: number, from: Date = new Date()): string {
  const day = Math.min(Math.max(1, Math.floor(dueDay)), 31);
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));

  const build = (year: number, monthIndex: number) => {
    const dim = daysInUtcMonth(year, monthIndex);
    const clamped = Math.min(day, dim);
    return new Date(Date.UTC(year, monthIndex, clamped));
  };

  let candidate = build(start.getUTCFullYear(), start.getUTCMonth());
  if (candidate.getTime() <= start.getTime()) {
    const nextMonth = start.getUTCMonth() + 1;
    candidate = build(start.getUTCFullYear(), nextMonth);
  }
  return candidate.toISOString();
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Splits `total` across `categories`, either by each category's percentage
 * in `overridePercentages` (user-edited split) or, when no override is
 * given, by `weights` (persona-shaped — see `resolveCategoryWeights`). The
 * last category always absorbs the rounding remainder so the parts sum
 * exactly to `total`.
 */
function splitByWeights(
  total: number,
  categories: SpendableCategory[],
  weights: Record<SpendableCategory, number>,
  overridePercentages?: CategoryPercentages,
): Record<SpendableCategory, number> {
  const result = {} as Record<SpendableCategory, number>;
  if (categories.length === 0) return result;

  const shares: number[] = overridePercentages
    ? categories.map((c) => (overridePercentages[c] ?? 0) / 100)
    : (() => {
        const categoryWeights = categories.map((c) => weights[c]);
        const weightSum = categoryWeights.reduce((s, w) => s + w, 0);
        return categoryWeights.map((w) => w / weightSum);
      })();

  let assigned = 0;
  categories.forEach((category, i) => {
    if (i === categories.length - 1) {
      result[category] = round2(total - assigned);
    } else {
      const share = round2(total * shares[i]);
      result[category] = share;
      assigned += share;
    }
  });

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}