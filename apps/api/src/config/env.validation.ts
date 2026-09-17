import { z } from 'zod';

/**
 * Environment validation (M14). Parsed once at the top of `bootstrap()` in
 * main.ts so a misconfigured container fails fast with a readable message
 * instead of dying later with a cryptic Supabase/JWT error (or worse,
 * running half-configured).
 *
 * Pinned to zod v3 — the same major as @financial-hub/shared — so the two
 * never disagree on the validation API (see M11).
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  SUPABASE_URL: z
    .string({ required_error: 'SUPABASE_URL is required (Supabase project URL)' })
    .min(1, 'SUPABASE_URL must not be empty')
    .url('SUPABASE_URL must be a valid URL, e.g. https://xyzcompany.supabase.co'),
  SUPABASE_ANON_KEY: z
    .string({ required_error: 'SUPABASE_ANON_KEY is required' })
    .min(1, 'SUPABASE_ANON_KEY must not be empty'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ required_error: 'SUPABASE_SERVICE_ROLE_KEY is required (server key, never the anon key)' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY must not be empty'),

  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters — generate one with: openssl rand -base64 32'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').optional().or(z.literal('')),
  CORS_ORIGINS: z.string().optional(),
  ENABLE_SWAGGER: z.enum(['true', 'false']).optional(),
  SENTRY_DSN: z.string().url('SENTRY_DSN must be a valid URL').optional().or(z.literal('')),
  RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
  RAILWAY_STATIC_URL: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/** Pure parse — takes an explicit record so tests can pass fixtures. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  return EnvSchema.parse(raw);
}

/**
 * Validate `process.env` and fail fast with a clear, actionable message.
 * Called first in `bootstrap()`; exits non-zero on misconfiguration so a
 * bad container never starts serving (or hanging on a healthcheck).
 */
export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (result.success) return result.data;

  const details = result.error.issues
    .map((issue: z.ZodIssue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`[config] Invalid environment — refusing to boot:\n${details}`);
  process.exit(1);
}
