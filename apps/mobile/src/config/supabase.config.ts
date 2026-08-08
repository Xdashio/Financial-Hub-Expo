import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

// Keep this untyped to avoid ESM type-import issues under node16/CommonJS
let asyncStoragePromise: Promise<any> | null = null;

function getAsyncStorage() {
  if (!asyncStoragePromise) {
    asyncStoragePromise = import(
      '@react-native-async-storage/async-storage'
    ).then((mod) => mod.default);
  }

  return asyncStoragePromise;
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return (globalThis as any).localStorage?.getItem(key) ?? null;
    }

    const AsyncStorage = await getAsyncStorage();
    return AsyncStorage.getItem(key);
  },

  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      (globalThis as any).localStorage?.setItem(key, value);
      return;
    }

    const AsyncStorage = await getAsyncStorage();
    await AsyncStorage.setItem(key, value);
  },

  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      (globalThis as any).localStorage?.removeItem(key);
      return;
    }

    const AsyncStorage = await getAsyncStorage();
    await AsyncStorage.removeItem(key);
  },
},

      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}