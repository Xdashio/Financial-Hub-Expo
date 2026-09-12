// Prefer EXPO_PUBLIC_API_URL (EAS environment variables / .env.local).
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? 'http://localhost:3000/api' : '');

if (!API_BASE_URL && !__DEV__) {
  console.warn('[config/api] EXPO_PUBLIC_API_URL is not defined in this build.');
}
