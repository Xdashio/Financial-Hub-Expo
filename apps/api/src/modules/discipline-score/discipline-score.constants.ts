/**
 * Canonical starting discipline score for a user with no score history.
 * Every reader/writer (DisciplineScoreService, InsightsService, tests)
 * must import this constant — never hardcode `100` as a second baseline.
 */
export const DEFAULT_SCORE = 100;
