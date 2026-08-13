import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  headerIcon?: LucideIcon;
}

/**
 * Reusable bottom sheet modal component with consistent styling.
 * Used across the app for forms, pickers, and other modal content.
 */
export function BottomSheetModal({ visible, onClose, title, children, headerIcon: HeaderIcon }: BottomSheetModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: `${colors.ink}80` }}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: spacing.xxl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {HeaderIcon && (
                  <View style={{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
                    <HeaderIcon size={16} color={colors.emeraldDeep} strokeWidth={2} />
                  </View>
                )}
                <Text style={{ ...typography.title, color: colors.ink }}>{title}</Text>
              </View>
              <Pressable onPress={onClose} style={{ padding: spacing.sm }} accessibilityLabel="Close" accessibilityRole="button">
                <X size={24} color={colors.ink} />
              </Pressable>
            </View>
            <ScrollView style={{ padding: spacing.lg }}>
              {children}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
