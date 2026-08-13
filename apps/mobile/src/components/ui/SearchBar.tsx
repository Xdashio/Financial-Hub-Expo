import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

/**
 * Reusable search bar component with consistent styling.
 * Used across list screens for filtering content.
 */
export function SearchBar({ value, onChangeText, placeholder = "Search...", onClear }: SearchBarProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.md,
      }}
    >
      <Search size={18} color={colors.sage} strokeWidth={2} style={{ marginRight: spacing.sm }} />
      <TextInput
        style={{
          flex: 1,
          ...typography.body,
          color: colors.ink,
          paddingVertical: 0,
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.sage}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel="Search"
        accessibilityRole="search"
      />
      {value.length > 0 && onClear && (
        <Pressable
          onPress={onClear}
          style={{ padding: spacing.xs }}
          accessibilityLabel="Clear search"
          accessibilityRole="button"
        >
          <X size={16} color={colors.sage} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}
