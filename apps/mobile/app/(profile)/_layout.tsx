import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="personal-info" />
      <Stack.Screen name="current-plan" />
      <Stack.Screen name="fixed-expenses" />
      <Stack.Screen name="retake-checkin" />
    </Stack>
  );
}
