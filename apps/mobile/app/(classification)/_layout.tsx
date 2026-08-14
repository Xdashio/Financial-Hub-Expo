import { Stack } from 'expo-router';

export default function ClassificationLayout() {
  return (
    <Stack>
      <Stack.Screen name="classify" options={{ headerShown: false }} />
      <Stack.Screen 
        name="history" 
        options={{ 
          title: 'Classification History',
          headerShown: true 
        }} 
      />
    </Stack>
  );
}