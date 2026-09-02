/**
 * Color mapping for category icons using brand colors.
 * Colors automatically adapt to light/dark mode through the theme system.
 */

import type { ColorPalette } from '@/theme/palettes';

export interface CategoryColorMapping {
  lightMode: string;
  darkMode: string;
}

/**
 * Maps each category to brand colors from the design system.
 * 
 * Color strategy:
 * - Emerald (primary brand): food, education, housing, emergency (custom piggy bank SVG)
 * - Clay (essential/discretionary): transport, utilities, debt
 * - Plum (cooling-off/relaxation): leisure, healthcare, investment, subscriptions (other)
 * - Gold (accent/warning): family, personal, goal
 * - Sage (neutral): (currently unused)
 */
export const CATEGORY_COLORS: Record<string, CategoryColorMapping> = {
  // Main Pocket Categories
  food: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  transport: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
  leisure: {
    lightMode: '#7A5F9D', // plum
    darkMode: '#D4B8F0', // plumBright
  },
  personal: {
    lightMode: '#A6762D', // gold
    darkMode: '#F5C97E', // goldBright
  },
  utilities: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
  healthcare: {
    lightMode: '#7A5F9D', // plum
    darkMode: '#D4B8F0', // plumBright
  },
  education: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  housing: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  family: {
    lightMode: '#A6762D', // gold
    darkMode: '#F5C97E', // goldBright
  },
  other: {
    lightMode: '#7A5F9D', // plum (subscriptions and miscellaneous)
    darkMode: '#D4B8F0', // plumBright
  },

  // Merchant Categories (aligned with similar themes)
  grocery: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  landlord_rent: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  utility: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
  entertainment: {
    lightMode: '#7A5F9D', // plum
    darkMode: '#D4B8F0', // plumBright
  },
  personal_care: {
    lightMode: '#A6762D', // gold
    darkMode: '#F5C97E', // goldBright
  },
  gambling_betting: {
    lightMode: '#B05320', // clay (blocked category)
    darkMode: '#F4A576', // clayBright
  },

  // MSME Business Categories (ADR-001 §5.2)
  stock: {
    lightMode: '#1A4F3E', // emerald (goods & inventory)
    darkMode: '#5FC4A8', // emeraldBright
  },
  supplier: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
  licence: {
    lightMode: '#7A5F9D', // plum
    darkMode: '#D4B8F0', // plumBright
  },
  tax: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
  salary: {
    lightMode: '#1A4F3E', // emerald (salaries & wages)
    darkMode: '#5FC4A8', // emeraldBright
  },
  rent: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  operations: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
  profit: {
    lightMode: '#A6762D', // gold
    darkMode: '#F5C97E', // goldBright
  },
  owner_draw: {
    lightMode: '#A6762D', // gold
    darkMode: '#F5C97E', // goldBright
  },
  growth: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  marketing: {
    lightMode: '#7A5F9D', // plum
    darkMode: '#D4B8F0', // plumBright
  },
  equipment: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },

  // Savings Categories
  emergency: {
    lightMode: '#1A4F3E', // emerald
    darkMode: '#5FC4A8', // emeraldBright
  },
  goal: {
    lightMode: '#A6762D', // gold
    darkMode: '#F5C97E', // goldBright
  },
  investment: {
    lightMode: '#7A5F9D', // plum
    darkMode: '#D4B8F0', // plumBright
  },
  debt: {
    lightMode: '#B05320', // clay
    darkMode: '#F4A576', // clayBright
  },
};

/**
 * Get the appropriate color for a category based on the current theme.
 * @param category - The category key
 * @param colors - Current theme colors (from useTheme())
 * @returns The color string for the category
 */
export function getCategoryColor(category: string, colors: ColorPalette): string {
  const mapping = CATEGORY_COLORS[category];
  if (!mapping) {
    // Fallback to sage color for unknown categories
    return colors.sage;
  }

  // In dark mode, use the bright variant; in light mode, use the standard variant
  // We detect dark mode by checking if paper is dark
  const isDarkMode = colors.paper === '#121815'; // dark mode paper color
  
  return isDarkMode ? mapping.darkMode : mapping.lightMode;
}

/**
 * Check if a category has a specific color mapping (vs using default sage)
 */
export function hasCustomColor(category: string): boolean {
  return category in CATEGORY_COLORS;
}
