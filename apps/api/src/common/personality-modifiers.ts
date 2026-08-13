// Money personality as a modifier layer, not a plan-type driver
// (audit_team.md item 2 batch 2 / ONBOARDING_AND_SCORING_REDESIGN.md §2.3).
//
// §2.3 is explicit that `moneyPersonality` should NOT influence which plan
// (Structured vs. Daily) someone is assigned — that stays driven by income
// stability + fixed-cost ratio + persona (rules-engine.ts). Instead it sets
// three things layered on top of an already-assigned plan:
//   1. Cooling-off duration + framing (this file: coolingOffModifierFor)
//   2. Notification tone/cadence (this file: notificationCadenceFor)
//   3. Which insights get surfaced first (this file: sortInsightsByPersonality)
//
// A `MoneyPersonality` of undefined (plan predates this modifier layer, or
// the migration default applies) is treated as 'saver' throughout, matching
// rules-engine.ts's own onboarding-time fallback.

import type { MoneyPersonality } from '@financial-hub/shared';

function resolve(personality: MoneyPersonality | null | undefined): MoneyPersonality {
  return personality ?? 'saver';
}

// ----------------------------------------------------------------------------
// 1. Cooling-off duration + framing
// ----------------------------------------------------------------------------

export interface CoolingOffModifier {
  hours: number;
  /** Screen title for the cooling-off/reallocation-review flow. */
  title: string;
  /** Supporting copy — never punitive, per the PRD's existing tone rule. */
  message: string;
}

/**
 * §2.3: "An Avoider gets gentler, reassuring copy and possibly a longer
 * default cooling-off; a Spender gets a firmer default (still never
 * punitive)." Saver keeps the existing flat 1h/neutral-copy behavior this
 * app shipped with before the modifier layer existed.
 */
export function coolingOffModifierFor(
  personality: MoneyPersonality | null | undefined,
  defaultHours: number,
): CoolingOffModifier {
  switch (resolve(personality)) {
    case 'avoider':
      return {
        hours: defaultHours + 1,
        title: 'Let\u2019s take a little extra time',
        message:
          'No rush here — this pause just gives the move a bit more room to feel right before it happens. You can still come back and confirm whenever you\u2019re ready.',
      };
    case 'spender':
      return {
        hours: defaultHours,
        title: 'Quick pause before this moves',
        message:
          'This is a short hold on essential-to-leisure moves so today\u2019s decision is still the one you want by the time it lands.',
      };
    case 'saver':
    default:
      return {
        hours: defaultHours,
        title: 'Cooling-off period',
        message: 'Essential-to-leisure moves get a short pause before they complete.',
      };
  }
}

// ----------------------------------------------------------------------------
// 2. Notification tone/cadence
// ----------------------------------------------------------------------------

/**
 * §2.3: "A Saver doesn't need much nudging; an Avoider benefits from very
 * low-friction, frequent, small check-ins rather than infrequent heavy
 * ones." Multiplies the base interval a scheduler would otherwise use
 * (shorter effective interval = more frequent) and returns a tone the
 * client/copy layer can use for wording.
 */
export interface NotificationCadenceModifier {
  /** Multiplier on the scheduler's base interval; <1 = more frequent. */
  intervalMultiplier: number;
  tone: 'gentle_frequent' | 'neutral' | 'direct_light';
}

export function notificationCadenceFor(
  personality: MoneyPersonality | null | undefined,
): NotificationCadenceModifier {
  switch (resolve(personality)) {
    case 'avoider':
      return { intervalMultiplier: 0.5, tone: 'gentle_frequent' };
    case 'spender':
      return { intervalMultiplier: 1, tone: 'direct_light' };
    case 'saver':
    default:
      return { intervalMultiplier: 2, tone: 'neutral' };
  }
}

// ----------------------------------------------------------------------------
// 3. Insight ordering
// ----------------------------------------------------------------------------

// Insight "kind" tags matching the three metric cards Insights actually
// renders today (apps/mobile/app/(tabs)/insights.tsx's `metrics` array) —
// kept as a plain string union here (not importing from the mobile app) to
// avoid a cross-app dependency; InsightsService below is responsible for
// returning them in this same vocabulary.
export type InsightKind = 'reallocation_frequency' | 'discipline_score' | 'cooling_off_skips' | string;

/**
 * §2.3: "A Spender benefits from seeing 'days since last reallocation out
 * of savings' prominently; a Saver might benefit more from seeing goal
 * progress." No dedicated goal-progress card exists yet (§4's goal-driven
 * savings work tracks the target itself, not a standalone insight card) —
 * `discipline_score` is the closest existing stand-in for "how am I doing
 * overall", so Saver leads with that instead. Avoider gets the same
 * "how am I doing" framing as Saver (§2.3 doesn't give avoider-specific
 * insight-ordering guidance, only cooling-off and notification cadence),
 * but keeps `cooling_off_skips` last since it's the most exposing metric to
 * lead with for someone prone to avoidance.
 */
export function insightPriorityOrderFor(personality: MoneyPersonality | null | undefined): InsightKind[] {
  switch (resolve(personality)) {
    case 'spender':
      return ['reallocation_frequency', 'discipline_score', 'cooling_off_skips'];
    case 'avoider':
      return ['discipline_score', 'reallocation_frequency', 'cooling_off_skips'];
    case 'saver':
    default:
      return ['discipline_score', 'cooling_off_skips', 'reallocation_frequency'];
  }
}

/** Stable-sorts `insights` in place-equivalent fashion by the personality's priority order. */
export function sortInsightsByPersonality<T extends { kind: InsightKind }>(
  insights: T[],
  personality: MoneyPersonality | null | undefined,
): T[] {
  const order = insightPriorityOrderFor(personality);
  const rank = (kind: InsightKind) => {
    const idx = order.indexOf(kind);
    return idx === -1 ? order.length : idx;
  };
  return [...insights]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item.kind) - rank(b.item.kind) || a.index - b.index)
    .map(({ item }) => item);
}