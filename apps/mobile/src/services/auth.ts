import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/config/supabase.config';
import { API_BASE_URL, getDevTunnelHeaders } from '@/config/api';

// Base URL for API calls — see src/config/api.ts (EXPO_PUBLIC_API_URL).

// expo-secure-store has no web implementation (it throws
// "getValueWithKeyAsync is not a function" there), so on web we fall back to
// localStorage. This is not secure storage — fine for local dev on the web
// target, but real secrets should not rely on this path in production.
const storageAdapter = {
  getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      const store = (globalThis as any).localStorage;
      return Promise.resolve(store ? store.getItem(key) : null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      const store = (globalThis as any).localStorage;
      if (store) store.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      const store = (globalThis as any).localStorage;
      if (store) store.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export interface User {
  id: string;
  phone: string;
  fullName: string;
  biometricEnabled: boolean;
  createdAt: string;
  email?: string;
  featureFlags?: Record<string, boolean> | null;
}

/** Stable app-level auth flow codes — UI matches these, not English substrings (audit L1). */
export const AuthFlowCode = {
  NO_ACCOUNT: 'AUTH_NO_ACCOUNT',
  ALREADY_REGISTERED: 'AUTH_ALREADY_REGISTERED',
} as const;

export type AuthFlowCode = (typeof AuthFlowCode)[keyof typeof AuthFlowCode];

export class AuthFlowError extends Error {
  readonly code: AuthFlowCode;
  constructor(code: AuthFlowCode, message: string) {
    super(message);
    this.name = 'AuthFlowError';
    this.code = code;
  }
}

function isSignupDisabledError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  // Prefer Supabase AuthError.code; fall back to legacy message for older GoTrue.
  if (error.code === 'signup_disabled') return true;
  return typeof error.message === 'string' && /signups not allowed/i.test(error.message);
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: any;
  // Plan gate — true once the user has completed onboarding and has an active plan
  hasPlan: boolean;
  // True while we're checking the server for an active plan (avoids routing flicker)
  isCheckingPlan: boolean;
  sendOtp: (phone: string, options?: { fullName?: string; allowSignup?: boolean }) => Promise<void>;
  sendSignupOtp: (phone: string, fullName: string) => Promise<void>;
  verifyOtp: (phone: string, code: string, fullName?: string) => Promise<{ user: User | null; error?: string }>;
  signOut: () => Promise<void>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
  checkHasPlan: () => Promise<void>;
  restoreSession: () => Promise<void>;
  updateFullName: (fullName: string) => Promise<void>;
}

function getStoredUser(): Promise<User | null> {
  return storageAdapter.getItem('user').then((data) => (data ? JSON.parse(data) : null));
}

function storeUser(user: User): Promise<void> {
  return storageAdapter.setItem('user', JSON.stringify(user));
}

function clearStoredUser(): Promise<void> {
  return storageAdapter.removeItem('user');
}

function getBiometricEnabled(): Promise<boolean> {
  return storageAdapter.getItem('biometricEnabled').then((v) => v === 'true');
}

function setBiometricEnabled(enabled: boolean): Promise<void> {
  return storageAdapter.setItem('biometricEnabled', enabled.toString());
}

export function getLastHomeSegment(): Promise<'individual' | 'msme' | null> {
  return storageAdapter.getItem('last_home_segment').then((v) => {
    if (v === 'individual' || v === 'msme') return v;
    return null;
  });
}

export function setLastHomeSegment(segment: 'individual' | 'msme'): Promise<void> {
  return storageAdapter.setItem('last_home_segment', segment);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      session: null,
      hasPlan: false,
      isCheckingPlan: false,

      // Calls GET /api/profile/plans with the current session token (Phase 2:
      // segment-aware — checks both individual and msme). Falls back to
      // GET /profile/plan for backward compat with pre-016 deploys.
      // Sets hasPlan=true when an active plan exists in *any* segment.
      // Sets isCheckingPlan while the request is in flight so index.tsx can show a spinner.
      //
      // Important: only set hasPlan=false after a confirmed "no plan" response.
      // Network / 5xx / auth blips must NOT demote existing users into onboarding.
      checkHasPlan: async () => {
        set({ isCheckingPlan: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            set({ hasPlan: false, isCheckingPlan: false });
            return;
          }

          const maxRetries = 5;
          const retryDelay = 200;
          let lastKnown: boolean | null = null;

          for (let i = 0; i < maxRetries; i++) {
            try {
              // Prefer the segment-aware /profile/plans (returns array)
              let hasActivePlan = false;
              const resPlans = await fetch(`${API_BASE_URL}/profile/plans`, {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  // M8: dev-tunnel bypass only — absent in production builds.
                  ...getDevTunnelHeaders(),
                },
              });
              if (resPlans.ok) {
                const plans = await resPlans.json();
                hasActivePlan = Array.isArray(plans) && plans.length > 0;
                if (hasActivePlan) {
                  // Persist the segment of the first plan (used for cold-start routing)
                  const firstPlanSegment = (plans[0]?.segment === 'msme' ? 'msme' : 'individual');
                  await setLastHomeSegment(firstPlanSegment);
                  set({ hasPlan: true, isCheckingPlan: false });
                  return;
                }
                lastKnown = false;
              } else if (resPlans.status === 404) {
                // Old backend without /profile/plans — fall back to single-plan
                const res = await fetch(`${API_BASE_URL}/profile/plan`, {
                  headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    // M8: dev-tunnel bypass only — absent in production builds.
                    ...getDevTunnelHeaders(),
                  },
                });
                if (res.ok) {
                  const plan = await res.json();
                  hasActivePlan =
                    plan != null && typeof plan === 'object' && typeof plan.id === 'string';
                  if (hasActivePlan) {
                    set({ hasPlan: true, isCheckingPlan: false });
                    return;
                  }
                  lastKnown = false;
                }
              } else {
                // 401/5xx — inconclusive
              }
            } catch {
              // Network error — inconclusive
            }
            if (i < maxRetries - 1) {
              await new Promise<void>((resolve) => setTimeout(resolve, retryDelay * (i + 1)));
            }
          }

          if (lastKnown === false) {
            set({ hasPlan: false, isCheckingPlan: false });
            return;
          }

          const currentHasPlan = get().hasPlan;
          set({ hasPlan: currentHasPlan, isCheckingPlan: false });
        } catch {
          set({ isCheckingPlan: false });
        }
      },

      sendOtp: async (phone: string, options?: { fullName?: string; allowSignup?: boolean }) => {
        // allowSignup defaults to true so existing call sites that don't pass
        // it (e.g. resend-code) keep prior behaviour. The sign-in screen
        // explicitly passes allowSignup: false.
        const allowSignup = options?.allowSignup !== false;
        const fullName = options?.fullName;

        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            channel: 'sms',
            // Without this, Supabase happily creates a brand-new account for
            // any phone number that doesn't exist yet whenever OTP is
            // requested — so "Sign in" with an unregistered number silently
            // registered a blank phantom account instead of failing. Signup
            // explicitly opts in; sign-in explicitly opts out.
            shouldCreateUser: allowSignup,
            // Carries the name from signup into user_metadata so verifyOtp
            // can read it back for a brand-new account. NOTE: Supabase only
            // applies this `data` payload when the account is first created
            // — if the phone number is already registered it's silently
            // ignored, which is why verifyOtp() below also force-applies the
            // name via updateUser() after verification.
            ...(fullName ? { data: { full_name: fullName } } : {}),
          },
        });
        if (error) {
          // shouldCreateUser: false + unknown phone → signup_disabled (or
          // legacy "Signups not allowed for otp"). Map to a stable app code
          // so the sign-in screen does not substring-match English text (L1).
          if (!allowSignup && isSignupDisabledError(error)) {
            throw new AuthFlowError(
              AuthFlowCode.NO_ACCOUNT,
              'No account found for this number. Please create an account first.',
            );
          }
          throw error;
        }
      },

      // Dedicated entry point for the "Create account" screen's initial
      // submit. Bug this fixes: signInWithOtp with shouldCreateUser: true
      // NEVER errors for a phone number that's already registered — it just
      // silently reuses the existing account and sends it an OTP. That made
      // "sign up" with an existing number quietly log the returning user
      // into their old account instead of telling them they already have
      // one, and the signup screen's "already registered" catch-block could
      // never fire because Supabase never actually throws that error here.
      //
      // Fix: probe first with shouldCreateUser: false (same call sign-in
      // uses). If that succeeds, the number is already registered — refuse
      // to continue the signup flow and throw AUTH_ALREADY_REGISTERED so the
      // UI can redirect to sign in by code (L1). Only if the probe fails
      // with signup_disabled (i.e. no account exists yet) do we go ahead
      // and actually create the account.
      sendSignupOtp: async (phone: string, fullName: string) => {
        const { error: probeError } = await supabase.auth.signInWithOtp({
          phone,
          options: { channel: 'sms', shouldCreateUser: false },
        });

        if (!probeError) {
          // Succeeded => an account already exists for this number (an OTP
          // was just sent to it, same as a normal sign-in). Don't create a
          // second identity for it — send the user to sign in instead.
          throw new AuthFlowError(
            AuthFlowCode.ALREADY_REGISTERED,
            'An account with this number already exists. Please sign in instead.',
          );
        }

        if (!isSignupDisabledError(probeError)) {
          // Some other failure (rate limit, invalid number, network, etc.)
          // — surface it as-is rather than masking it as "no account".
          throw probeError;
        }

        // No existing account — safe to actually create one and send the
        // real signup OTP now.
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            channel: 'sms',
            shouldCreateUser: true,
            ...(fullName ? { data: { full_name: fullName } } : {}),
          },
        });
        if (error) throw error;
      },

      verifyOtp: async (phone: string, code: string, fullName?: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token: code,
          type: 'sms',
        });
        if (error) return { user: null, error: error.message };
        if (data.user) {
          let authUser = data.user;
          const trimmedName = fullName?.trim();

          // signInWithOtp's `data: { full_name }` payload only lands on
          // *newly created* accounts. If this number was already registered
          // (someone going through "Sign up" a second time, e.g. because
          // their first attempt silently became a sign-in), that metadata
          // is ignored and the name never persists. Force it here instead,
          // unconditionally, right after verification — this covers both
          // the brand-new-user case (no-op, name already matches) and the
          // already-registered case (actually fixes the stored name).
          if (trimmedName && authUser.user_metadata?.full_name !== trimmedName) {
            const { data: updateData, error: updateError } = await supabase.auth.updateUser({
              data: { full_name: trimmedName },
            });
            if (!updateError && updateData.user) {
              authUser = updateData.user;
            }
          }

          const storedBiometricEnabled = await getBiometricEnabled();
          const user: User = {
            id: authUser.id,
            phone: authUser.phone || phone,
            fullName: authUser.user_metadata?.full_name || '',
            biometricEnabled: storedBiometricEnabled,
            createdAt: authUser.created_at,
            email: authUser.email,
          };
          await storeUser(user);
          set({ user, isAuthenticated: true, session: data.session });
          // Check for existing plan so index.tsx routes to the right place
          await get().checkHasPlan();
          return { user };
        }
        return { user: null, error: 'Verification failed' };
      },

      signOut: async () => {
        // Best-effort: drop this device's Expo push token before clearing
        // auth so the Authorization header is still valid for the DELETE.
        try {
          const { unregisterPushToken } = await import('@/services/notifications');
          await unregisterPushToken();
        } catch {
          // Never block sign-out on push cleanup.
        }

        // Clear our own app-level cache/state first so the UI reflects
        // "signed out" immediately regardless of what the network call
        // below does.
        await clearStoredUser();
        set({ user: null, isAuthenticated: false, session: null, hasPlan: false });

        // BUG THIS FIXES: this call used to be fire-and-forget
        // (`supabase.auth.signOut().catch(() => {})`, never awaited). The
        // comment justifying it claimed the local session was "already
        // gone" at that point — but that's only true of *our own* `user`
        // cache above. The actual Supabase session (access + refresh
        // token) lives in its own separate storage and is only removed
        // once this call completes. Supabase's signOut() is documented to
        // skip that local removal step entirely when the network request
        // to revoke the session fails (e.g. the device is offline, or the
        // access token was already stale) — see supabase/auth-js#1518 and
        // supabase/gotrue-js#141. On a fire-and-forget call, the app had
        // already navigated to the sign-in screen and considered the user
        // signed out while a perfectly valid session token could still be
        // sitting in storage. If the user reopened (or the OS relaunched)
        // the app before that promise settled — very plausible on the
        // patchy mobile networks this app's users are likely on — the next
        // restoreSession() call would find that still-valid session and
        // silently sign them back in, despite having explicitly signed out.
        //
        // scope: 'local' only revokes *this device's* session. The default
        // ('global') revokes every session the user has on every device —
        // surprising behaviour for a single "Sign out" button that most
        // users signed in on multiple devices wouldn't expect.
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch (err) {
          // Local app state is already cleared above either way, so the
          // user is signed out of this app regardless — but the remote
          // session may not have been revoked (e.g. no network). Surface
          // this so the caller can let the user know, rather than silently
          // swallowing it as before.
          throw err instanceof Error
            ? err
            : new Error('Signed out locally, but could not confirm the remote session was closed.');
        }
      },

      enableBiometrics: async () => {
        const user = get().user;
        if (!user) return;
        
        const updatedUser = { ...user, biometricEnabled: true };
        await storeUser(updatedUser);
        await setBiometricEnabled(true);
        set({ user: updatedUser });
      },

      disableBiometrics: async () => {
        const user = get().user;
        if (!user) return;
        
        const updatedUser = { ...user, biometricEnabled: false };
        await storeUser(updatedUser);
        await setBiometricEnabled(false);
        set({ user: updatedUser });
      },

      checkBiometricAvailability: async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        return hasHardware && isEnrolled;
      },

      // Name is the only editable identity field — phone is the auth
      // identifier (verified via OTP) and can't be changed from here, and
      // email isn't collected/shown at all. Writes straight to Supabase's
      // own user_metadata.full_name, same field verifyOtp() reads back, so
      // this stays the single source of truth for the display name.
      updateFullName: async (fullName: string) => {
        const user = get().user;
        if (!user) return;

        const trimmed = fullName.trim();
        const { data, error } = await supabase.auth.updateUser({
          data: { full_name: trimmed },
        });
        if (error) throw error;

        const updatedUser: User = {
          ...user,
          fullName: data.user?.user_metadata?.full_name || trimmed,
        };
        await storeUser(updatedUser);
        set({ user: updatedUser });
      },

      restoreSession: async () => {
        // The live Supabase session (now correctly persisted via the OS
        // keychain — SecureStore, not AsyncStorage; see supabase.config.ts)
        // is the single source of truth for whether the user is actually
        // signed in. The app also keeps its own small 'user' cache (name,
        // biometric flag) for fast UI, but that cache must never grant an
        // authenticated state on its own — it previously could, which let a
        // stale/cleared session still "look" signed in with no real token
        // behind it, and it could also fail to recognize a perfectly valid
        // live session just because the cache was empty (e.g. first launch
        // after a fix, or cache/session writes racing each other).
        set({ isCheckingPlan: true });
        const { data: { session } } = await supabase.auth.getSession();
        const biometricEnabled = await getBiometricEnabled();

        if (session?.user) {
          const storedUser = await getStoredUser();
          const user: User =
            storedUser && storedUser.id === session.user.id
              ? { ...storedUser, biometricEnabled }
              : {
                  id: session.user.id,
                  phone: session.user.phone || '',
                  fullName: session.user.user_metadata?.full_name || '',
                  biometricEnabled,
                  createdAt: session.user.created_at,
                  email: session.user.email,
                };
          // Heal the local cache if it was missing/stale/for a different user.
          await storeUser(user);
          set({ user, isAuthenticated: true, session });

          // checkHasPlan already retries internally on inconclusive network;
          // do not add a second no-op wait here (audit dead-code cleanup).
          await get().checkHasPlan();
        } else {
          // No live session — don't trust a leftover local cache to grant
          // access with no real credentials behind it.
          await clearStoredUser();
          set({ user: null, isAuthenticated: false, session: null, hasPlan: false, isCheckingPlan: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const data = await storageAdapter.getItem(name);
          if (!data) return null;
          // Legacy adapter double-stringified values. If parse yields a
          // string, that's the real createJSONStorage payload; otherwise
          // the value is already in the correct string form.
          try {
            const parsed = JSON.parse(data);
            return typeof parsed === 'string' ? parsed : data;
          } catch {
            return data;
          }
        },
        setItem: async (name, value) => {
          // createJSONStorage already JSON.stringifies — store as-is.
          await storageAdapter.setItem(name, value);
        },
        removeItem: async (name) => {
          await storageAdapter.removeItem(name);
        },
      })),
      // Persist hasPlan as a cache so a transient API failure on cold start
      // doesn't wipe a known-good plan. Never persist isCheckingPlan — a
      // stuck true would block routing forever after a crash mid-check.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        hasPlan: state.hasPlan,
      }),
    }
  )
);

async function waitForAuthHydration(): Promise<void> {
  const persistApi = useAuthStore.persist;
  if (persistApi.hasHydrated()) return;
  await Promise.race([
    new Promise<void>((resolve) => {
      const unsub = persistApi.onFinishHydration(() => {
        unsub();
        resolve();
      });
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

// Initialize auth state on app start.
// Hydration must finish first: if restoreSession ran before persist rehydrated,
// a stale hasPlan:false from storage could overwrite a fresh successful check
// and send existing users back into onboarding.
export async function initializeAuth() {
  const boot = async () => {
    await waitForAuthHydration();
    useAuthStore.setState({ isCheckingPlan: true });
    await useAuthStore.getState().restoreSession();
  };

  // Expo Go on Android can hang forever on SecureStore / network during
  // cold start — never block the root spinner longer than this.
  const timeoutMs = 12_000;
  await Promise.race([
    boot(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        useAuthStore.setState({ isCheckingPlan: false });
        resolve();
      }, timeoutMs);
    }),
  ]);
}