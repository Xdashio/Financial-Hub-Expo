import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

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

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableAutoSessionTracking: true,
  });
  initialized = true;
}

export { Sentry };
