import { parseEnv } from './env.validation';

const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3000',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  JWT_SECRET: 'test-secret-that-is-long-enough-32-chars',
};

describe('parseEnv (M14)', () => {
  it('accepts a complete valid environment', () => {
    const env = parseEnv({ ...BASE_ENV });
    expect(env.SUPABASE_URL).toBe('http://localhost:54321');
    expect(env.PORT).toBe(3000);
    expect(env.JWT_EXPIRES_IN).toBe('7d');
  });

  it('rejects a missing SUPABASE_URL with a clear message', () => {
    const { SUPABASE_URL: _dropped, ...rest } = BASE_ENV;
    expect(() => parseEnv(rest)).toThrow(/SUPABASE_URL/);
  });

  it('rejects a missing SUPABASE_SERVICE_ROLE_KEY', () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _dropped, ...rest } = BASE_ENV;
    expect(() => parseEnv(rest)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejects a short JWT_SECRET', () => {
    expect(() => parseEnv({ ...BASE_ENV, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('rejects a malformed SUPABASE_URL', () => {
    expect(() => parseEnv({ ...BASE_ENV, SUPABASE_URL: 'not-a-url' })).toThrow(/SUPABASE_URL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => parseEnv({ ...BASE_ENV, PORT: '99999' })).toThrow(/PORT/);
  });

  it('applies defaults for optional values', () => {
    const env = parseEnv({ ...BASE_ENV });
    expect(env.NODE_ENV).toBe('test');
    expect(env.JWT_EXPIRES_IN).toBe('7d');
  });
});
