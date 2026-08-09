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
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeAuth } from '@/services/auth';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

// Themed status bar — theme-aware icon colour.
// On Android (edge-to-edge by default in this Expo SDK) the status bar is
// always transparent and `backgroundColor`/`translucent` are no longer
// supported props on expo-status-bar. The status bar area instead takes its
// colour from whatever renders beneath it: the root View's `paper` background
// plus each screen's `ScreenContainer` safe-area top inset. So here we only
// pick the icon style ('dark' vs 'light') to contrast against that background.
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.paper }}>
        <ThemedStatusBar />
        <ActivityIndicator color={themeColors.emerald} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.paper }}>
      <ThemedStatusBar />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="landing" />
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