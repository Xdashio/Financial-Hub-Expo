import { Stack } from 'expo-router';

export default function LoansLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Loans' }} />
      <Stack.Screen name="create" options={{ title: 'Create Loan' }} />
      <Stack.Screen name="detail" options={{ title: 'Loan Details' }} />
    </Stack>
  );
}
