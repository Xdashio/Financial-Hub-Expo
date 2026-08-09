import React from 'react';
import { View, Text, Modal, Pressable, SafeAreaView, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow } from '@/theme';
import { Button } from './Button';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the destructive (clay/red) color. */
  destructive?: boolean;
  /** Shows a spinner on the confirm button and disables both buttons. */
  loading?: boolean;
  onConfirm: () => void;
  /**
   * Omit for single-button "alert" mode (no Cancel button rendered).
   * Back-button / Escape / backdrop-tap fall back to onConfirm in that case,
   * since there's nothing to "cancel" — just dismiss.
   */
  onCancel?: () => void;
}

/**
 * Themed, cross-platform confirmation dialog.
 *
 * This exists because the native `Alert.alert()` API is a documented no-op
 * on react-native-web (react-native-web/dist/exports/Alert) — any screen
 * that called `Alert.alert(...)` directly for a confirm-before-destructive-
 * action flow (e.g. sign out) silently did nothing on web: no dialog, no
 * console output, and critically no `onPress` callback ever fired, so the
 * underlying action never ran either. Building this as a real RN `Modal`
 * sidesteps that entirely since `Modal` (unlike `Alert`) is fully
 * implemented on web, and it lets the dialog match the app's own visual
 * language instead of falling back to the browser's unstyled
 * `window.confirm()`.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Android back-button / web Escape — treat like tapping Cancel, but
      // never while a confirm action is actually in flight (that would let
      // the user dismiss the dialog mid-sign-out and re-tap it, firing a
      // second concurrent sign-out).
      onRequestClose={() => {
        if (!loading) (onCancel ?? onConfirm)();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: `${colors.ink}80` }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Pressable
            // Backdrop tap-to-dismiss — absolutely positioned behind the
            // card so it doesn't intercept taps on the card itself.
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!loading) (onCancel ?? onConfirm)();
            }}
          />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.xl,
              ...shadow.elevated,
            }}
          >
            <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>{title}</Text>
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

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              {onCancel && (
                <Button variant="secondary" style={{ flex: 1 }} onPress={onCancel} disabled={loading}>
                  {cancelLabel}
                </Button>
              )}
              <Button
                variant="primary"
                style={{ flex: 1, ...(destructive ? { backgroundColor: colors.clay, borderColor: colors.clay } : {}) }}
                onPress={onConfirm}
                loading={loading}
                disabled={loading}
              >
                {confirmLabel}
              </Button>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}