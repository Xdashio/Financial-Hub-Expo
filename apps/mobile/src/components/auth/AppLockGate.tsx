import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography } from '@/theme';
import { useAuthStore } from '@/services/auth';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { PocketLoader } from '@/components/ui';

// App-lock / biometric gate: biometric auth is required both on cold start
// and on resume, not just once at sign-in. Implemented once here as a root
// layout wrapper so every screen is covered without per-screen wiring.
//
// Only engages when the signed-in user has biometrics enabled
// (`user.biometricEnabled`, toggled from `(auth)/biometric-enable.tsx`) —
// users who never opted in are never gated. When engaged, this renders an
// opaque lock screen on top of everything else and blocks all navigation
// until `LocalAuthentication.authenticateAsync` succeeds.
const BACKGROUND_LOCK_THRESHOLD_MS = 60_000;

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const biometricEnabled = !!user?.biometricEnabled;

  // Locked on mount whenever biometrics are on, so a cold start (app
  // launched from killed state) is gated the same as a resume — not just
  // resume, matching §10's "on app resume (not just on launch)" framing,
  // which implies launch needs to be covered too.
  const [isLocked, setIsLocked] = useState(biometricEnabled);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const appState = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);
  const authenticatingRef = useRef(false);

  // Re-arm the lock whenever biometrics get turned on/off from Settings —
  // e.g. if the user just enabled it, the *next* resume should gate; if
  // they just disabled it, any pending lock should clear immediately.
  const [prevBiometricEnabled, setPrevBiometricEnabled] = useState(biometricEnabled);
  if (biometricEnabled !== prevBiometricEnabled) {
    setPrevBiometricEnabled(biometricEnabled);
    if (!biometricEnabled) {
      setIsLocked(false);
    }
  }

  useEffect(() => {
    LocalAuthentication.supportedAuthenticationTypesAsync().then((types) => {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('fingerprint');
      }
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;

      if (nextState === 'background' || nextState === 'inactive') {
        // Only start the clock on the transition into background, so
        // rapid inactive<->active flicker (e.g. the OS permission sheet)
        // doesn't reset an already-running timer.
        if (backgroundedAt.current === null) {
          backgroundedAt.current = Date.now();
        }
        return;
      }

      if (nextState === 'active' && (prevState === 'background' || prevState === 'inactive')) {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (!biometricEnabled) return;
        if (since !== null && Date.now() - since > BACKGROUND_LOCK_THRESHOLD_MS) {
          setIsLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [biometricEnabled]);

  const attemptUnlock = async () => {
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setIsAuthenticating(true);
    setLastError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        // Device-level biometrics got removed after the user turned this
        // on in-app — don't hard-lock someone out of their own budget.
        // Also covers Expo Go / emulator where hardware APIs are flaky.
        setIsLocked(false);
        return;
      }
      const result = await Promise.race([
        LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Financial Hub',
          fallbackLabel: 'Use passcode',
          cancelLabel: 'Cancel',
        }),
        new Promise<{ success: false }>((resolve) =>
          setTimeout(() => resolve({ success: false }), 15_000),
        ),
      ]);
      if (result.success) {
        setIsLocked(false);
      } else {
        setLastError('Authentication needed to continue.');
      }
    } catch {
      // Never hard-lock the app if the biometric module throws (common in
      // Expo Go). Prefer entry over a permanent spinner.
      setIsLocked(false);
      setLastError(null);
    } finally {
      authenticatingRef.current = false;
      setIsAuthenticating(false);
    }
  };

  // Prompt automatically as soon as the gate engages, so the user isn't
  // stuck reading a static screen before they can even try — the button
  // below is the retry path if this auto-attempt fails or is cancelled.
  // Deferred by a tick so the sync setState inside attemptUnlock doesn't
  // fire within the effect body itself (cascading-render guard).
  useEffect(() => {
    if (isLocked && isAuthenticated) {
      const t = setTimeout(() => void attemptUnlock(), 0);
      return () => clearTimeout(t);
    }
  }, [isLocked, isAuthenticated]);

  const showOverlay = isLocked && isAuthenticated;
  const label = biometricType === 'face' ? 'Face ID' : 'fingerprint';
  const BiometricIcon = biometricType === 'face' ? ScanFace : Fingerprint;

  return (
    <View style={{ flex: 1 }}>
      {/* Children (the Stack navigator) stay mounted underneath the lock
          screen rather than being unmounted while locked — otherwise every
          lock/unlock cycle would blow away in-flight navigation state. */}
      {children}

      {showOverlay && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.paper,
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.xl,
            zIndex: 1000,
            elevation: 1000,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.lg,
              backgroundColor: colors.emeraldTint,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.lg,
            }}
          >
            <BiometricIcon size={30} color={colors.emeraldDeep} strokeWidth={2} />
          </View>
          <Text style={{ ...typography.title, color: colors.ink, textAlign: 'center' }}>
            Financial Hub is locked
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.sage,
              marginTop: spacing.sm,
              textAlign: 'center',
              lineHeight: 22,
            }}
          >
            Use {label} to keep going.
          </Text>

          {lastError && (
            <Text
              style={{
                ...typography.caption,
                color: colors.clay,
                marginTop: spacing.md,
                textAlign: 'center',
              }}
            >
              {lastError}
            </Text>
          )}

          <Pressable
            onPress={attemptUnlock}
            disabled={isAuthenticating}
            style={{
              marginTop: spacing.xl,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.xl,
              borderRadius: radius.md,
              backgroundColor: colors.emeraldDeep,
              opacity: isAuthenticating ? 0.7 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Unlock with ${label}`}
          >
            {isAuthenticating ? (
              <PocketLoader size={20} color={colors.surface} />
            ) : (
              <BiometricIcon size={18} color={colors.surface} strokeWidth={2} />
            )}
            <Text style={{ ...typography.heading, color: colors.surface }}>
              {isAuthenticating ? 'Confirming…' : `Unlock with ${label}`}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}