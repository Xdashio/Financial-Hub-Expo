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
  
  const [isEnabled, setIsEnabled] = React.useState(false);
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

  // Handle skip if biometrics not available
  useEffect(() => {
    if (isReady && !biometricAvailable) {
      const handleSkip = async () => {
        await checkHasPlan();
        await new Promise(resolve => setTimeout(resolve, 100));
        router.replace('/');
      };
      handleSkip();
    }
  }, [isReady, biometricAvailable, checkHasPlan, router]);

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
    // Always route through index so it can apply the plan gate correctly.
    // index.tsx will read hasPlan from the store (set during verifyOtp) and
    // send the user to onboarding or home as appropriate.
    // Ensure plan check completes before redirecting
    await checkHasPlan();
    await new Promise(resolve => setTimeout(resolve, 100));
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

  // Don't render the UI if biometrics are not available (skip already handled)
  if (!biometricAvailable) {
    return null;
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
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Enable & continue
        </Button>

        <View style={{ marginTop: spacing.md }}>
          <Button variant="ghost" onPress={handleContinue}>
            Not now
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}