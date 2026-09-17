import { Stack } from 'expo-router';

export default function PocketsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="detail" />
      <Stack.Screen name="log-spend" />
      <Stack.Screen name="planning-cycle" />
    </Stack>
  );
}