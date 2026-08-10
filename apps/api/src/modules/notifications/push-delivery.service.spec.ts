import { PushDeliveryService } from './push-delivery.service';
import type { SupabaseRepository } from '../../database/supabase.repository';
import { NOTIFICATION_KIND } from './notification.constants';

describe('PushDeliveryService', () => {
  let repository: any;
  let service: PushDeliveryService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    repository = {
      getNotificationPreferencesByUserId: jest.fn().mockResolvedValue(null),
      tryClaimNotificationDelivery: jest.fn().mockResolvedValue(true),
      getPushTokensByUserId: jest.fn().mockResolvedValue([
        { token: 'ExponentPushToken[abc]', user_id: 'user-1' },
      ]),
      upsertPushToken: jest.fn().mockImplementation(async (row: any) => row),
      deletePushToken: jest.fn().mockResolvedValue(true),
      deletePushTokenByValue: jest.fn().mockResolvedValue(undefined),
      deleteNotificationDelivery: jest.fn().mockResolvedValue(undefined),
      listUserIdsWithPushTokens: jest.fn().mockResolvedValue(['user-1']),
    };
    service = new PushDeliveryService(repository as unknown as SupabaseRepository);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    }) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('registers a push token', async () => {
    const result = await service.registerToken('user-1', {
      token: 'ExponentPushToken[abc]',
      platform: 'android',
    });
    expect(result.token).toBe('ExponentPushToken[abc]');
    expect(repository.upsertPushToken).toHaveBeenCalled();
  });

  it('skips send when preference defaults to off (tips_nudges)', async () => {
    const result = await service.sendIfAllowed(
      'user-1',
      NOTIFICATION_KIND.STREAK_AT_RISK,
      'streak_risk:2026-08-10',
      { title: 't', body: 'b' },
    );
    expect(result).toEqual({ sent: false, reason: 'preference_off' });
    expect(repository.tryClaimNotificationDelivery).not.toHaveBeenCalled();
  });

  it('skips send when preference is explicitly off', async () => {
    repository.getNotificationPreferencesByUserId.mockResolvedValue({
      savings_milestones: false,
    });
    const result = await service.notifyStreakMilestone('user-1', 7);
    expect(result).toEqual({ sent: false, reason: 'preference_off' });
  });

  it('dedupes via claim failure', async () => {
    repository.tryClaimNotificationDelivery.mockResolvedValue(false);
    const result = await service.notifyStreakMilestone('user-1', 7);
    expect(result).toEqual({ sent: false, reason: 'already_sent' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns no_tokens when claim succeeds but no devices are registered', async () => {
    repository.getPushTokensByUserId.mockResolvedValue([]);
    const result = await service.notifyStreakMilestone('user-1', 7);
    expect(result).toEqual({ sent: false, reason: 'no_tokens' });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(repository.deleteNotificationDelivery).toHaveBeenCalled();
  });

  it('releases the claim when Expo returns no ok tickets', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    });
    const result = await service.notifyStreakMilestone('user-1', 7);
    expect(result.sent).toBe(false);
    expect(repository.deleteNotificationDelivery).toHaveBeenCalled();
    expect(repository.deletePushTokenByValue).toHaveBeenCalledWith('ExponentPushToken[abc]');
  });

  it('releases the claim when Expo HTTP fails so retries remain possible', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    });
    const result = await service.notifyStreakMilestone('user-1', 7);
    expect(result).toEqual({ sent: false, reason: 'expo_error' });
    expect(repository.deleteNotificationDelivery).toHaveBeenCalled();
  });

  it('dispatches to Expo and reports sent', async () => {
    const result = await service.notifyStreakMilestone('user-1', 7);
    expect(result.sent).toBe(true);
    expect(result.ticketCount).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('exp.host'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(repository.deleteNotificationDelivery).not.toHaveBeenCalled();
  });
});
