import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { ScreenContainer, Button, Card, PocketLoader } from '@/components/ui';
import { Fingerprint, ScanFace, Shield, ArrowLeft } from 'lucide-react-native';
import { safeGoBack } from '@/utils/navigation';

type BiometricEnableParams = {
  fromSignup?: string;
};

export default function BiometricEnableScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<BiometricEnableParams>();
  const { colors } = useTheme();
  const { enableBiometrics, disableBiometrics, user, checkBiometricAvailability, checkHasPlan } =
    useAuthStore();

  const fromSignup = params?.fromSignup === 'true';
  const isEnabled = !!user?.biometricEnabled;
  const [isLoading, setIsLoading] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(fromSignup || !user?.biometricEnabled);
  const [isAuthenticatingEntry, setIsAuthenticatingEntry] = useState(false);
  const confirmingRef = useRef(false);

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'fingerprint';
  const biometricTitle = biometricType === 'face' ? 'Face ID' : 'Fingerprint';

  // React 19: initialize Animated.Value in lazy state to avoid accessing ref in render
  const [toggleAnim] = useState(() => new Animated.Value(isEnabled ? 1 : 0));

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: isEnabled ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isEnabled, toggleAnim]);

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

  const confirmAccess = useCallback(async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setIsAuthenticatingEntry(true);
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isFace = supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
      );
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Confirm ${isFace ? 'Face ID' : 'fingerprint'} to manage biometric unlock`,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        setIsUnlocked(true);
      }
    } catch {
      // User cancelled or authentication failed; user can tap retry button
    } finally {
      confirmingRef.current = false;
      setIsAuthenticatingEntry(false);
    }
  }, []);

  // When biometrics are on and opening from Settings, confirm identity before revealing controls
  useFocusEffect(
    useCallback(() => {
      if (fromSignup || !isReady || !biometricAvailable) return;
      if (!user?.biometricEnabled) {
        setIsUnlocked(true);
        return;
      }
      if (!isUnlocked) {
        confirmAccess();
      }
    }, [fromSignup, isReady, biometricAvailable, user?.biometricEnabled, isUnlocked, confirmAccess])
  );

  // Auto-skip only applies to the signup flow when device has no biometrics
  useEffect(() => {
    if (fromSignup && isReady && !biometricAvailable) {
      const handleSkip = async () => {
        try {
          await checkHasPlan();
        } catch {
          // Fall through
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        router.replace('/');
      };
      handleSkip();
    }
  }, [fromSignup, isReady, biometricAvailable, checkHasPlan, router]);

  const promptBiometric = async (message: string) => {
    return LocalAuthentication.authenticateAsync({
      promptMessage: message,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });
  };

  const handleContinue = async () => {
    if (!fromSignup) {
      safeGoBack(router, '/(tabs)/profile');
      return;
    }
    setIsLoading(true);
    try {
      await checkHasPlan();
    } catch {
      // Fall through to index router on error
    } finally {
      setIsLoading(false);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    router.replace('/');
  };

  const toggleBiometric = async () => {
    if (!biometricAvailable || isLoading) return;

    setIsLoading(true);
    try {
      if (isEnabled) {
        // If coming from Settings without entering via gate, confirm first.
        // If already passed entry gate, disable cleanly without redundant prompt.
        if (!isUnlocked && !fromSignup) {
          const result = await promptBiometric(`Confirm ${biometricLabel} to turn off biometric unlock`);
          if (!result.success) return;
        }
        await disableBiometrics();
      } else {
        const result = await promptBiometric(`Enable ${biometricTitle} for Financial Hub`);
        if (!result.success) return;
        await enableBiometrics();
        if (fromSignup) {
          await handleContinue();
          return;
        }
      }
    } catch {
      // User cancelled or authentication failed
    } finally {
      setIsLoading(false);
    }
  };

  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;

  if (!isReady) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PocketLoader size={40} color={colors.emeraldDeep} />
        </View>
      </ScreenContainer>
    );
  }

  if (!biometricAvailable) {
    if (fromSignup) return null;
    return (
      <ScreenContainer>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
            <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
              Biometric unlock
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center' }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: radius.md,
                backgroundColor: colors.clayTint,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Fingerprint size={24} color={colors.clay} strokeWidth={2.5} />
            </View>
            <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>
              No biometrics set up
            </Text>
            <Text
              style={{
                ...typography.body,
                color: colors.sage,
                marginTop: spacing.md,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              This device does not have Face ID or a fingerprint enrolled. Set one up in your
              device settings, then come back here to turn it on for Financial Hub.
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Button fullWidth size="lg" onPress={() => safeGoBack(router, '/(tabs)/profile')}>
              Back to Settings
            </Button>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Waiting on biometric confirmation before revealing settings.
  if (!isUnlocked) {
    return (
      <ScreenContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Biometric unlock
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.md,
              backgroundColor: colors.lineSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BiometricIcon size={28} color={colors.ink} strokeWidth={2} />
          </View>
          <View style={{ alignItems: 'center', gap: spacing.xs }}>
            <Text style={{ ...typography.heading, color: colors.ink, textAlign: 'center' }}>
              Authentication required
            </Text>
            <Text style={{ ...typography.body, color: colors.sage, textAlign: 'center', lineHeight: 22 }}>
              Confirm {biometricLabel} to view and change security settings.
            </Text>
          </View>
          <View style={{ width: '100%', gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              fullWidth
              size="lg"
              loading={isAuthenticatingEntry}
              onPress={confirmAccess}
              leftIcon={<BiometricIcon size={18} color={colors.surface} strokeWidth={2} />}
            >
              Unlock with {biometricTitle}
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onPress={() => safeGoBack(router, '/(tabs)/profile')}
            >
              Back to Settings
            </Button>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          {!fromSignup && (
            <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }}>
              <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
          )}
          <Text
            style={{
              ...typography.title,
              color: colors.ink,
              marginLeft: fromSignup ? 0 : spacing.md,
            }}
          >
            {fromSignup ? 'Lock Financial Hub for privacy' : 'Biometric unlock'}
          </Text>
        </View>

        {fromSignup && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.sage, lineHeight: 22 }}>
              Turn on {biometricLabel} so only you can open Financial Hub -- even if someone else
              picks up your phone.
            </Text>
          </View>
        )}

        {!fromSignup && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
            <Text style={{ ...typography.body, color: colors.sage, lineHeight: 22 }}>
              Require {biometricLabel} to open Financial Hub, keeping your pockets and balances
              private on this device.
            </Text>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: fromSignup ? 0 : spacing.lg }}>
          <Text style={{ ...typography.eyebrow, color: colors.ink, marginBottom: spacing.md }}>
            Security
          </Text>

          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              marginBottom: spacing.sm,
              opacity: isLoading ? 0.6 : 1,
            }}
            onPress={toggleBiometric}
            disabled={isLoading}
            accessibilityRole="switch"
            accessibilityState={{ checked: isEnabled }}
            accessibilityLabel={`Enable ${biometricLabel}`}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.xs,
                backgroundColor: colors.lineSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BiometricIcon size={18} color={colors.ink} strokeWidth={2} />
            </View>
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={{ ...typography.heading, color: colors.ink }}>
                Use {biometricLabel} to unlock
              </Text>
              <Text style={{ ...typography.caption, color: colors.sage, marginTop: 2 }}>
                Native, on-device, and free
              </Text>
            </View>
            <Animated.View
              style={{
                width: 48,
                height: 28,
                borderRadius: 14,
                padding: 2,
                justifyContent: 'center',
                backgroundColor: toggleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.lineSoft, colors.emeraldDeep],
                }),
              }}
            >
              <Animated.View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  shadowColor: colors.ink,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 2,
                  transform: [
                    {
                      translateX: toggleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 20],
                      }),
                    },
                  ],
                }}
              />
            </Animated.View>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Card style={{ backgroundColor: colors.emeraldTint, borderColor: colors.emeraldDeep }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <Shield size={15} color={colors.emeraldDeep} strokeWidth={2} style={{ marginTop: 2 }} />
              <Text style={{ ...typography.caption, color: colors.emeraldDeep, flex: 1 }}>
                Biometrics stay on your device -- Financial Hub never stores your fingerprint or face
                data.
              </Text>
            </View>
          </Card>
        </View>

        {fromSignup && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md }}>
            <Button
              fullWidth
              size="lg"
              loading={isLoading}
              onPress={isEnabled ? handleContinue : toggleBiometric}
              leftIcon={!isEnabled ? <BiometricIcon size={18} color={colors.surface} strokeWidth={2} /> : undefined}
            >
              {isEnabled ? 'Continue' : `Enable ${biometricTitle}`}
            </Button>
            <Button variant="ghost" onPress={handleContinue}>
              {isEnabled ? 'Skip for now' : 'Not now'}
            </Button>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}