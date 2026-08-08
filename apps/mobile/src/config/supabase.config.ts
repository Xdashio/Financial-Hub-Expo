import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Both values are inlined into the bundle at build time, so they must come
// from the environment (see .env.example) rather than being committed here —
// a checked-in project URL/key ties every build to one project and can only be
// rotated by shipping a new release.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to apps/mobile/.env and fill in your Supabase project values.'
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        if (Platform.OS === 'web') {
          return (globalThis as any).localStorage?.getItem(key) ?? null;
        }
        return await SecureStore.getItemAsync(key);
      },
      setItem: async (key: string, value: string) => {
        if (Platform.OS === 'web') {
          (globalThis as any).localStorage?.setItem(key, value);
        } else {
          await SecureStore.setItemAsync(key, value);
        }
      },
      removeItem: async (key: string) => {
        if (Platform.OS === 'web') {
          (globalThis as any).localStorage?.removeItem(key);
        } else {
          await SecureStore.deleteItemAsync(key);
        }
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}