/**
 * Centralized category icon management using Lucide icons with brand colors.
 * Provides a single source of truth for all category icon mappings across the app.
 */

import {
  ShoppingCart,
  Bus,
  Film,
  Scissors,
  Zap,
  HeartPulse,
  GraduationCap,
  Home,
  Users,
  MoreHorizontal,
  Package,

  Calendar,
  TrendingUp,
  Award,
  CreditCard,
  PiggyBank,
} from 'lucide-react-native';
import { getCategoryColor } from './categoryColors';
import type { LucideIcon } from 'lucide-react-native';

export type CategoryKey = 
  | 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' 
  | 'healthcare' | 'education' | 'housing' | 'family' | 'other'
  | 'grocery' | 'landlord_rent' | 'utility' | 'entertainment' 
  | 'personal_care' | 'gambling_betting'
  | 'emergency' | 'goal' | 'investment' | 'debt';

/**
 * Icon mapping for all category types (Pocket, Spendable, Merchant, and Savings categories)
 */
const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  // Main Pocket Categories
  food: ShoppingCart,
  transport: Bus,
  leisure: Film,
  personal: Scissors,
  utilities: Zap,
  healthcare: HeartPulse,
  education: GraduationCap,
  housing: Home,
  family: Users,
  other: CreditCard, // Credit card icon for subscriptions

  // Merchant Categories (aligned with similar themes)
  grocery: ShoppingCart,
  landlord_rent: Home,
  utility: Zap,
  entertainment: Film,
  personal_care: Scissors,
  gambling_betting: Package, // Blocked category

  // Savings Categories
  emergency: PiggyBank, // Mapped to PiggyBank, but CategoryIcon uses custom SavingsIcon SVG
  goal: Calendar,
  investment: TrendingUp,
  debt: Award,
};

/**
 * Get the icon component for a category
 */
export function getCategoryIcon(category: CategoryKey): LucideIcon {
  return CATEGORY_ICONS[category] || MoreHorizontal;
}

/**
 * Get the brand color for a category based on the current theme
 * @param category - The category key
 * @param colors - Current theme colors (from useTheme())
 * @returns The color string for the category
 */
export function getCategoryIconColor(category: CategoryKey, colors: any): string {
  return getCategoryColor(category, colors);
}

/**
 * Get both icon and color for a category in a single call
 * @param category - The category key
 * @param colors - Current theme colors (from useTheme())
 * @returns Object with icon component and color string
 */
export function getCategoryIconWithColor(category: CategoryKey, colors: any) {
  return {
    icon: getCategoryIcon(category),
    color: getCategoryIconColor(category, colors),
  };
}

/**
 * Check if a category has a custom icon mapping
 */
export function hasCategoryIcon(category: string): category is CategoryKey {
  return category in CATEGORY_ICONS;
}
