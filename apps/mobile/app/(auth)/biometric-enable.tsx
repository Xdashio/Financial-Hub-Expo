import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { Button, ScreenContainer, SafeScrollView, SectionTitle } from '@/components/ui';
import { Fingerprint, ScanFace, Shield, ChevronLeft } from 'lucide-react-native';
import React from 'react';

type BiometricEnableParams = {
  fromSignup?: string;
};

export default function BiometricEnableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<BiometricEnableParams>();
  const { colors } = useTheme();
  const { enableBiometrics, disableBiometrics, user, checkBiometricAvailability, checkHasPlan } = useAuthStore();
  
  // user?.biometricEnabled reflects what's actually persisted (see auth.ts
  // getBiometricEnabled/setBiometricEnabled). Previously this always
  // started at false, which was harmless during signup (a brand-new user
  // is never already enabled) but broke the moment this screen was reused
  // from Settings — opening it to check your current status showed the
  // toggle off even when biometrics were on.
  const [isEnabled, setIsEnabled] = React.useState(!!user?.biometricEnabled);
  const [isLoading, setIsLoading] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<'face' | 'fingerprint' | null>(null);
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const fromSignup = params?.fromSignup === 'true';

  // Check for biometric availability on mount
  useEffect(() => {
    const checkBiometrics = async () => {
      const available = await checkBiometricAvailability();
      setBiometricAvailable(available);
      setIsReady(true);
      
      if (available) {
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        }
      }
    };
    checkBiometrics();
  }, [checkBiometricAvailability]);

  // Auto-skip only applies to the signup flow (there's nothing to manage
  // if the device has no biometric hardware and the user is mid-onboarding).
  // From Settings, hardware being unavailable is itself the useful thing
  // to show the person, not a reason to silently bounce them back to Home.
  useEffect(() => {
    if (fromSignup && isReady && !biometricAvailable) {
      const handleSkip = async () => {
        await checkHasPlan();
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        router.replace('/');
      };
      handleSkip();
    }
  }, [fromSignup, isReady, biometricAvailable, checkHasPlan, router]);

  const toggleBiometric = async () => {
    if (!biometricAvailable) return;
    
    setIsLoading(true);
    try {
      if (isEnabled) {
        await disableBiometrics();
        setIsEnabled(false);
      } else {
        // First authenticate to enable
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Enable ${biometricType === 'face' ? 'Face ID' : 'fingerprint'} for Financial Hub`,
          fallbackLabel: 'Use passcode',
          cancelLabel: 'Cancel',
        });
        
        if (result.success) {
          await enableBiometrics();
          setIsEnabled(true);
        }
      }
    } catch (error) {
      // User cancelled or error
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!fromSignup) {
      // Opened from Settings — just return to Profile, there's no plan
      // gate to apply here.
      router.back();
      return;
    }
    // Signup flow: always route through index so it can apply the plan
    // gate correctly. index.tsx will read hasPlan from the store (set
    // during verifyOtp) and send the user to onboarding or home as
    // appropriate. Ensure plan check completes before redirecting.
    await checkHasPlan();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    router.replace('/');
  };

  // Show loading while checking biometric availability
  if (!isReady) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.emeraldDeep} />
        </View>
      </ScreenContainer>
    );
  }

  // During signup, an unavailable device silently skips this step (handled
  // above). From Settings, silently rendering nothing left the "Biometric
  // unlock" row looking broken — show an explanation instead.
  if (!biometricAvailable) {
    if (fromSignup) return null;
    return (
      <ScreenContainer>
        <SafeScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          <View style={{ alignItems: 'center', paddingTop: spacing.xxxl }}>
            <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.clayTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
              <Fingerprint size={28} color={colors.clay} strokeWidth={2.5} />
            </View>
            <Text style={{ ...typography.display, color: colors.ink, textAlign: 'center' }}>No biometrics set up</Text>
            <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md, textAlign: 'center', lineHeight: 22 }}>
              This device doesn&apos;t have Face ID or a fingerprint enrolled. Set one up in your device settings, then come back here to turn it on for Financial Hub.
            </Text>
          </View>
          <View style={{ marginTop: spacing.xxl }}>
            <Button fullWidth size="lg" onPress={() => router.back()}>
              Back to Settings
            </Button>
          </View>
        </SafeScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SafeScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={{ alignItems: 'center', paddingTop: spacing.lg, marginBottom: spacing.xxl }}>
          <View style={{ width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.clayTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
            {biometricType === 'face' ? (
              <ScanFace size={28} color={colors.clay} strokeWidth={2.5} />
            ) : (
              <Fingerprint size={28} color={colors.clay} strokeWidth={2.5} />
            )}
          </View>
          <Text style={{ ...typography.eyebrow, color: colors.sage }}>Almost there</Text>
          <Text style={{ ...typography.display, color: colors.ink, marginTop: spacing.sm, textAlign: 'center' }}>Speed up future sign-ins</Text>
          <Text style={{ ...typography.body, color: colors.sage, marginTop: spacing.md, textAlign: 'center', lineHeight: 22 }}>
            {biometricType === 'face' ? 'Face ID' : 'Fingerprint'} lets you open Financial Hub without typing your password every time.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.xl, paddingHorizontal: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.emeraldTint, alignItems: 'center', justifyContent: 'center' }}>
            {biometricType === 'face' ? (
              <ScanFace size={20} color={colors.ink} strokeWidth={2.5} />
            ) : (
              <Fingerprint size={20} color={colors.ink} strokeWidth={2.5} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.heading, color: colors.ink }}>Use {biometricType === 'face' ? 'Face ID' : 'fingerprint'} to unlock</Text>
            <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>You&apos;ll be prompted by your device — this is native, on-device, and free</Text>
          </View>
          <TouchableOpacity
            style={[
              { width: 52, height: 30, borderRadius: radius.pill, backgroundColor: colors.lineSoft, padding: 2, justifyContent: 'center', minWidth: touchTarget.minWidth, minHeight: touchTarget.minHeight },
              isEnabled && { backgroundColor: colors.emeraldDeep },
              { opacity: isLoading ? 0.5 : 1 },
            ]}
            onPress={toggleBiometric}
            accessibilityRole="switch"
            accessibilityState={{ checked: isEnabled }}
            accessibilityLabel={`Enable ${biometricType === 'face' ? 'Face ID' : 'fingerprint'}`}
          >
            <View style={[
              { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
              isEnabled && { marginLeft: 22 },
            ]} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.xl, backgroundColor: colors.emeraldTint, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          <Shield size={15} color={colors.emeraldDeep} strokeWidth={2} />
          <Text style={{ ...typography.caption, color: colors.emeraldDeep }}>
            Biometrics stay on your device — Financial Hub never stores your fingerprint or face data.
          </Text>
        </View>

        <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center', marginTop: spacing.xl }}>
          You can change this anytime in <Text style={{ color: colors.ink }}>Profile → Security</Text>.
        </Text>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleContinue}
          rightIcon={fromSignup ? <ChevronLeft size={18} color={colors.surface} style={{ transform: [{ rotate: '180deg' }] }} /> : undefined}
        >
          {fromSignup ? 'Enable & continue' : 'Done'}
        </Button>

        {fromSignup && (
          <View style={{ marginTop: spacing.md }}>
            <Button variant="ghost" onPress={handleContinue}>
              Not now
            </Button>
          </View>
        )}
      </SafeScrollView>
    </ScreenContainer>
  );
}