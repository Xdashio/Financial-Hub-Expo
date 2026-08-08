import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - database features will not work');
}

// createClient throws synchronously if the URL is empty/invalid, which would
// crash the whole process at import time (before Nest even boots) whenever
// env vars aren't configured yet. Fall back to a harmless placeholder URL so
// the app can still start; requests that hit Supabase will simply fail until
// real credentials are provided.
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export function getSupabaseClient(): SupabaseClient {
  return supabase;
}