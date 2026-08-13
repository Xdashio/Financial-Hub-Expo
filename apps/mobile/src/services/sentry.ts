import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import type { ComponentType } from 'react';

let initialized = false;

/**
 * Initialize Sentry when a DSN is configured. No-op in local/dev builds
 * without EXPO_PUBLIC_SENTRY_DSN so demos don't spam empty projects.
 */
export function initSentry(): void {
  if (initialized) return;
  const dsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN ||
    (Constants.expoConfig?.extra as { sentryDsn?: string } | undefined)?.sentryDsn;
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      enableAutoSessionTracking: true,
    });
    initialized = true;
  } catch {
    // Never let crash reporting take down the app (Expo Go edge cases).
    initialized = false;
  }
}

/**
 * Wrap the root component with Sentry only when init succeeded.
 * Calling Sentry.wrap without a working native bridge was producing
 * `Cannot read property 'ErrorBoundary' of undefined` in Expo Go.
 */
export function wrapRoot<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  if (!initialized) return Root;
  try {
    return Sentry.wrap(Root);
  } catch {
    return Root;
  }
}

export { Sentry };
