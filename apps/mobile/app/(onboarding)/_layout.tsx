import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/services/auth';

export default function OnboardingLayout() {
  const hasPlan = useAuthStore((state) => state.hasPlan);
  const isCheckingPlan = useAuthStore((state) => state.isCheckingPlan);

  // Existing users with an active plan should never stay in onboarding —
  // e.g. after a stale hasPlan=false flash or deep link into these routes.
  if (!isCheckingPlan && hasPlan) {
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
    </Stack>
  );
}