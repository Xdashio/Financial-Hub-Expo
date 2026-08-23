/**
 * CategoryIcon Component
 * 
 * Renders category icons with brand colors that adapt to light/dark mode.
 * Provides a consistent, colorful icon experience across the app.
 */

import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { getCategoryIconWithColor, hasCategoryIcon } from '@/utils/categoryIcons';
import { SavingsIcon } from './SavingsIcon';

interface CategoryIconProps {
  category: string;
  size?: number;
  strokeWidth?: number;
  color?: string; // Optional override for the icon color
  containerStyle?: any;
}

/**
 * CategoryIcon renders a Lucide icon with the appropriate brand color for the category.
 * 
 * @param category - The category key (e.g., 'food', 'transport', 'leisure')
 * @param size - Icon size in pixels (default: 24)
 * @param strokeWidth - Icon stroke width (default: 2)
 * @param color - Optional color override (if not provided, uses brand color)
 * @param containerStyle - Optional style for the container View
 */
export function CategoryIcon({
  category,
  size = 24,
  strokeWidth = 2,
  color: colorOverride,
  containerStyle,
}: CategoryIconProps) {
  const colors = useTheme();
  
  // Get icon and color for the category
  const { icon: IconComponent, color: brandColor } = getCategoryIconWithColor(
    hasCategoryIcon(category) ? category : 'other',
    colors
  );
  
  // Use override color if provided, otherwise use brand color
  const iconColor = colorOverride || brandColor;
  
  // Use custom SavingsIcon for emergency category
  if (category === 'emergency') {
    return (
      <View style={containerStyle}>
        <SavingsIcon size={size} color={iconColor} />
      </View>
    );
  }
  
  return (
    <View style={containerStyle}>
      <IconComponent
        size={size}
        color={iconColor}
        strokeWidth={strokeWidth}
      />
    </View>
  );
}

/**
 * Hook to get icon component and color for a category
 * Useful when you need the icon and color separately
 */
export function useCategoryIcon(category: string) {
  const colors = useTheme();
  return getCategoryIconWithColor(
    hasCategoryIcon(category) ? category : 'other',
    colors
  );
}
