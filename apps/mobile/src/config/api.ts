// Prefer EXPO_PUBLIC_API_URL (EAS profile / .env.local). Fallback for local
// Metro and for release builds if the env var was forgotten at build time.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__
    ? 'http://localhost:3000/api'
    : 'https://api-production-8db1.up.railway.app/api');
