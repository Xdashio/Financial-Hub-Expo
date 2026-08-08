// Must be imported first, before any Supabase/network code runs.
// Hermes (RN's JS engine) doesn't fully implement the URL API or
// crypto.getRandomValues, which @supabase/supabase-js relies on internally
// (building request URLs, PKCE verifier generation, etc). Without these
// polyfills, supabase-js calls silently throw on native (iOS/Android) while
// working fine on web, where the browser provides these APIs natively —
// which is exactly why OTP send fails only on mobile.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeAuth } from '@/services/auth';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Themed status bar + root background — separated out so it can call
// useTheme() (which needs to be inside <ThemeProvider>).
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return (
    // Android is edge-to-edge by default in this Expo SDK, so the status
    // bar is always transparent — there's no backgroundColor prop to set.
    // What shows behind it is whatever's rendered underneath (our themed
    // container View), so all we control here is icon/text color.
    <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
  );
}

function RootLayoutInner() {
  const [isReady, setIsReady] = useState(false);
  const { colors: themeColors } = useTheme();

  useEffect(() => {
    // Restore any persisted Supabase session before we route to (auth) vs
    // (tabs); without this, a previously signed-in user would still get
    // bounced to sign-in on every cold start.
    initializeAuth().finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: themeColors.paper }]}>
        <ThemedStatusBar />
        <ActivityIndicator color={themeColors.emerald} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.paper }]}>
      <ThemedStatusBar />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}