// Must be imported first, before any Supabase/network code runs.
// Hermes (RN's JS engine) doesn't fully implement the URL API or
// crypto.getRandomValues, which @supabase/supabase-js relies on internally
// (building request URLs, PKCE verifier generation, etc). Without these
// polyfills, supabase-js calls silently throw on native (iOS/Android) while
// working fine on web, where the browser provides these APIs natively —
// which is exactly why OTP send fails only on mobile.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { useEffect, useRef, useState } from 'react';
import { AppState, View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { initializeAuth, useAuthStore } from '@/services/auth';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { registerForPushNotifications } from '@/services/notifications';
import { initSentry, Sentry } from '@/services/sentry';
import { flushWriteQueue } from '@/services/offline-queue';
import { OfflineIndicator } from '@/components/ui';

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
  const handledColdStart = useRef(false);

  useEffect(() => {
    initializeAuth().finally(() => setIsReady(true));
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
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
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeFromNotificationData(response.notification.request.content.data, router);
    });

    if (!handledColdStart.current) {
      handledColdStart.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) {
          routeFromNotificationData(response.notification.request.content.data, router);
        }
      });
    }

    return () => sub.remove();
  }, [router]);

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
      <OfflineIndicator isOffline={false} />

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

export default Sentry.wrap(RootLayout);
