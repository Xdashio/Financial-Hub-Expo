import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// IMPORTANT: this client must be created lazily, not at module-import time.
// `main.ts` statically imports AppModule, which transitively imports this
// file — and that whole import graph resolves BEFORE NestFactory.create()
// runs, which is what actually triggers ConfigModule to load .env.local
// into process.env. If we called createClient() at the top level here,
// process.env.SUPABASE_URL would still be empty at that point, so it would
// fall back to the placeholder project and get permanently cached — even
// though .env.local has the correct values, they'd just be read too late.
// Creating the client on first real use (inside getSupabaseClient(), called
// from request-time code like guards/services) sidesteps this: by then,
// Nest has already finished bootstrapping and process.env is fully loaded.
let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY - database features will not work');
  }

  // createClient throws synchronously if the URL is empty/invalid. Fall
  // back to a harmless placeholder so a single bad call site can't crash
  // the process; it'll just keep failing auth/DB calls until real
  // credentials are present in process.env.
  //
  // Pass `ws` as the realtime transport: Node < 22 has no global WebSocket
  // and @supabase/supabase-js 2.112+ throws at client construction otherwise.
  cachedClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transport: ws as any,
      },
    },
  );

  return cachedClient;
}

// Backwards-compatible named export for any code still importing `supabase`
// directly. Uses a Proxy so it also defers to first real use rather than
// constructing eagerly at import time.
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  },
});