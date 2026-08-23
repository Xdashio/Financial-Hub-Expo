import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { Check, X, AlertCircle, Info, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Toast notification component with undo/action support.
 * Used for feedback on destructive actions and other user interactions.
 */
export function Toast({ visible, message, type = 'info', duration = 3000, onDismiss, actionLabel, onAction }: ToastProps) {
  const { colors } = useTheme();
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(50));

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
      ]).start();

      const timer = setTimeout(handleDismiss, duration);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
            useNativeDriver: true,
          }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
            useNativeDriver: true,
          }),
      ]).start();
    }
  }, [visible, duration, fadeAnim, slideAnim, handleDismiss]);

  const icons: Record<string, LucideIcon> = {
    success: Check,
    error: AlertCircle,
    info: Info,
  };

  const Icon = icons[type];
  const bgColors = {
    success: colors.emeraldDeep,
    error: colors.clay,
    info: colors.emeraldDeep,
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: spacing.xxl,
        left: spacing.lg,
        right: spacing.lg,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: bgColors[type],
          shadowColor: colors.ink,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <View style={{ marginRight: spacing.sm }}>
          <Icon size={18} color={colors.surface} strokeWidth={2} />
        </View>
        <Text style={{ ...typography.caption, color: colors.surface, flex: 1, lineHeight: 18 }}>
          {message}
        </Text>
        {actionLabel && onAction && (
          <Pressable
            onPress={() => {
              onAction();
              handleDismiss();
            }}
            style={{ marginLeft: spacing.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
          >
            <Text style={{ ...typography.caption, color: colors.surface, textDecorationLine: 'underline' }}>
              {actionLabel}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleDismiss}
          style={{ marginLeft: spacing.sm, padding: spacing.xs }}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
        >
          <X size={16} color={colors.surface} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
