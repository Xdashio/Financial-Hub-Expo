import { View, Text, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Fingerprint, ScanFace } from 'lucide-react-native';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, user, checkBiometricAvailability } = useAuthStore();
  const [phone, setPhone] = React.useState('712 345 678');
  const [password, setPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
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
        fallbackLabel: 'Use phone & password',
        cancelLabel: 'Cancel',
      });
      
      if (result.success) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      // User cancelled or error - fall back to password
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!phone.trim() || !password) {
      Alert.alert('Error', 'Please enter both phone and password');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(`+254 ${phone.replace(/\s/g, '')}`, password);
      router.replace('/(tabs)');
    } catch (error) {
      if (error instanceof Error && error.message === 'NEW_DEVICE_OTP_REQUIRED') {
        router.push({
          pathname: '/(auth)/verify-otp',
          params: {
            phone: `+254 ${phone.replace(/\s/g, '')}`,
            mode: 'new-device',
          },
        });
      } else {
        Alert.alert('Error', 'Invalid credentials. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
  };

  return (
    <ScreenContainer>
      <SafeScrollView>
        <BrandHeader onBack={() => router.back()} />
        
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Your money, in pockets</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtext}>Sign in to see what&apos;s safe to spend today.</Text>
        </View>

        {showBiometric && user?.biometricEnabled && (
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
        )}

        {showBiometric && user?.biometricEnabled && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        <Input
          label="Phone number"
          value={phone}
          onChangeText={handlePhoneChange}
          placeholder="712 345 678"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          leftElement={<Text style={styles.prefix}>+254</Text>}
          helperText="Uses the device's number pad — no custom keypad needed."
          accessible={true}
          accessibilityLabel="Phone number"
        />

        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          accessible={true}
          accessibilityLabel="Password"
        />

        <View style={styles.forgotPassword}>
          <Button variant="ghost" onPress={() => Alert.alert('Reset password', 'Password reset would be implemented here')}>
            Forgot password?
          </Button>
        </View>

        <View style={styles.devNote}>
          <Text style={styles.devNoteText}>
            <Text style={styles.devNoteBold}>Dev build:</Text>{' '}
            new-device sign-ins verify with a phone OTP code shown in the terminal. 
            No email, no SMS spend — the real SMS path is the production upgrade.
          </Text>
        </View>

        <Button
          fullWidth
          size="lg"
          loading={isLoading}
          onPress={handleSignIn}
          rightIcon={<ChevronLeft size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />}
        >
          Sign in
        </Button>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            New here?{' '}
            <Text style={styles.link} onPress={() => router.push('/(auth)/signup')}>Create an account</Text>
          </Text>
        </View>
      </SafeScrollView>
    </ScreenContainer>
  );
}

import React from 'react';

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.sage,
  },
  title: {
    ...typography.display,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  subtext: {
    ...typography.body,
    color: colors.sage,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
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
  prefix: {
    ...typography.body,
    fontSize: 15,
    color: colors.sage,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  devNote: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.infoTint,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.info,
  },
  devNoteText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.info,
    lineHeight: 18,
    textAlign: 'center',
  },
  devNoteBold: {
    fontWeight: '700',
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    ...typography.body,
    color: colors.sage,
  },
  link: {
    color: colors.emeraldDeep,
    fontWeight: '600',
  },
});