import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '@/services/auth';
import { colors } from '@/theme';

export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasPlan = useAuthStore((state) => state.hasPlan);
  const isCheckingPlan = useAuthStore((state) => state.isCheckingPlan);

  // Not logged in → sign in
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/signin" />;
  }

  // Logged in but still waiting for the plan check to resolve —
  // show a neutral spinner so neither route flickers in briefly.
  if (isCheckingPlan) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.emerald} />
      </View>
    );
  }

  // Logged in, plan check done — route based on result
  if (!hasPlan) {
    return <Redirect href="/(onboarding)/income" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});