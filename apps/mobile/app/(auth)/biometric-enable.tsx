import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
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
  const { enableBiometrics, disableBiometrics, user, checkBiometricAvailability } = useAuthStore();
  
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<'face' | 'fingerprint' | null>(null);
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const fromSignup = params?.fromSignup === 'true';

  useEffect(() => {
    const checkBiometrics = async () => {
      const available = await checkBiometricAvailability();
      setBiometricAvailable(available);
      
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
  }, []);

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

  const handleContinue = () => {
    // Always route through index so it can apply the plan gate correctly.
    // index.tsx will read hasPlan from the store (set during verifyOtp) and
    // send the user to onboarding or home as appropriate.
    router.replace('/');
  };

  if (!biometricAvailable) {
    // If biometrics not available, skip to home
    useEffect(() => {
      handleContinue();
    }, []);
    return null;
  }

  return (
    <ScreenContainer>
      <SafeScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.successIcon}>
            {biometricType === 'face' ? (
              <ScanFace size={28} color={colors.clay} strokeWidth={2.5} />
            ) : (
              <Fingerprint size={28} color={colors.clay} strokeWidth={2.5} />
            )}
          </View>
          <Text style={styles.eyebrow}>Almost there</Text>
          <Text style={styles.title}>Speed up future sign-ins</Text>
          <Text style={styles.subtext}>
            {biometricType === 'face' ? 'Face ID' : 'Fingerprint'} lets you open Financial Hub without typing your password every time.
          </Text>
        </View>

        <View style={styles.biometricRow}>
          <View style={styles.bioIcon}>
            {biometricType === 'face' ? (
              <ScanFace size={20} color={colors.ink} strokeWidth={2.5} />
            ) : (
              <Fingerprint size={20} color={colors.ink} strokeWidth={2.5} />
            )}
          </View>
          <View style={styles.bioText}>
            <Text style={styles.bioTitle}>Use {biometricType === 'face' ? 'Face ID' : 'fingerprint'} to unlock</Text>
            <Text style={styles.bioDesc}>You&apos;ll be prompted by your device — this is native, on-device, and free</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.toggle,
              isEnabled && styles.toggleEnabled,
              { opacity: isLoading ? 0.5 : 1 },
            ]}
            onPress={toggleBiometric}
            accessibilityRole="switch"
            accessibilityState={{ checked: isEnabled }}
            accessibilityLabel={`Enable ${biometricType === 'face' ? 'Face ID' : 'fingerprint'}`}
          >
            <View style={[
              styles.toggleThumb,
              isEnabled && styles.toggleThumbEnabled,
            ]} />
          </TouchableOpacity>
        </View>

        <View style={styles.protectStrip}>
          <Shield size={15} color={colors.emeraldDeep} strokeWidth={2} />
          <Text style={styles.protectText}>
            Biometrics stay on your device — Financial Hub never stores your fingerprint or face data.
          </Text>
        </View>

        <Text style={styles.settingsText}>
          You can change this anytime in <Text style={styles.bold}>Profile → Security</Text>.
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

        <View style={styles.footer}>
          <Button variant="ghost" onPress={handleContinue}>
            Not now
          </Button>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.clayTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.sage,
  },
  title: {
    ...typography.display,
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  bioIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioText: {
    flex: 1,
  },
  bioTitle: {
    ...typography.heading,
    color: colors.ink,
  },
  bioDesc: {
    ...typography.caption,
    color: colors.sage,
    marginTop: 2,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
    padding: 2,
    justifyContent: 'center',
    minWidth: touchTarget.minWidth,
    minHeight: touchTarget.minHeight,
  },
  toggleEnabled: {
    backgroundColor: colors.emeraldDeep,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleThumbEnabled: {
    marginLeft: 22,
  },
  protectStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    backgroundColor: colors.emeraldTint,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  protectText: {
    ...typography.caption,
    color: colors.emeraldDeep,
    flex: 1,
  },
  settingsText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.sage,
    marginTop: spacing.lg,
    lineHeight: 18,
    textAlign: 'center',
  },
  bold: {
    color: colors.ink,
  },
  footer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
});