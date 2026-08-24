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
import { AppState, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { PocketLoader, OfflineIndicator } from '@/components/ui';
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
        <PocketLoader size={40} color={themeColors.emerald} />
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
          authenticated. */}
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry 4xx responses — a 404 (e.g. a freelancer-only endpoint
      // hit by a salaried account) or 401/403 will never succeed on retry,
      // and retrying it anyway is what turned a single "not applicable"
      // response into a growing storm of repeated requests on every
      // screen focus. Only retry on network errors / 5xx, up to twice.
      retry: (failureCount, error: any) => {
        const status = error?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <RootLayoutInner />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default wrapRoot(RootLayout);