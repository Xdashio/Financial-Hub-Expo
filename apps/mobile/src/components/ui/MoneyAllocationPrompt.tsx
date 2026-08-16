import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, borderWidth } from '@/theme';
import { Button } from './Button';
import { ArrowRight, Plus, Wallet, Building2 } from 'lucide-react-native';
import { formatMoney } from '@/utils/money';

export interface AllocationOption {
  id: 'main_pocket' | 'pocket' | 'new_pocket';
  label: string;
  description: string;
  icon: React.ElementType;
}

export interface MoneyAllocationPromptProps {
  visible: boolean;
  title: string;
  message: string;
  amount: number;
  options?: AllocationOption[];
  onSelectOption: (optionId: string) => void;
  onCancel?: () => void;
  loading?: boolean;
}

const DEFAULT_OPTIONS: AllocationOption[] = [
  {
    id: 'main_pocket',
    label: 'Allocate to main pocket',
    description: 'Follow your normal plan allocation',
    icon: Wallet,
  },
  {
    id: 'pocket',
    label: 'Choose a pocket',
    description: 'Pick a specific pocket to add this to',
    icon: Building2,
  },
  {
    id: 'new_pocket',
    label: 'Create new pocket',
    description: 'Set up a new pocket for this money',
    icon: Plus,
  },
];

/**
 * Reusable money allocation prompt component.
 * 
 * This is used across multiple scenarios:
 * - Income surplus detection (item 1): prompt when income > expected
 * - Overspend prompting (item 4): prompt when user tries to overspend
 * - Behavioral layer adjustments (item 5): prompt for plan drift
 * - Loans (item 6): prompt for loan repayment allocation
 * 
 * Shows a 3-option prompt: main pocket / pick pocket / create new pocket.
 * The UI pattern reuses the pocket picker from realloc-pick.tsx.
 */
export function MoneyAllocationPrompt({
  visible,
  title,
  message,
  amount,
  options = DEFAULT_OPTIONS,
  onSelectOption,
  onCancel,
  loading = false,
}: MoneyAllocationPromptProps) {
  const { colors } = useTheme();

  const formatAmount = (value: number) => {
    return formatMoney(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!loading) (onCancel ?? (() => {}))();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: `${colors.ink}80` }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!loading) (onCancel ?? (() => {}))();
            }}
          />
          <View
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.xl,
              ...shadow.elevated,
            }}
          >
            <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>{title}</Text>
            
            <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
              <Text style={{ ...typography.display, color: colors.emeraldDeep, fontSize: 32 }}>
                {formatAmount(amount)}
              </Text>
            </View>

            {message ? (
              <Text
                style={{
                  ...typography.body,
                  color: colors.sage,
                  textAlign: 'center',
                  marginTop: spacing.sm,
                  lineHeight: 21,
                }}
              >
                {message}
              </Text>
            ) : null}

            <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
              {options.map((option) => {
                const Icon = option.icon;
                return (
                  <Pressable
                    key={option.id}
                    disabled={loading}
                    onPress={() => onSelectOption(option.id)}
                    style={({ pressed }) => [{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      borderWidth: borderWidth,
                      borderColor: colors.line,
                      borderRadius: radius.md,
                      opacity: loading ? 0.5 : pressed ? 0.7 : 1,
                    }]}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: radius.md,
                        backgroundColor: colors.emeraldTint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} color={colors.emeraldDeep} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.heading, color: colors.ink }}>{option.label}</Text>
                      <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                        {option.description}
                      </Text>
                    </View>
                    <ArrowRight size={16} color={colors.sage} />
                  </Pressable>
                );
              })}
            </View>

            {onCancel && (
              <View style={{ marginTop: spacing.lg }}>
                <Button
                  variant="secondary"
                  fullWidth
                  onPress={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}