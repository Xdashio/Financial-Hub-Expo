import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fnepvrapnzbaqyuoayue.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZXB2cmFwbnpiYXF5dW9heXVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMDc1MDQsImV4cCI6MjEwMTY4MzUwNH0.pKruTZ6kmYmVEVTjnOEz7SPY4jKhIlJuRO1LOwQm0PE';

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