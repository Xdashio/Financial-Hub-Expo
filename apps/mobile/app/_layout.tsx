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
import { AppState, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeAuth, useAuthStore } from '@/services/auth';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import {
  registerForPushNotifications,
  subscribeNotificationResponses,
} from '@/services/notifications';
import { initSentry, wrapRoot } from '@/services/sentry';
import { flushWriteQueue } from '@/services/offline-queue';
import { OfflineIndicator } from '@/components/ui';
import { AppLockGate } from '@/components/auth/AppLockGate';

initSentry();

function routeFromNotificationData(data: unknown, router: ReturnType<typeof useRouter>) {
  const screen =
    data && typeof data === 'object' && 'screen' in data
      ? (data as { screen?: unknown }).screen
      : undefined;
  if (typeof screen === 'string' && screen.length > 0) {
    try {
      router.push(screen as any);
    } catch {
      // Ignore unknown routes — better than crashing on a bad payload.
    }
  }
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function RootLayoutInner() {
  const [isReady, setIsReady] = useState(false);
  const { colors: themeColors } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  // theme/index.ts sets `fontFamily: 'PlusJakartaSans_500Medium'` on every
  // typography token, but nothing was ever registering that family —
  // there's no `fonts` array on the expo-font config plugin in app.json
  // and no useFonts/Font.loadAsync call anywhere, so every screen has been
  // silently falling back to the OS system font (San Francisco / Roboto).
  // That's the actual root cause behind "font inconsistencies": screens
  // that additionally hardcode `fontFamily: 'System'` or a fontWeight
  // happen to look different from screens that don't, purely by accident,
  // because none of them were ever getting the intended typeface. Loading
  // it here makes `typography.*` mean what the theme file already claims
  // it means, everywhere at once.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_500Medium: require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
  });

  useEffect(() => {
    initializeAuth().finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    // No-ops inside Expo Go (SDK 53+ removed Android remote push there).
    void registerForPushNotifications();
    void flushWriteQueue();
  }, [isReady, isAuthenticated]);

  // Flush offline money writes when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useAuthStore.getState().isAuthenticated) {
        void flushWriteQueue();
      }
    });
    return () => sub.remove();
  }, []);

  // Live taps + cold-start (app launched from a killed state via notification).
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    void subscribeNotificationResponses((data) => {
      if (!active) return;
      routeFromNotificationData(data, router);
    }).then((unsub) => {
      if (!active) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [router]);

  if (!isReady || (!fontsLoaded && !fontError)) {
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
      <OfflineIndicator isOffline={false} />

      {/* Gates on cold start + on resume after backgrounding — see
          AppLockGate for details. Wraps the whole navigator (not a
          per-screen check) so it blocks all navigation until
          authenticated, per FLUTTER_TO_EXPO_PORT_GUIDE.md §10. */}
      <AppLockGate>
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
          <Stack.Screen name="(profile)" />
          <Stack.Screen name="(loans)" />
          <Stack.Screen name="(modals)" options={{ presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AppLockGate>
    </View>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);