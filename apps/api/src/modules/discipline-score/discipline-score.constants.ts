/**
 * Canonical starting discipline score for a user with no score history.
 * Changed from 100 to null to indicate "No data yet" for new users,
 * encouraging them to build their spending discipline profile.
 * Every reader/writer (DisciplineScoreService, InsightsService, tests)
 * must import this constant — never hardcode `100` as a second baseline.
 */
export const DEFAULT_SCORE = null;
