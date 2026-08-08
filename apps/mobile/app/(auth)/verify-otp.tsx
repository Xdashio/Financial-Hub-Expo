import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { showAlert } from '@/utils/alert';
import { Button, ScreenContainer, SafeScrollView, BrandHeader, SectionTitle } from '@/components/ui';
import { OtpInput } from '@/components/auth/OtpInput';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';

type VerifyOtpParams = {
  phone: string;
  fullName?: string;
  mode: 'signup' | 'signin' | 'new-device';
};

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<VerifyOtpParams>();
  const { verifyOtp } = useAuthStore();
  
  const [code, setCode] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [resendTimer, setResendTimer] = React.useState(60);
  const [canResend, setCanResend] = React.useState(false);
  const [error, setError] = React.useState('');

  const phone = params?.phone || '';
  const fullName = params?.fullName || '';
  const mode = params?.mode || 'signup';

  // Start resend timer
  useEffect(() => {
    setResendTimer(60);
    setCanResend(false);
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCodeChange = (text: string) => {
    setCode(text);
    setError('');
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // verifyOtp returns { user, error? } — not a boolean
      const result = await verifyOtp(phone, code);

      if (result.error || !result.user) {
        setError(result.error ?? 'Invalid code. Please try again.');
        setIsLoading(false);
        return;
      }

      // OTP verified — checkHasPlan() was already called inside verifyOtp().
      // For new sign-ups with biometrics available, show the biometric enable prompt first.
      // In all other cases, let index.tsx handle routing (it now knows hasPlan state).
      if (mode === 'signup') {
        const hasBiometric = await useAuthStore.getState().checkBiometricAvailability();
        if (hasBiometric) {
          router.replace({ pathname: '/(auth)/biometric-enable', params: { fromSignup: 'true' } });
        } else {
          // No biometrics — go to index so it routes to onboarding or home correctly
          router.replace('/');
        }
      } else {
        // signin or new-device: go to index, which routes based on hasPlan
        router.replace('/');
      }
    } catch (err) {
      showAlert('Error', 'Verification failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    
    setIsLoading(true);
    try {
      await useAuthStore.getState().sendOtp(phone);
      setResendTimer(60);
      setCanResend(false);
    } catch {
      showAlert('Error', 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    // Format for display: +254 712 345 678
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('254')) {
      return `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
    }
    return phone;
  };

  return (
    <ScreenContainer>
      <SafeScrollView contentContainerStyle={styles.scrollContent}>
        <BrandHeader onBack={() => router.canGoBack() && router.back()} />
        
        <View style={styles.header}>
          <Text style={styles.eyebrow}>One-time code</Text>
          <Text style={styles.title}>Enter the 6-digit code</Text>
          <Text style={styles.subtext}>
            We sent it to <Text style={styles.boldPhone}>{formatPhone(phone)}</Text>. It expires in 10 minutes.
          </Text>
        </View>

        <OtpInput
          value={code}
          onChangeText={handleCodeChange}
          onComplete={handleVerify}
          autoFocus={true}
          error={error}
          accessibilityLabel="Enter the 6-digit verification code sent to your phone"
        />

        <View style={styles.hint}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={[styles.hintText, styles.resendLink]}>Resend code</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hintText}>
              <Text style={styles.boldTimer}>Resend code</Text> in {Math.floor(resendTimer / 60)}:{String(resendTimer % 60).padStart(2, '0')}
            </Text>
          )}
        </View>

        

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleVerify}
          disabled={code.length !== 6}
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Verify & continue
        </Button>

        <View style={[styles.footer, { flexDirection: 'row', gap: 4 }]}>
          <Text style={styles.footerText}>Wrong number?</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Edit it</Text>
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
  boldPhone: {
    color: colors.ink,
  },
  hint: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  hintText: {
    ...typography.body,
    color: colors.sage,
    textAlign: 'center',
  },
  resendLink: {
    color: colors.emeraldDeep,
  },
  boldTimer: {
  },
  devNote: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.warningTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  devNoteText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.warning,
    lineHeight: 18,
    textAlign: 'center',
  },
  devNoteBold: {
  },
  codeDisplay: {
    fontFamily: 'monospace',
    fontSize: 14,
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