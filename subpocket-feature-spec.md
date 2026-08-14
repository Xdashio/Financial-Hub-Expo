# Sub-Pocket Percentage Splits — Feature Spec

## 1. What changes conceptually

Today, `parent_pocket_id` sub-pockets exist in the schema and have a flat
`monthlyAllocation` (KSh amount) capped at the parent's total — but nothing
ever moves money into them. This spec replaces the flat-amount model with a
**percentage-of-parent** model, wires it into the income-allocation event,
and adds an overflow/borrow mechanic.

## 2. Data model

**`pockets` table** — add:
- `split_percentage numeric` (0–100), nullable. Only meaningful when
  `parent_pocket_id IS NOT NULL`. Replaces `monthly_allocation` as the
  source of truth for sub-pockets (their `monthly_allocation` becomes a
  *derived/cached* value = `parent.monthly_allocation * split_percentage /
  100`, recomputed whenever the parent's plan changes).

**Constraint (app-level, same place the current sibling-sum check lives):**
`SUM(split_percentage)` across siblings must be `<= 100`. Can be less —
the unassigned remainder stays with the parent as a **reserved buffer**
(see §5), not freely spendable.

**New concept: reserved balance.** A parent pocket with sub-pockets and
`SUM(split_percentage) < 100` has an `available_balance` that is now split
conceptually into:
- **Distributable** — the portion that already flowed to sub-pockets
  (their `available_balance`, summed).
- **Reserved** — `parent.available_balance − distributable`. Not shown/
  spendable via the normal "Log spend" flow against the parent when the
  parent has sub-pockets. Only released via the overflow-confirm flow
  (§6). This is a real behavior change from today, where every top-level
  pocket is freely spendable — flagging this explicitly since it partly
  supersedes an earlier answer in this conversation (you'd said the
  unsplit remainder could be spent directly; the later answer on overflow
  reserved it instead — going with the reserved version since it's the
  one that makes the overflow mechanic meaningful. Correct me if that's
  the wrong read).

## 3. Income allocation — auto-split with per-event override

Today: `calculateAllocationsBasedOnProportions()` splits an income event
across top-level pockets only, proportional to `monthly_allocation`.

**New step, run per top-level pocket that has sub-pockets, right after its
share is computed:**
1. Take the pocket's computed share for *this event* (not its static
   planned `monthly_allocation` — the actual amount, so a bigger/smaller
   income event scales sub-pockets proportionally too).
2. For each sub-pocket, credit `eventShare * (split_percentage / 100)` as
   its own allocation ledger row.
3. The remainder (`eventShare * (1 − ΣsplitPercentage/100)`) stays as a
   parent-pocket allocation row, flagged reserved (§2).

**Per-event override:** the "Add income" screen (your screenshot) already
has an editable preview ("If allocated now: Wi-Fi 2,500 / Savings 7,500 /
…"). Extend that preview: any parent row with sub-pockets becomes
expandable, showing its computed sub-splits with editable amounts for
*this event only* (doesn't touch the stored `split_percentage`). A
"reset to plan %" affordance restores the default. This satisfies "auto
by default, override per event" without a separate screen.

## 4. Editing a sub-pocket's percentage — immediate rebalance

Per your answer, editing a split percentage **immediately moves money**,
not just future events. Concretely: editing Snacks 20% → 30% triggers a
same-transaction ledger adjustment — a transfer from the parent's reserved
balance (or from siblings, proportionally scaled down, mirroring the
existing `calculateAllocationsBasedOnProportions` shortfall-funding logic)
into Snacks, sized so Snacks' *current* balance reflects the new
percentage of the parent's *total already-allocated-this-cycle* amount.

Edge case to flag: if the new percentage requires more than what's
currently available (parent's reserved + siblings' spare), the edit can't
fully immediately rebalance — needs either (a) partial rebalance now +
rest catches up next income event, or (b) block the edit with an
"insufficient funds to rebalance now" message. **Question for you below.**

## 5. Overflow — confirm-first borrow from parent

When a spend against a sub-pocket (e.g. Snacks) would take it negative:
1. Compute the shortfall.
2. Check the parent's reserved balance (§2) for enough to cover it.
   - If yes: block the spend, surface a confirm dialog — "Snacks is short
     KSh X — pull from Food & Groceries?" — Confirm triggers an
     immediate internal transfer (reserved → Snacks) then the original
     spend proceeds; Cancel just cancels the spend attempt.
   - If the parent's reserved balance is insufficient too: hard stop,
     same "can't spend, pocket empty" state as any other pocket today —
     no cross-sibling borrowing (you didn't select that option, keeping
     scope to parent-only per your answer).
3. This is functionally a fast-path, pre-confirmed reallocation between
   parent and child — same ledger mechanics as a normal reallocation, but
   skipping the existing cooling-off period, since it's money moving
   within the same visual "family" the user already carved up themselves,
   not leaving the plan.

## 6. Decisions (finalized)

1. **Rebalance edge case:** if a percentage edit needs more than currently
   exists in parent+siblings, block silently-negative results — show the
   shortfall ("this needs KSh X more than is currently available"), then
   offer a partial-now-plus-catch-up-next-income-event option the user
   explicitly accepts before it's applied.
2. **UI entry point:** sub-pocket creation still sets an initial
   percentage, but the primary way to adjust splits is a dedicated
   multi-sibling **rebalance bottom sheet** — all siblings shown together
   with sliders, live KSh preview per sibling, and the 100% ceiling
   enforced visually (sliders can't collectively exceed it).
3. **Migration:** clean cutover, no backfill needed — no sub-pockets exist
   in production yet (team-testing only).


## 7. Rough implementation phases

**Phase 1 — data + core allocation logic**
- Migration: add `split_percentage`, backfill/derive for any existing rows
- Rewrite `createSubPocket`/`getSubPocketsForUser` for percentage model
- Extend `calculateAllocationsBasedOnProportions` (income.service.ts) with
  the per-parent sub-split step (§3)
- New endpoint: `PATCH /pockets/:id/split-percentage` for the immediate-
  rebalance edit flow (§4)

**Phase 2 — overflow/borrow**
- Extend the spend endpoint (log-spend) with the shortfall-check +
  confirm-required response shape (§5)
- New endpoint or extend existing reallocation endpoint for the
  fast-path parent→child transfer that skips cooling-off

**Phase 3 — mobile UI**
- Sub-pocket creation: percentage input instead of amount, live preview
  of resulting KSh figure and remaining parent %
- **Rebalance bottom sheet** (new): opened from the parent pocket's detail
  screen when it has 2+ sub-pockets. Shows all siblings as sliders on a
  shared 0–100% scale, live KSh preview per sibling as they drag, ceiling
  enforced (can't collectively exceed 100% — dragging one down frees room
  for others, dragging past the remaining room is blocked/clamped).
  Confirms the rebalance-shortfall flow (§6.1) inline if a slider move
  needs more money than currently exists.
- Pocket detail screen: show sub-pockets with their live balances, the
  parent's reserved-vs-distributable split, entry point to the rebalance
  sheet
- Add-income preview: expandable per-parent sub-split editor (§3)
- Log-spend: confirm dialog for the overflow-borrow prompt (§5)

Not estimating day-counts yet — ready to start Phase 1 (migration +
core allocation logic) whenever you give the go-ahead.
