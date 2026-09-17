/**
 * Centralized category icon management using Lucide icons with brand colors.
 * Multi-domain map covering:
 * - PocketCategory (DB pockets_category_check — 22 values)
 * - MerchantCategory (merchant classification CHECK — includes unclassified)
 * - Savings-goal UI labels (emergency/goal/investment/debt — not in pockets CHECK)
 *
 * Every PocketCategorySchema value MUST have an entry here (guarded by
 * categoryIcons.spec.ts). Extra keys beyond the pocket CHECK are intentional.
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
  Truck,
  FileText,
  Landmark,
  Wallet,
  Wrench,
  Coins,
  Sprout,
  Megaphone,
  Cog,

  Calendar,
  TrendingUp,
  Award,
  CreditCard,
  PiggyBank,
  CircleHelp,
} from 'lucide-react-native';
import { getCategoryColor } from './categoryColors';
import type { LucideIcon } from 'lucide-react-native';

export type CategoryKey = 
  | 'food' | 'transport' | 'leisure' | 'personal' | 'utilities' 
  | 'healthcare' | 'education' | 'housing' | 'family' | 'other'
  | 'grocery' | 'landlord_rent' | 'utility' | 'entertainment' 
  | 'personal_care' | 'gambling_betting' | 'unclassified'
  | 'emergency' | 'goal' | 'investment' | 'debt'
  // MSME business categories (ADR-001 §5.2)
  | 'stock' | 'supplier' | 'licence' | 'tax' | 'salary' | 'rent'
  | 'operations' | 'profit' | 'owner_draw' | 'growth' | 'marketing' | 'equipment';

/**
 * Icon mapping for all category types (Pocket, Spendable, Merchant, and Savings categories)
 */
const CATEGORY_ICONS: Record<CategoryKey, LucideIcon> = {
  // Main Pocket Categories (pockets_category_check)
  food: ShoppingCart,
  transport: Bus,
  leisure: Film,
  personal: Scissors,
  utilities: Zap,
  healthcare: HeartPulse,
  education: GraduationCap,
  housing: Home,
  family: Users,
  other: CreditCard,

  // Merchant Categories (merchant_classifications / reports CHECK)
  grocery: ShoppingCart,
  landlord_rent: Home,
  utility: Zap,
  entertainment: Film,
  personal_care: Scissors,
  gambling_betting: Package,
  unclassified: CircleHelp,

  // MSME Business Categories (ADR-001 §5.2)
  stock: Package,
  supplier: Truck,
  licence: FileText,
  tax: Landmark,
  salary: Wallet,
  rent: Home,
  operations: Wrench,
  profit: TrendingUp,
  owner_draw: Coins,
  growth: Sprout,
  marketing: Megaphone,
  equipment: Cog,

  // Savings goal UI labels (not pocket.category CHECK values)
  emergency: PiggyBank,
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

/** Exported for contract-audit tests — every pocket CHECK value must appear here. */
export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS) as CategoryKey[];
