import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import React from 'react';
import { useAuthStore } from '@/services/auth';
import { useOnboardingStore } from '@/services/onboarding-store';
import { useTheme } from '@/theme/ThemeContext';
import LandingScreen from './landing';

export default function Index() {
  const { colors } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasPlan = useAuthStore((state) => state.hasPlan);
  const isCheckingPlan = useAuthStore((state) => state.isCheckingPlan);
  const recoverOnboarding = useOnboardingStore((state: any) => state.recoverState);

  // Recovery for interrupted first-time onboarding only. Existing users with
  // an active plan are gated above / in (onboarding)/_layout and must not be
  // pulled back into the income → habits flow by leftover local draft state.
  React.useEffect(() => {
    if (isAuthenticated && !isCheckingPlan && !hasPlan) {
      recoverOnboarding();
    }
  }, [isAuthenticated, isCheckingPlan, hasPlan, recoverOnboarding]);

  // Still checking auth state → show loading
  if (isCheckingPlan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  // Not logged in → show landing page
  if (!isAuthenticated) {
    return <LandingScreen />;
  }

  // Logged in, plan check done → route based on result
  if (!hasPlan) {
    return <Redirect href="/(onboarding)/income" />;
  }

  return <Redirect href="/(tabs)" />;
}