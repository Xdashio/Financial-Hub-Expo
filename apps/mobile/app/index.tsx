import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/services/auth';
import { useTheme } from '@/theme/ThemeContext';
import LandingScreen from './landing';

export default function Index() {
  const { colors } = useTheme();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasPlan = useAuthStore((state) => state.hasPlan);
  const isCheckingPlan = useAuthStore((state) => state.isCheckingPlan);

  // Still checking auth state → show loading
  if (isCheckingPlan) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  // Not logged in → show landing page
  if (!isAuthenticated) {
    return <LandingScreen />;
  }

  // Logged in, plan check done — route based on result
  if (!hasPlan) {
    return <Redirect href="/(onboarding)/income" />;
  }

  return <Redirect href="/(tabs)" />;
}