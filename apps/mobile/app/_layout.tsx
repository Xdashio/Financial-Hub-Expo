import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { colors } from '../src/theme';
import { useAuthStore, initializeAuth } from '../src/services/auth';
import { useOnboardingStore } from '../src/services/onboarding-store';
import React, { useState } from 'react';

SplashScreen.preventAutoHideAsync();

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    'PlusJakartaSans_500Medium': require('./assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans_600SemiBold': require('./assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans_700Bold': require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
    'PlusJakartaSans_800ExtraBold': require('./assets/fonts/PlusJakartaSans-ExtraBold.ttf'),
  });

  const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();
  const { commitResult, isLoading: onboardingLoading } = useOnboardingStore();
  const [initialized, setInitialized] = React.useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeAuth();
      setInitialized(true);
    };
    init();
  }, []);

  // Determine which screen to show
  const getInitialRoute = () => {
    if (!initialized || authLoading || onboardingLoading) {
      return 'splash';
    }
    
    if (!isAuthenticated) {
      return '(auth)/signin';
    }
    
    // Check if onboarding is complete (has commitResult or user has plan)
    if (commitResult || (user && user.id)) {
      // In a real app, you'd check if user has completed onboarding
      // For now, if authenticated but no commitResult, show onboarding
      if (!commitResult) {
        return '(onboarding)/income';
      }
      return '(tabs)';
    }
    
    return '(onboarding)/income';
  };

  const initialRoute = getInitialRoute();

  if (!fontsLoaded || !initialized) {
    return (
      <View style={styles.splashContainer}>
        <ActivityIndicator size="large" color={colors.emeraldDeep} />
      </View>
    );
  }

  SplashScreen.hideAsync();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="splash" options={{ presentation: 'modal' }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
      <StatusBar style="dark" />
    </Stack>
  );
}