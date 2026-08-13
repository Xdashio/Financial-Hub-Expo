import { Stack } from 'expo-router';

export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
      }}
    >
      <Stack.Screen name="realloc-pick" />
      <Stack.Screen name="realloc-review" />
      <Stack.Screen name="realloc-cooloff" />
      <Stack.Screen name="realloc-success" />
      <Stack.Screen name="subpocket-create" />
      <Stack.Screen 
        name="fixed-expense-form" 
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 0.75, 1],
        }}
      />
    </Stack>
  );
}