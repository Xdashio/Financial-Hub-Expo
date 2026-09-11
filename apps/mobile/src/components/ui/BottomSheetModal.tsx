import React from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Generic Lucide icon for the header badge. Prefer `headerGlyph` for
   *  anything that represents a pocket/money concept — a Lucide icon here
   *  reads as one more app's stock iconography, not this one's. */
  headerIcon?: LucideIcon;
  /** Custom glyph (e.g. a PocketGlyph) rendered in the same 32px tinted
   *  badge slot as `headerIcon`. Takes precedence when both are given. */
  headerGlyph?: React.ReactNode;
  /** Maximum height constraint for the sheet container. Default is '88%'. */
  maxHeight?: number | string;
}

/**
 * Reusable bottom sheet modal component with consistent styling and keyboard avoidance.
 * Used across the app for forms, pickers, and other modal content.
 */
export function BottomSheetModal({
  visible,
  onClose,
  title,
  children,
  headerIcon: HeaderIcon,
  headerGlyph,
  maxHeight = '88%',
}: BottomSheetModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        {/* Full-screen backdrop touch area to dismiss */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: `${colors.ink}80` }]}
          onPress={onClose}
          accessibilityLabel="Dismiss sheet"
          accessibilityRole="button"
        />

        {/* Sheet container */}
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              maxHeight: maxHeight as any,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: colors.line },
            ]}
          >
            <View style={styles.headerTitleGroup}>
              {(headerGlyph || HeaderIcon) && (
                <View
                  style={[
                    styles.glyphBadge,
                    { backgroundColor: colors.emeraldTint },
                  ]}
                >
                  {headerGlyph ?? (HeaderIcon && <HeaderIcon size={16} color={colors.emeraldDeep} strokeWidth={2} />)}
                </View>
              )}
              <Text style={{ ...typography.title, color: colors.ink }} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={{ padding: spacing.sm }}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <X size={22} color={colors.ink} />
            </Pressable>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    marginRight: spacing.sm,
  },
  glyphBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContainer: {
    padding: spacing.lg,
  },
});