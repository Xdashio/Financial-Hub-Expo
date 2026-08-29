import { Stack } from 'expo-router';

export default function MsmeProjectsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="detail" />
      <Stack.Screen name="income-entry" />
      <Stack.Screen name="log-spend" />
    </Stack>
  );
}
