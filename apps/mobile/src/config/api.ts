// Prefer EXPO_PUBLIC_API_URL (EAS environment variables / .env.local).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? 'http://localhost:3000/api' : '');

if (!API_BASE_URL && !__DEV__) {
  console.warn('[config/api] EXPO_PUBLIC_API_URL is not defined in this build.');
}

/**
 * Extra headers that must only ever be sent from dev builds (M8).
 * The ngrok browser-interstitial bypass is needed when the dev API is
 * exposed through an ngrok tunnel, but it must never ship in production
 * traffic: it is a dev-tunnel affordance, and sending it from store builds
 * leaks which tunnel provider the backend sits behind. Gate on `__DEV__`
 * (false for every EAS/production bundle) instead of sniffing the URL, so
 * a production build pointed at a tunnel by accident still stays clean.
 */
export function getDevTunnelHeaders(): Record<string, string> {
  if (__DEV__) {
    return { 'ngrok-skip-browser-warning': 'true' };
  }
  return {};
}
