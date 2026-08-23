import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { WifiOff, X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography } from '@/theme';

/**
 * Offline status indicator that shows when the app is offline.
 * Displays a banner at the top of the screen when network is unavailable.
 * Note: Requires @react-native-community/netinfo to be installed for actual network detection.
 * Currently shows as a placeholder component that can be manually controlled.
 */
export function OfflineIndicator({ isOffline: isOfflineProp, onDismiss }: { isOffline?: boolean; onDismiss?: () => void }) {
  const { colors } = useTheme();
  const [isOffline, setIsOffline] = useState(isOfflineProp || false);
  const [lastPropValue, setLastPropValue] = useState(isOfflineProp);
  const [dismissed, setDismissed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  if (isOfflineProp !== undefined && isOfflineProp !== lastPropValue) {
    setLastPropValue(isOfflineProp);
    setIsOffline(isOfflineProp);
  }

  useEffect(() => {
    if (isOffline && !dismissed) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
            useNativeDriver: true,
          }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
            useNativeDriver: true,
          }).start();
    }
  }, [isOffline, dismissed, fadeAnim]);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
            useNativeDriver: true,
          }).start();
  };

  if (!isOffline || dismissed) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.clayTint,
          borderBottomWidth: 1,
          borderBottomColor: colors.clay,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <WifiOff size={16} color={colors.clay} strokeWidth={2} />
          <Text style={{ ...typography.caption, color: colors.clay }}>
            You&apos;re offline. Some features may be limited.
          </Text>
        </View>
        <Pressable onPress={handleDismiss} style={{ padding: spacing.xs }} accessibilityLabel="Dismiss offline warning">
          <X size={16} color={colors.clay} strokeWidth={2} />
        </Pressable>
      </View>
    </Animated.View>
  );
}
