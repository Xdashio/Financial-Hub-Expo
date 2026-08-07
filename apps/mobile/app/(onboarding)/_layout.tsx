import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="income" />
      <Stack.Screen name="habits" />
      <Stack.Screen name="fixed" />
      <Stack.Screen name="result" />
    </Stack>
  );
}