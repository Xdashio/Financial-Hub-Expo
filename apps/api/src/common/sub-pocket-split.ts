/**
 * Shared helper: resolves how a parent pocket's allocation amount trickles
 * down into its sub-pockets according to each sub-pocket's `split_percentage`.
 *
 * This logic was previously private to `IncomeService.applySubPocketSplits`,
 * meaning any new allocation path (surplus, rollover, manual top-ups) had to
 * either duplicate it or skip sub-pocket splitting entirely — causing sub-pockets
 * to receive no money when allocation came from those paths.
 *
 * The fix: extract the core resolution into this pure helper so every allocation
 * path can call it consistently.
 *
 * ## Split rules
 * - A sub-pocket receives `parentAmount * splitPercentage / 100` of the
 *   parent's allocated share.
 * - If `split_percentage` is null or 0 for a sub-pocket, it receives nothing
 *   (the pocket is effectively disabled from auto-allocation).
 * - The remainder — `parentAmount * (1 - ΣsplitPercentage / 100)` — stays
 *   credited to the parent as its own reserved balance. This is intentional:
 *   the parent acts as a backstop buffer that the overflow-borrow flow can
 *   draw from (see pockets.service.ts rebalanceSubPockets).
 * - Zero-amount rows are omitted from the output so callers never pass empty
 *   allocation entries to the DB layer.
 */

export interface SubPocketRow {
  id: string;
  name: string;
  split_percentage: number | null;
}

export interface ResolvedAllocation {
  pocket_id: string;
  pocket_name: string;
  /** Amount in KSh (rounded to 2 decimal places). */
  amount: number;
  /** Pass-through: the parent's percentage in the overall income split. */
  parentPercentage: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Given a parent pocket's allocated `amount` and its `subPockets`, returns
 * the list of allocation rows to write to the ledger (sub-pocket rows +
 * optional parent reserved row).
 *
 * Returns an empty array when `subPockets` is empty — callers should push
 * the parent's allocation unchanged in that case (see `expandParentAllocation`).
 */
export function resolveSubPocketSplit(
  parentPocketId: string,
  parentPocketName: string,
  amount: number,
  parentPercentage: number,
  subPockets: SubPocketRow[],
): ResolvedAllocation[] {
  if (subPockets.length === 0) return [];

  const result: ResolvedAllocation[] = [];
  let distributed = 0;

  for (const sub of subPockets) {
    const pct = sub.split_percentage ?? 0;
    if (pct <= 0) continue; // sub-pocket opted out of auto-allocation

    const subAmount = round2((amount * pct) / 100);
    if (subAmount <= 0) continue;

    distributed = round2(distributed + subAmount);
    result.push({
      pocket_id: sub.id,
      pocket_name: sub.name,
      amount: subAmount,
      parentPercentage,
    });
  }

  // Reserved remainder stays with the parent — real money credited to its
  // own ledger row. Only omitted when splits happen to total exactly 100%.
  const reserved = Math.max(0, round2(amount - distributed));
  if (reserved > 0) {
    result.push({
      pocket_id: parentPocketId,
      pocket_name: parentPocketName,
      amount: reserved,
      parentPercentage,
    });
  }

  return result;
}