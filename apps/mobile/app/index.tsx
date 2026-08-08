import { Redirect } from 'expo-router';
import { useAuthStore } from '@/services/auth';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // By the time this mounts, RootLayout has already awaited initializeAuth(),
  // so isAuthenticated reflects any restored session — not just this session.
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/signin'} />;
}