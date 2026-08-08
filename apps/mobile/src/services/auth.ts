import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { supabase } from '@/config/supabase.config';

// Base URL for API calls — mirrors the pattern in api.ts
const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api'
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
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<{ user: User | null; error?: string }>;
  signUp: (phone: string, fullName: string) => Promise<void>;
  signInWithPassword: (phone: string, password: string) => Promise<void>;
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
          set({ hasPlan: Array.isArray(pockets) && pockets.length > 0, isCheckingPlan: false });
        } catch {
          // Network error — default to no plan so user isn't stuck
          set({ hasPlan: false, isCheckingPlan: false });
        }
      },

      sendOtp: async (phone: string) => {
        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            channel: 'sms',
          },
        });
        if (error) throw error;
      },

      verifyOtp: async (phone: string, code: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token: code,
          type: 'sms',
        });
        if (error) return { user: null, error: error.message };
        if (data.user) {
          const user: User = {
            id: data.user.id,
            phone: data.user.phone || phone,
            fullName: data.user.user_metadata?.full_name || '',
            biometricEnabled: false,
            createdAt: data.user.created_at,
            email: data.user.email,
          };
          await storeUser(user);
          set({ user, isAuthenticated: true, session: data.session });
          // Check for existing plan so index.tsx routes to the right place
          await get().checkHasPlan();
          return { user };
        }
        return { user: null, error: 'Verification failed' };
      },

      signUp: async (phone: string, fullName: string) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signInWithOtp({
            phone,
            options: {
              channel: 'sms',
              data: { full_name: fullName },
            },
          });
          if (error) throw error;
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signInWithPassword: async (phone: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            phone,
            password,
          });
          if (error) throw error;
          if (data.user) {
            const user: User = {
              id: data.user.id,
              phone: data.user.phone || phone,
              fullName: data.user.user_metadata?.full_name || '',
              biometricEnabled: false,
              createdAt: data.user.created_at,
              email: data.user.email,
            };
            await storeUser(user);
            set({ user, isAuthenticated: true, session: data.session, isLoading: false });
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signOut: async () => {
        await supabase.auth.signOut();
        await clearStoredUser();
        set({ user: null, isAuthenticated: false, session: null, hasPlan: false });
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
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const storedUser = await getStoredUser();
          const biometricEnabled = await getBiometricEnabled();
          if (storedUser) {
            set({
              user: { ...storedUser, biometricEnabled },
              isAuthenticated: true,
              session,
            });
            // Check for existing plan so returning users route correctly on cold start
            await get().checkHasPlan();
          }
        } else {
          const storedUser = await getStoredUser();
          const biometricEnabled = await getBiometricEnabled();
          if (storedUser) {
            set({
              user: { ...storedUser, biometricEnabled },
              isAuthenticated: true,
            });
            // No live session but stored user — still check plan with whatever token we have
            await get().checkHasPlan();
          }
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
      }),
    }
  )
);

// Initialize auth state on app start
export async function initializeAuth() {
  await useAuthStore.getState().restoreSession();
}