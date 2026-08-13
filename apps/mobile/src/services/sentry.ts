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
    // Sentry.wrap's typings are fixed to ComponentType<Record<string, unknown>>,
    // which doesn't unify with the generic P callers pass in (e.g. Expo Router's
    // root component type). The wrap itself is a runtime HOC that returns the
    // same component shape it was given, so this double-cast is safe — it's
    // narrowing/widening a type-level mismatch, not changing behavior.
    return Sentry.wrap(Root as unknown as ComponentType<Record<string, unknown>>) as unknown as ComponentType<P>;
  } catch {
    return Root;
  }
}

export { Sentry };