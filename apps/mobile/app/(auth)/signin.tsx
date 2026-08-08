import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { showAlert } from '@/utils/alert';
import { useAuthStore } from '@/services/auth';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Fingerprint, ScanFace } from 'lucide-react-native';
import React from 'react';

export default function SignInScreen() {
  const router = useRouter();
  const { user, checkBiometricAvailability, sendOtp } = useAuthStore();
  const [phone, setPhone] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState('');
  const [showBiometric, setShowBiometric] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<'face' | 'fingerprint' | null>(null);

  // Check for biometric availability on mount
  useEffect(() => {
    const checkBiometrics = async () => {
      const hasBiometric = await checkBiometricAvailability();
      if (hasBiometric) {
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        }
        setShowBiometric(true);
      }
    };
    checkBiometrics();
  }, []);

  const handleBiometricSignIn = async () => {
    if (!user || !user.biometricEnabled) return;

    setIsLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Financial Hub',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      // User cancelled or error - fall back to OTP
    } finally {
      setIsLoading(false);
    }
  };

  const validatePhone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    return cleaned.length === 9 && cleaned.startsWith('7');
  };

  const handleSendCode = async () => {
    if (!validatePhone(phone)) {
      setPhoneError('Enter a valid Kenyan number starting with 7 (e.g., 712 345 678)');
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = `+254${phone.replace(/\s/g, '')}`;
      await sendOtp(fullPhone);
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { phone: fullPhone, mode: 'signin' },
      });
    } catch (error: any) {
      console.log('sendOtp error:', JSON.stringify(error, null, 2));
      showAlert('Error', error?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (text: string) => {
    // Strip everything except digits (blocks emojis, letters, symbols); cap at 9
    const cleaned = text.replace(/\D/g, '').slice(0, 9);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
    if (phoneError) setPhoneError('');
  };

  return (
    <ScreenContainer>
      <SafeScrollView contentContainerStyle={styles.scrollContent}>
        <BrandHeader onBack={() => router.canGoBack() && router.back()} />
        
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Your money, in pockets</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtext}>Sign in to see what&apos;s safe to spend today.</Text>
        </View>

        {showBiometric && user?.biometricEnabled && (
          <View style={styles.biometricSection}>
            <Button
              variant="secondary"
              fullWidth
              size="lg"
              loading={isLoading}
              onPress={handleBiometricSignIn}
              leftIcon={
                biometricType === 'face' ? (
                  <ScanFace size={18} color={colors.ink} strokeWidth={2} />
                ) : (
                  <Fingerprint size={18} color={colors.ink} strokeWidth={2} />
                )
              }
            >
              Continue with {biometricType === 'face' ? 'Face ID' : 'Fingerprint'}
            </Button>
            
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        <View style={styles.formGroup}>
          <Input
            label="Phone number"
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="712 345 678"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            leftElement={<Text style={styles.prefix}>+254</Text>}
            error={phoneError}
            accessible={true}
            accessibilityLabel="Phone number"
          />
        </View>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleSendCode}
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Send one-time code
        </Button>

        <View style={[styles.footer, { flexDirection: 'row', gap: 4 }]}>
          <Text style={styles.footerText}>New here?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.link}>Create an account</Text>
          </TouchableOpacity>
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
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
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
  biometricSection: {
    marginBottom: spacing.xxl,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lineSoft,
  },
  dividerText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.sage,
  },
  formGroup: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  prefix: {
    ...typography.body,
    fontSize: 15,
    color: colors.sage,
  },
  footer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  footerText: {
    ...typography.body,
    color: colors.sage,
  },
  link: {
    color: colors.emeraldDeep,
  },
});