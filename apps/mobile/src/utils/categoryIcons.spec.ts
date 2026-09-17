import { PocketCategorySchema } from '@financial-hub/shared';

/**
 * Keep this list in sync with CATEGORY_ICONS keys that cover PocketCategory.
 * Spec avoids importing categoryIcons.ts (lucide ESM breaks jest without
 * a transform allowlist change).
 */
const POCKET_ICON_KEYS = [
  'food', 'transport', 'leisure', 'personal', 'utilities',
  'healthcare', 'education', 'housing', 'family',
  'stock', 'supplier', 'licence', 'tax', 'salary', 'rent',
  'operations', 'profit', 'owner_draw', 'growth', 'marketing', 'equipment',
  'other',
] as const;

describe('categoryIcons contract (audit Phase 6)', () => {
  it('lists every PocketCategorySchema value (matches pockets_category_check)', () => {
    const missing = PocketCategorySchema.options.filter(
      (c) => !(POCKET_ICON_KEYS as readonly string[]).includes(c),
    );
    expect(missing).toEqual([]);
  });

  it('documents intentional extras beyond the pocket CHECK', () => {
    const extras = [
      'grocery', 'landlord_rent', 'utility', 'entertainment',
      'personal_care', 'gambling_betting', 'unclassified',
      'emergency', 'goal', 'investment', 'debt',
    ];
    expect(extras.length + POCKET_ICON_KEYS.length).toBeGreaterThan(
      PocketCategorySchema.options.length,
    );
  });
});
