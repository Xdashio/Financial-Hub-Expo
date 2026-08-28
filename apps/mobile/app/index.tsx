import { Redirect } from 'expo-router';
import { View } from 'react-native';
import React from 'react';
import { useAuthStore } from '@/services/auth';
import { useOnboardingStore } from '@/services/onboarding-store';
import { useTheme } from '@/theme/ThemeContext';
import { PocketLoader } from '@/components/ui';
import LandingScreen from './landing';
import { profileApi } from '@/services/api';

export default function Index() {
  const { colors } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasPlan = useAuthStore((state) => state.hasPlan);
  const isCheckingPlan = useAuthStore((state) => state.isCheckingPlan);
  const recoverOnboarding = useOnboardingStore((state: any) => state.recoverState);
  const [segmentRoute, setSegmentRoute] = React.useState<'individual' | 'msme' | null>(null);
  const [isResolvingSegment, setIsResolvingSegment] = React.useState(false);

  // Recovery for interrupted first-time onboarding only. Existing users with
  // an active plan are gated above / in (onboarding)/_layout and must not be
  // pulled back into the income → habits flow by leftover local draft state.
  React.useEffect(() => {
    if (isAuthenticated && !isCheckingPlan && !hasPlan) {
      recoverOnboarding();
    }
  }, [isAuthenticated, isCheckingPlan, hasPlan, recoverOnboarding]);

  // Phase 2: segment-aware cold-start routing (Known limit #3)
  // If the user has only an MSME plan (no Individual), land on /(msme)
  // instead of always /(tabs). If both exist, default to Individual (home
  // switcher lets them flip to Business).
  React.useEffect(() => {
    if (!isAuthenticated || isCheckingPlan || !hasPlan || segmentRoute !== null) return;
    let cancelled = false;
    setIsResolvingSegment(true);
    profileApi
      .getPlans()
      .then((plans: any[]) => {
        if (cancelled) return;
        const hasIndividual = Array.isArray(plans) && plans.some((p) => p.segment === 'individual');
        const hasMsme = Array.isArray(plans) && plans.some((p) => p.segment === 'msme');
        if (hasMsme && !hasIndividual) {
          setSegmentRoute('msme');
        } else if (hasIndividual) {
          setSegmentRoute('individual');
        } else if (Array.isArray(plans) && plans.length === 0) {
          // Backend says no active plan despite hasPlan cache — treat as no plan (edge race)
          setSegmentRoute(null);
        } else {
          // Array without segment field (pre-016) or single-plan fallback — default to individual
          setSegmentRoute('individual');
        }
      })
      .catch(() => {
        if (!cancelled) setSegmentRoute('individual');
      })
      .finally(() => {
        if (!cancelled) setIsResolvingSegment(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCheckingPlan, hasPlan, segmentRoute]);

  // Still checking auth state → show loading
  if (isCheckingPlan || (isAuthenticated && hasPlan && segmentRoute === null && isResolvingSegment)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <PocketLoader size={40} color={colors.emerald} />
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

  if (segmentRoute === 'msme') {
    return <Redirect href="/(msme)" />;
  }
  return <Redirect href="/(tabs)" />;
}