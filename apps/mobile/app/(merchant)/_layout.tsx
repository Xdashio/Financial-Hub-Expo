import { Stack } from 'expo-router';

export default function MerchantLayout() {
  return (
    <Stack>
      <Stack.Screen name="report" options={{ headerShown: false }} />
      <Stack.Screen 
        name="history" 
        options={{ 
          title: 'Report History',
          headerShown: true 
        }} 
      />
    </Stack>
  );
}