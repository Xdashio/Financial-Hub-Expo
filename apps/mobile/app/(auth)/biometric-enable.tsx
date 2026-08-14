import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { Button, Card, PocketLoader } from '@/components/ui';
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
  const [isEnabled, setIsEnabled] = React.useState(!!user?.biometricEnabled);
  const [isLoading, setIsLoading] = React.useState(false);
  const [biometricType, setBiometricType] = React.useState<'face' | 'fingerprint' | null>(null);
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [isUnlocked, setIsUnlocked] = React.useState(fromSignup || !user?.biometricEnabled);
  const confirmingRef = useRef(false);

  const biometricLabel = biometricType === 'face' ? 'Face ID' : 'fingerprint';
  const biometricTitle = biometricType === 'face' ? 'Face ID' : 'Fingerprint';

  // Drives the switch track/thumb so toggling animates smoothly instead of
  // snapping instantly — the instant snap plus the icon popping in/out was
  // part of what read as "glitchy" alongside the re-prompt bug fixed above.
  const toggleAnim = useRef(new Animated.Value(isEnabled ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: isEnabled ? 1 : 0,
      duration: 180,
      useNativeDriver: false, // animating backgroundColor requires the JS driver
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

  // Keep local toggle in sync with store when returning to this screen.
  useEffect(() => {
    setIsEnabled(!!user?.biometricEnabled);
  }, [user?.biometricEnabled]);

  // The focus-gate below must only re-run when the screen is actually
  // re-entered (navigated back to), never as a side effect of the toggle
  // on this same screen changing `user.biometricEnabled` mid-visit — that
  // was the cause of the "confirm, then immediately asked again" glitch:
  // enabling/disabling biometrics updated the store, which used to sit in
  // this effect's own dependency array, so a successful toggle re-armed
  // and re-fired the exact same re-authentication prompt it had just
  // satisfied. Read the enabled flag from a ref instead so toggling this
  // screen's own switch can't retrigger it.
  const biometricEnabledRef = useRef(!!user?.biometricEnabled);
  useEffect(() => {
    biometricEnabledRef.current = !!user?.biometricEnabled;
  }, [user?.biometricEnabled]);

  // When biometrics are already on and this screen is opened again (Settings),
  // require a successful biometric confirmation before showing controls.
  useFocusEffect(
    React.useCallback(() => {
      if (fromSignup || !isReady || !biometricAvailable) return;
      if (!biometricEnabledRef.current) {
        setIsUnlocked(true);
        return;
      }

      let cancelled = false;

      const confirmAccess = async () => {
        if (confirmingRef.current) return;
        confirmingRef.current = true;
        setIsUnlocked(false);
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
          if (cancelled) return;
          if (result.success) {
            setIsUnlocked(true);
          } else {
            safeGoBack(router, '/(tabs)/profile');
          }
        } catch {
          if (!cancelled) safeGoBack(router, '/(tabs)/profile');
        } finally {
          confirmingRef.current = false;
        }
      };

      confirmAccess();
      return () => {
        cancelled = true;
      };
      // Intentionally excludes `user?.biometricEnabled` — see comment above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromSignup, isReady, biometricAvailable, router])
  );

  // Auto-skip only applies to the signup flow.
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

  const promptBiometric = async (message: string) => {
    return LocalAuthentication.authenticateAsync({
      promptMessage: message,
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
    });
  };

  const toggleBiometric = async () => {
    if (!biometricAvailable || isLoading) return;

    setIsLoading(true);
    try {
      if (isEnabled) {
        const result = await promptBiometric(`Confirm ${biometricLabel} to turn off biometric unlock`);
        if (!result.success) return;
        await disableBiometrics();
        setIsEnabled(false);
      } else {
        const result = await promptBiometric(`Enable ${biometricTitle} for Financial Hub`);
        if (!result.success) return;
        await enableBiometrics();
        setIsEnabled(true);
      }
    } catch {
      // User cancelled or authentication failed
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!fromSignup) {
      safeGoBack(router, '/(tabs)/profile');
      return;
    }
    await checkHasPlan();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    router.replace('/');
  };

  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;

  if (!isReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <PocketLoader size={40} color={colors.emeraldDeep} />
        </View>
      </SafeAreaView>
    );
  }

  if (!biometricAvailable) {
    if (fromSignup) return null;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
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
              This device doesn&apos;t have Face ID or a fingerprint enrolled. Set one up in your
              device settings, then come back here to turn it on for Financial Hub.
            </Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Button fullWidth size="lg" onPress={() => safeGoBack(router, '/(tabs)/profile')}>
              Back to Settings
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Waiting on biometric confirmation before revealing settings.
  if (!isUnlocked) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
          <Pressable onPress={() => safeGoBack(router, '/(tabs)/profile')} style={{ padding: spacing.sm }}>
            <ArrowLeft size={24} color={colors.ink} strokeWidth={2} />
          </Pressable>
          <Text style={{ ...typography.title, color: colors.ink, marginLeft: spacing.md }}>
            Biometric unlock
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <PocketLoader size={40} color={colors.emeraldDeep} />
          <Text style={{ ...typography.caption, color: colors.sage }}>
            Confirm {biometricLabel} to continue
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
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
              Turn on {biometricLabel} so only you can open Financial Hub — even if someone else
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
                Biometrics stay on your device — Financial Hub never stores your fingerprint or face
                data.
              </Text>
            </View>
          </Card>
        </View>

        {fromSignup && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.md }}>
            <Button fullWidth size="lg" loading={isLoading} onPress={handleContinue}>
              Continue
            </Button>
            <Button variant="ghost" onPress={handleContinue}>
              Not now
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}