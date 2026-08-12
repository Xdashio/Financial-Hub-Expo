import type { Pocket } from '../database/database.types';
import {
  getAllowedCategoriesForPocket,
  getBlockedCategoriesForPocket,
  isEssentialPocket,
  isReviewableBlock,
} from './pocket-rules';

function pocket(partial: Partial<Pocket> & Pick<Pocket, 'kind'>): Pocket {
  return {
    id: 'p1',
    plan_id: 'plan-1',
    name: 'Pocket',
    category: null,
    is_time_locked: false,
    lock_until: null,
    monthly_allocation: 1000,
    daily_cap: null,
    parent_pocket_id: null,
    created_at: 'x',
    updated_at: 'x',
    ...partial,
  };
}

describe('pocket-rules (Batch 3 itemized fixed)', () => {
  it('treats all fixed pockets as essential', () => {
    expect(isEssentialPocket(pocket({ kind: 'fixed', category: 'housing' }))).toBe(true);
  });

  it('scopes a housing fixed pocket to landlord_rent only', () => {
    expect(getAllowedCategoriesForPocket(pocket({ kind: 'fixed', name: 'Rent', category: 'housing' }))).toEqual([
      'landlord_rent',
    ]);
  });

  it('scopes a utilities fixed pocket to utility only', () => {
    expect(getAllowedCategoriesForPocket(pocket({ kind: 'fixed', name: 'Internet', category: 'utilities' }))).toEqual([
      'utility',
    ]);
  });

  it('keeps the legacy lump Fixed Expenses allow-list when category is null', () => {
    const allowed = getAllowedCategoriesForPocket(pocket({ kind: 'fixed', name: 'Fixed Expenses', category: null }));
    expect(allowed).toEqual(['grocery', 'landlord_rent', 'utility', 'transport', 'healthcare', 'education']);
  });

  it('allows family spendable pockets education/healthcare/grocery/other', () => {
    expect(getAllowedCategoriesForPocket(pocket({ kind: 'spendable', category: 'family' }))).toEqual([
      'education',
      'healthcare',
      'grocery',
      'other',
    ]);
  });
});

describe('pocket-rules (2026-08-12 reconciliation: gambling_betting always-blocked)', () => {
  it('never allows gambling_betting from a leisure spendable pocket', () => {
    const allowed = getAllowedCategoriesForPocket(pocket({ kind: 'spendable', category: 'leisure' }));
    expect(allowed).not.toContain('gambling_betting');
    expect(getBlockedCategoriesForPocket(pocket({ kind: 'spendable', category: 'leisure' }))).toContain(
      'gambling_betting',
    );
  });

  it('never allows gambling_betting from any pocket kind/category', () => {
    const combos: Array<Partial<Pocket> & Pick<Pocket, 'kind'>> = [
      { kind: 'fixed', category: 'housing' },
      { kind: 'fixed', category: null },
      { kind: 'savings', category: null },
      { kind: 'spendable', category: 'food' },
      { kind: 'spendable', category: 'personal' },
      { kind: 'spendable', category: null },
    ];
    for (const combo of combos) {
      expect(getAllowedCategoriesForPocket(pocket(combo))).not.toContain('gambling_betting');
    }
  });

  it('scopes Savings to the essential-only allow-list, not the broad discretionary one', () => {
    expect(getAllowedCategoriesForPocket(pocket({ kind: 'savings', category: null }))).toEqual([
      'grocery',
      'landlord_rent',
      'utility',
      'transport',
      'healthcare',
      'education',
    ]);
  });

  it('isEssentialPocket still returns false for Savings (kind mismatch is intentional, not a bug)', () => {
    expect(isEssentialPocket(pocket({ kind: 'savings', category: null }))).toBe(false);
  });

  it('isReviewableBlock is false only for gambling_betting', () => {
    expect(isReviewableBlock('gambling_betting')).toBe(false);
    expect(isReviewableBlock('entertainment')).toBe(true);
    expect(isReviewableBlock('grocery')).toBe(true);
  });
});