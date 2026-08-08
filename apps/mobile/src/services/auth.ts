import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/config/supabase.config';

// Base URL for API calls — mirrors the pattern in api.ts
const API_BASE_URL = __DEV__
  ? (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api')
  : 'https://api.financialhub.app/api';

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
  verifyOtp: (phone: string, code: string, fullName?: string) => Promise<{ user: User | null; error?: string }>;
  signOut: () => Promise<void>;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
  checkHasPlan: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      session: null,
      hasPlan: false,
      isCheckingPlan: false,

      // Calls GET /api/pockets with the current session token.
      // Sets hasPlan=true if the user already has at least one pocket (i.e. completed onboarding).
      // Sets isCheckingPlan while the request is in flight so index.tsx can show a spinner
      // instead of briefly flashing the wrong route.
      checkHasPlan: async () => {
        set({ isCheckingPlan: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            set({ hasPlan: false, isCheckingPlan: false });
            return;
          }
          const res = await fetch(`${API_BASE_URL}/pockets`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!res.ok) {
            // Treat any non-200 (e.g. 401, 500) as "no plan" — safe default
            set({ hasPlan: false, isCheckingPlan: false });
            return;
          }
          const pockets: any[] = await res.json();
          const hasPockets = Array.isArray(pockets) && pockets.length > 0;
          set({ hasPlan: hasPockets, isCheckingPlan: false });
        } catch {
          // Network error — default to no plan so user isn't stuck
          set({ hasPlan: false, isCheckingPlan: false });
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
          // Supabase's exact error text when shouldCreateUser: false hits an
          // unregistered phone number is "Signups not allowed for otp".
          if (!allowSignup && /signups not allowed/i.test(error.message)) {
            throw new Error('No account found for this number. Please create an account first.');
          }
          throw error;
        }
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

          const user: User = {
            id: authUser.id,
            phone: authUser.phone || phone,
            fullName: authUser.user_metadata?.full_name || '',
            biometricEnabled: false,
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
        // Clear local state first so the UI reflects "signed out" immediately —
        // don't make the user wait on a network round-trip to Supabase before
        // they can navigate away. The Supabase session revocation happens in
        // the background; if it fails (e.g. offline), the local session is
        // already gone and the stored refresh token can no longer be used to
        // silently resume it, so we fail safe rather than leaving the user
        // stuck mid-sign-out.
        await clearStoredUser();
        set({ user: null, isAuthenticated: false, session: null, hasPlan: false });
        supabase.auth.signOut().catch(() => {
          // Best-effort: local state is already cleared, nothing more to do.
        });
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

      restoreSession: async () => {
        // The live Supabase session (now correctly persisted via
        // AsyncStorage — see supabase.config.ts) is the single source of
        // truth for whether the user is actually signed in. The app also
        // keeps its own small 'user' cache (name, biometric flag) for fast
        // UI, but that cache must never grant an authenticated state on its
        // own — it previously could, which let a stale/cleared session
        // still "look" signed in with no real token behind it, and it
        // could also fail to recognize a perfectly valid live session just
        // because the cache was empty (e.g. first launch after a fix, or
        // cache/session writes racing each other).
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
          // Check for existing plan so returning users route correctly on cold start
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
          if (name === 'auth-storage') {
            const data = await storageAdapter.getItem(name);
            return data ? JSON.parse(data) : null;
          }
          return null;
        },
        setItem: async (name, value) => {
          if (name === 'auth-storage') {
            await storageAdapter.setItem(name, JSON.stringify(value));
          }
        },
        removeItem: async (name) => {
          if (name === 'auth-storage') {
            await storageAdapter.removeItem(name);
          }
        },
      })),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        hasPlan: state.hasPlan,
        isCheckingPlan: state.isCheckingPlan,
      }),
    }
  )
);

// Initialize auth state on app start
export async function initializeAuth() {
  await useAuthStore.getState().restoreSession();
}