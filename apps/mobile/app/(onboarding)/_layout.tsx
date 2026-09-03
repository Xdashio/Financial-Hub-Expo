import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/services/auth';
import { profileApi } from '@/services/api';
import { View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { PocketLoader } from '@/components/ui';

export default function OnboardingLayout() {
  const hasPlan = useAuthStore((state) => state.hasPlan);
  const isCheckingPlan = useAuthStore((state) => state.isCheckingPlan);
  const { colors } = useTheme();
  const [isResolvingSegments, setIsResolvingSegments] = React.useState(false);
  const [hasBothSegments, setHasBothSegments] = React.useState(false);

  // Segment-aware guard: hasPlan is true if *any* segment exists (individual OR msme).
  // We must still allow onboarding when the user is missing the OTHER segment
  // (e.g. msme-only user creating a personal plan from Personal tab's empty
  // state). Only block if the user already has BOTH segments. The stale
  // hasPlan=false flash case is still covered via isCheckingPlan.
  React.useEffect(() => {
    if (isCheckingPlan || !hasPlan) {
      setHasBothSegments(false);
      return;
    }
    let cancelled = false;
    setIsResolvingSegments(true);
    profileApi
      .getPlans()
      .then((plans: any[]) => {
        if (cancelled) return;
        const hasIndividual = Array.isArray(plans) && plans.some((p) => p.segment === 'individual');
        const hasMsme = Array.isArray(plans) && plans.some((p) => p.segment === 'msme');
        // Pre-016 backends return plans without segment field — treat any
        // existing plan as "individual" for redirect purposes, but don't block
        // msme creation entirely; hasMsme will be false so msme onboarding remains allowed.
        const both = hasIndividual && hasMsme;
        // If backend returns a single plan with no segment field, treat as individual-only
        // (hasBoth stays false, so second plan creation is allowed).
        setHasBothSegments(both);
      })
      .catch(() => {
        if (!cancelled) setHasBothSegments(false);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingSegments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasPlan, isCheckingPlan]);

  // While we resolve segment ownership, don't flash onboarding or redirect
  if (!isCheckingPlan && hasPlan && isResolvingSegments) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <PocketLoader size={40} color={colors.emerald} />
      </View>
    );
  }

  // Only redirect when the user has BOTH plans — msme-only or individual-only
  // users must be allowed to enter onboarding to create the missing segment.
  if (!isCheckingPlan && !isResolvingSegments && hasPlan && hasBothSegments) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="income" />
      <Stack.Screen name="habits" />
      <Stack.Screen name="about-you" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="fixed" />
      <Stack.Screen name="result" />
      <Stack.Screen name="msme-fixed" />
      <Stack.Screen name="msme-result" />
    </Stack>
  );
}