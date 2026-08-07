import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getOtpDelivery, OtpDelivery } from '@/services/otp-delivery';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export interface User {
  id: string;
  phone: string;
  fullName: string;
  biometricEnabled: boolean;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  otpCode: string | null;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<boolean>;
  signUp: (phone: string, fullName: string) => Promise<void>;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => void;
  enableBiometrics: () => Promise<void>;
  disableBiometrics: () => Promise<void>;
  checkBiometricAvailability: () => Promise<boolean>;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getStoredUser(): Promise<User | null> {
  return SecureStore.getItemAsync('user').then((data) => (data ? JSON.parse(data) : null));
}

function storeUser(user: User): Promise<void> {
  return SecureStore.setItemAsync('user', JSON.stringify(user));
}

function clearStoredUser(): Promise<void> {
  return SecureStore.deleteItemAsync('user');
}

function getBiometricEnabled(): Promise<boolean> {
  return SecureStore.getItemAsync('biometricEnabled').then((v) => v === 'true');
}

function setBiometricEnabled(enabled: boolean): Promise<void> {
  return SecureStore.setItemAsync('biometricEnabled', enabled.toString());
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      otpCode: null,

      sendOtp: async (phone: string) => {
        const code = generateOtp();
        const delivery: OtpDelivery = getOtpDelivery();
        await delivery.send(phone, code);
        set({ otpCode: code });
        
        // Clear OTP after expiry
        setTimeout(() => {
          const currentCode = get().otpCode;
          if (currentCode === code) {
            set({ otpCode: null });
          }
        }, OTP_EXPIRY_MS);
      },

      verifyOtp: async (phone: string, code: string) => {
        const storedCode = get().otpCode;
        return storedCode === code;
      },

      signUp: async (phone: string, fullName: string) => {
        set({ isLoading: true });
        try {
          await get().sendOtp(phone);
          
          // In a real app, you'd verify OTP here before creating user
          // For now, we'll create the user after OTP verification in the UI flow
          
          const user: User = {
            id: generateId(),
            phone,
            fullName,
            biometricEnabled: false,
            createdAt: new Date().toISOString(),
          };
          
          await storeUser(user);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signIn: async (phone: string, _password: string) => {
        set({ isLoading: true });
        try {
          const storedUser = await getStoredUser();
          
          if (!storedUser || storedUser.phone !== phone) {
            // New device - send OTP for verification
            await get().sendOtp(phone);
            set({ isLoading: false });
            throw new Error('NEW_DEVICE_OTP_REQUIRED');
          }
          
          // In a real app, you'd verify password here
          // For MVP, we'll just check if user exists
          
          set({ user: storedUser, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signOut: () => {
        clearStoredUser();
        set({ user: null, isAuthenticated: false });
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
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          if (name === 'auth-storage') {
            const data = await SecureStore.getItemAsync(name);
            return data ? JSON.parse(data) : null;
          }
          return null;
        },
        setItem: async (name, value) => {
          if (name === 'auth-storage') {
            await SecureStore.setItemAsync(name, JSON.stringify(value));
          }
        },
        removeItem: async (name) => {
          if (name === 'auth-storage') {
            await SecureStore.deleteItemAsync(name);
          }
        },
      })),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize auth state on app start
export async function initializeAuth() {
  const storedUser = await getStoredUser();
  const biometricEnabled = await getBiometricEnabled();
  
  if (storedUser) {
    useAuthStore.setState({
      user: { ...storedUser, biometricEnabled },
      isAuthenticated: true,
    });
  }
}