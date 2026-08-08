import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeAuth } from '@/services/auth';
import { colors } from '@/theme';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Restore any persisted Supabase session before we route to (auth) vs
    // (tabs); without this, a previously signed-in user would still get
    // bounced to sign-in on every cold start.
    initializeAuth().finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <StatusBar style="dark" />
          <ActivityIndicator color={colors.emerald} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="dark" />

        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}