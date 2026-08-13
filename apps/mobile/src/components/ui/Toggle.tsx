import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { ToggleRight, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius } from '@/theme';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Toggle({ value, onValueChange, disabled = false, accessibilityLabel, accessibilityHint }: ToggleProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        padding: 2,
        backgroundColor: value ? colors.emeraldDeep : colors.lineSoft,
      }}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          {
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.ink,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2,
          },
          value && {
            transform: [{ translateX: 20 }],
          },
        ]}
      >
        {value && <ToggleRight size={14} color={colors.emeraldDeep} strokeWidth={2} />}
      </View>
    </Pressable>
  );
}

interface ToggleRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}

export function ToggleRow({ icon: Icon, title, description, value, onToggle, disabled = false }: ToggleRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.sm,
      }}
      onPress={() => onToggle(!value)}
      disabled={disabled}
      accessibilityLabel={`${title} ${value ? 'enabled' : 'disabled'}`}
      accessibilityHint={description}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View style={{ 
        width: 36, 
        height: 36, 
        borderRadius: radius.xs, 
        backgroundColor: colors.lineSoft, 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Icon size={18} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={{ marginLeft: spacing.md, flex: 1 }}>
        <Text style={{ fontFamily: 'System', fontWeight: '600', fontSize: 15, color: colors.ink }}>
          {title}
        </Text>
        <Text style={{ fontFamily: 'System', fontSize: 12, color: colors.sage, marginTop: 2 }}>
          {description}
        </Text>
      </View>
      <Toggle
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        accessibilityLabel={`${title} toggle`}
      />
    </Pressable>
  );
}
