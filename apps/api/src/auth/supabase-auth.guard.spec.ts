import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

jest.mock('../config/supabase.config', () => ({
  getSupabaseClient: jest.fn(),
}));

import { getSupabaseClient } from '../config/supabase.config';

describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let getUser: jest.Mock;

  const makeContext = (authorization?: string) => {
    const request: { headers: Record<string, string | undefined>; user?: unknown } = {
      headers: { authorization },
    };
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    getUser = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({
      auth: { getUser },
    });
    guard = new SupabaseAuthGuard(reflector as unknown as Reflector);
  });

  it('allows @Public() routes without inspecting the Authorization header', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = makeContext(undefined);

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it('rejects missing Authorization header', async () => {
    const ctx = makeContext(undefined);
    await expect(guard.canActivate(ctx as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects non-Bearer Authorization schemes', async () => {
    const ctx = makeContext('Basic abc');
    await expect(guard.canActivate(ctx as any)).rejects.toThrow(/Missing or invalid authorization header/);
  });

  it('rejects when Supabase getUser returns an error', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    const ctx = makeContext('Bearer bad-token');

    await expect(guard.canActivate(ctx as any)).rejects.toThrow(/Invalid or expired token/);
    expect(getUser).toHaveBeenCalledWith('bad-token');
  });

  it('rejects when Supabase returns no user', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const ctx = makeContext('Bearer orphan-token');

    await expect(guard.canActivate(ctx as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the authenticated user to the request on success', async () => {
    const user = { id: 'user-1', email: 'a@b.co' };
    getUser.mockResolvedValue({ data: { user }, error: null });
    const ctx = makeContext('Bearer good-token');

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect(ctx.request.user).toEqual(user);
    expect(getUser).toHaveBeenCalledWith('good-token');
  });
});
