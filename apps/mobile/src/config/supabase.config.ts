import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

// SecureStore is the hardened equivalent of AsyncStorage for secrets. Sessions
// (access + refresh tokens) are the most sensitive credential the app holds —
// they grant full account access until they expire. AsyncStorage stores them in
// an unencrypted SQLite file on disk; SecureStore uses the OS keystore
// (iOS Keychain / Android EncryptedSharedPreferences) which is encrypted at
// rest and backed by hardware on modern devices.
// Web has no SecureStore — localStorage is acceptable there (dev/preview only;
// real production sessions go through native).
const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return (globalThis as any).localStorage?.getItem(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      (globalThis as any).localStorage?.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      (globalThis as any).localStorage?.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: secureStorage,

      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

// Supabase's autoRefreshToken option (set above) only queues the refresh
// timer — on native it needs to be told when the app is actually in the
// foreground or the refresh loop doesn't reliably run/pause, which is what
// made sessions appear to "not persist" (silently expiring while
// backgrounded, or failing to resume cleanly on return). This is the
// pattern Supabase's own React Native docs prescribe:
// https://supabase.com/docs/guides/auth/quickstarts/react-native
// Web already gets this for free from the browser's tab-visibility
// handling, so it's skipped there. Must only be registered once per app
// lifetime — this module only ever runs once since ES modules are cached.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}