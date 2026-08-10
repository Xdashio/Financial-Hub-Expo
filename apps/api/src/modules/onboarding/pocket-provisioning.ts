import { v4 as uuidv4 } from 'uuid';
import type {
  OnboardingInput,
  PocketCategory,
  PocketKind,
} from '@financial-hub/shared';
import type { PlanAssignment } from './rules-engine';

type SpendableCategory = 'food' | 'transport' | 'leisure' | 'family';

const DEFAULT_SAVINGS_LOCK_DAYS = 30;

const CATEGORY_NAMES: Record<SpendableCategory, string> = {
  food: 'Food & Groceries',
  transport: 'Transport',
  leisure: 'Personal & Leisure',
  family: 'Family & obligations',
};

/** Relative weights when splitting spendable money across category pockets. */
const CATEGORY_WEIGHTS: Record<SpendableCategory, number> = {
  food: 3,
  transport: 2,
  leisure: 2,
  family: 2,
};

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
 * - Savings: locked for DEFAULT_SAVINGS_LOCK_DAYS.
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
  pockets.push(buildSavingsPocket(planId, assignment.savingsTarget));
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

export function buildSavingsPocket(planId: string, savingsTarget: number): PocketInsertInput {
  const lockUntil = new Date();
  lockUntil.setDate(lockUntil.getDate() + DEFAULT_SAVINGS_LOCK_DAYS);
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
  const categories = resolveSpendableCategories(input);

  if (assignment.planType === 'structured') {
    // Student persona: one flat spendable pocket even on structured plans.
    if (categories.length === 1 && categories[0] === 'leisure') {
      return [
        {
          id: uuidv4(),
          plan_id: planId,
          name: 'Daily spend',
          kind: 'spendable',
          category: 'leisure',
          is_time_locked: false,
          lock_until: null,
          monthly_allocation: round2(assignment.spendableAmount),
          daily_cap: null,
        },
      ];
    }

    const allocations = splitByWeights(assignment.spendableAmount, categories);
    return categories.map((category) => ({
      id: uuidv4(),
      plan_id: planId,
      name: CATEGORY_NAMES[category],
      kind: 'spendable' as PocketKind,
      category: category as PocketCategory,
      is_time_locked: false,
      lock_until: null,
      monthly_allocation: allocations[category],
      daily_cap: null,
    }));
  }

  // Daily plans: one flat pocket for students; otherwise per-category daily caps.
  const daysInMonth =
    assignment.incomePattern === 'freelancer' && assignment.incomeIntervalDays
      ? assignment.incomeIntervalDays
      : 30;
  const dailySpendable = assignment.spendableAmount / daysInMonth;

  if (categories.length === 1 && categories[0] === 'leisure') {
    // Student persona: single "Daily spend" pocket (category leisure is the
    // discretionary bucket; name is clearer than Personal & Leisure).
    const dailyCap = round2(dailySpendable);
    return [
      {
        id: uuidv4(),
        plan_id: planId,
        name: 'Daily spend',
        kind: 'spendable',
        category: 'leisure',
        is_time_locked: false,
        lock_until: null,
        monthly_allocation: round2(dailyCap * daysInMonth),
        daily_cap: dailyCap,
      },
    ];
  }

  const dailyByCategory = splitByWeights(dailySpendable, categories);
  return categories.map((category) => {
    const dailyCap = round2(dailyByCategory[category]);
    return {
      id: uuidv4(),
      plan_id: planId,
      name: CATEGORY_NAMES[category],
      kind: 'spendable' as PocketKind,
      category: category as PocketCategory,
      is_time_locked: false,
      lock_until: null,
      monthly_allocation: round2(dailyCap * daysInMonth),
      daily_cap: dailyCap,
    };
  });
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

function splitByWeights(
  total: number,
  categories: SpendableCategory[],
): Record<SpendableCategory, number> {
  const result = {} as Record<SpendableCategory, number>;
  if (categories.length === 0) return result;

  const weights = categories.map((c) => CATEGORY_WEIGHTS[c]);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  let assigned = 0;

  categories.forEach((category, i) => {
    if (i === categories.length - 1) {
      result[category] = round2(total - assigned);
    } else {
      const share = round2((total * weights[i]) / weightSum);
      result[category] = share;
      assigned += share;
    }
  });

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
