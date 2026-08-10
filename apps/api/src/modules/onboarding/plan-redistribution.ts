import type { PocketKind, RedistributionReason } from '@financial-hub/shared';

export interface RedistributionSource {
  id: string;
  name: string;
  kind: PocketKind;
  category: string | null;
  available: number;
}

export interface RedistributionTarget {
  id: string;
  name: string;
  kind: PocketKind;
  category: string | null;
  monthlyAllocation: number;
}

export interface RedistributionMovementPlan {
  fromPocketId: string;
  fromPocketName: string;
  toPocketId: string;
  toPocketName: string;
  amount: number;
  reason: RedistributionReason;
}

/**
 * Pure planner for retake money migration.
 *
 * Order of preference (per source balance):
 * 1. Same kind + category (category_match)
 * 2. Same kind only (kind_match)
 * 3. Spillover to Savings, else largest spendable, else first target (spillover)
 *
 * Within a match set, amounts split by monthly_allocation share.
 * Rounds to 2dp; the last slice in each split absorbs residual cents so
 * sum(movements) === sum(source.available).
 */
export function planBalanceRedistribution(
  sources: RedistributionSource[],
  targets: RedistributionTarget[],
): RedistributionMovementPlan[] {
  if (targets.length === 0) return [];

  const remaining = new Map(
    sources
      .filter((s) => s.available > 0)
      .map((s) => [s.id, round2(s.available)] as const),
  );
  const byId = new Map(sources.map((s) => [s.id, s]));
  const movements: RedistributionMovementPlan[] = [];
  const claimedTargets = new Set<string>();

  const drain = (
    sourceId: string,
    matchTargets: RedistributionTarget[],
    reason: RedistributionReason,
    options: { claimTargets?: boolean } = {},
  ) => {
    const amount = remaining.get(sourceId) ?? 0;
    if (amount <= 0 || matchTargets.length === 0) return;
    const source = byId.get(sourceId)!;
    const slices = splitByAllocation(amount, matchTargets);
    for (const slice of slices) {
      if (slice.amount <= 0) continue;
      if (options.claimTargets) claimedTargets.add(slice.target.id);
      movements.push({
        fromPocketId: source.id,
        fromPocketName: source.name,
        toPocketId: slice.target.id,
        toPocketName: slice.target.name,
        amount: slice.amount,
        reason,
      });
    }
    remaining.set(sourceId, 0);
  };

  // Phase 0 — exact name match within the same kind (preserves Rent→Rent etc.)
  for (const sourceId of [...remaining.keys()]) {
    const source = byId.get(sourceId)!;
    const matches = targets.filter(
      (t) =>
        !claimedTargets.has(t.id) &&
        t.kind === source.kind &&
        normalizeName(t.name) === normalizeName(source.name),
    );
    if (matches.length > 0) drain(sourceId, matches.slice(0, 1), 'category_match', { claimTargets: true });
  }

  // Phase 1 — category match (skip targets already claimed by a name match)
  for (const sourceId of [...remaining.keys()]) {
    if ((remaining.get(sourceId) ?? 0) <= 0) continue;
    const source = byId.get(sourceId)!;
    const matches = targets.filter(
      (t) =>
        !claimedTargets.has(t.id) &&
        t.kind === source.kind &&
        categoriesEqual(t.category, source.category),
    );
    if (matches.length > 0) drain(sourceId, matches, 'category_match');
  }

  // Phase 2 — kind match
  for (const sourceId of [...remaining.keys()]) {
    if ((remaining.get(sourceId) ?? 0) <= 0) continue;
    const source = byId.get(sourceId)!;
    const matches = targets.filter((t) => t.kind === source.kind);
    if (matches.length > 0) drain(sourceId, matches, 'kind_match');
  }

  // Phase 3 — spillover
  const spillTarget = pickSpillTarget(targets);
  for (const sourceId of [...remaining.keys()]) {
    const amount = remaining.get(sourceId) ?? 0;
    if (amount <= 0) continue;
    const source = byId.get(sourceId)!;
    movements.push({
      fromPocketId: source.id,
      fromPocketName: source.name,
      toPocketId: spillTarget.id,
      toPocketName: spillTarget.name,
      amount,
      reason: 'spillover',
    });
    remaining.set(sourceId, 0);
  }

  return movements;
}

/** First day of the next UTC calendar month as YYYY-MM-DD. */
export function nextRetakeAvailableOn(from: Date = new Date()): string {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth(); // 0-indexed
  const next = new Date(Date.UTC(year, month + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** True when both timestamps fall in the same UTC YYYY-MM. */
export function sameUtcMonth(aIso: string, b: Date = new Date()): boolean {
  return aIso.slice(0, 7) === b.toISOString().slice(0, 7);
}

function categoriesEqual(a: string | null, b: string | null): boolean {
  return (a ?? null) === (b ?? null);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickSpillTarget(targets: RedistributionTarget[]): RedistributionTarget {
  const savings = targets.find((t) => t.kind === 'savings');
  if (savings) return savings;
  const spendable = targets
    .filter((t) => t.kind === 'spendable')
    .sort((a, b) => b.monthlyAllocation - a.monthlyAllocation);
  if (spendable[0]) return spendable[0];
  return targets[0];
}

function splitByAllocation(
  amount: number,
  targets: RedistributionTarget[],
): Array<{ target: RedistributionTarget; amount: number }> {
  if (targets.length === 1) {
    return [{ target: targets[0], amount: round2(amount) }];
  }

  const weights = targets.map((t) => Math.max(t.monthlyAllocation, 0));
  const weightSum = weights.reduce((s, w) => s + w, 0);

  // Equal split when every allocation is zero (shouldn't happen, but safe).
  if (weightSum <= 0) {
    const even = round2(amount / targets.length);
    const slices = targets.map((target, i) => ({
      target,
      amount: i === targets.length - 1 ? 0 : even,
    }));
    const assigned = slices.slice(0, -1).reduce((s, x) => s + x.amount, 0);
    slices[slices.length - 1].amount = round2(amount - assigned);
    return slices;
  }

  const slices = targets.map((target, i) => ({
    target,
    amount: i === targets.length - 1 ? 0 : round2((amount * weights[i]) / weightSum),
  }));
  const assigned = slices.slice(0, -1).reduce((s, x) => s + x.amount, 0);
  slices[slices.length - 1].amount = round2(amount - assigned);
  return slices;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
