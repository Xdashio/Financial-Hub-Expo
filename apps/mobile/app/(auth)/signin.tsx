import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, radius, spacing, typography, shadow, touchTarget } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { Button, Input, ScreenContainer, SafeScrollView, BrandHeader, ProgressIndicator, SectionTitle } from '@/components/ui';
import { ChevronLeft, Fingerprint, ScanFace } from 'lucide-react-native';
import React from 'react';

export default function SignInScreen() {
  const router = useRouter();
  const _auth = useAuthStore() as any;
  const { user, checkBiometricAvailability } = _auth;
  const signIn = _auth.signIn as any;
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
      await signIn(`+254${phone.replace(/\s/g, '')}`, password);
      router.replace('/(tabs)');
    } catch (error) {
      if (error instanceof Error && error.message === 'NEW_DEVICE_OTP_REQUIRED') {
        router.push({
          pathname: '/(auth)/verify-otp',
          params: {
            phone: `+254${phone.replace(/\s/g, '')}`,
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
    // Strip everything except digits (blocks emojis, letters, symbols); cap at 9
    const cleaned = text.replace(/\D/g, '').slice(0, 9);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  };

  const handlePhoneChange = (text: string) => {
    setPhone(formatPhone(text));
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
        </View>

        <View style={styles.forgotPassword}>
          <TouchableOpacity
            onPress={() => Alert.alert('Reset password', 'Password reset would be implemented here')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
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
    marginBottom: spacing.md,
  },
  prefix: {
    ...typography.body,
    fontSize: 15,
    color: colors.sage,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  forgotPasswordText: {
    ...typography.body,
    fontSize: 13,
    color: colors.emeraldDeep,
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