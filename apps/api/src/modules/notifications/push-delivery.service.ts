import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseRepository } from '../../database/supabase.repository';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  EXPO_PUSH_URL,
  KIND_PREFERENCE,
  NOTIFICATION_KIND,
  type NotificationKind,
  type PreferenceKey,
} from './notification.constants';

export interface PushContent {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushSendResult {
  sent: boolean;
  reason?: 'preference_off' | 'no_tokens' | 'already_sent' | 'expo_error';
  ticketCount?: number;
}

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(private readonly repository: SupabaseRepository) {}

  async registerToken(
    userId: string,
    input: { token: string; platform: 'ios' | 'android' | 'web'; device_id?: string },
  ): Promise<{ token: string; platform: string }> {
    const saved = await this.repository.upsertPushToken({
      id: uuidv4(),
      user_id: userId,
      token: input.token,
      platform: input.platform,
      device_id: input.device_id ?? null,
    });
    if (!saved) {
      throw new Error('Failed to register push token');
    }
    return { token: saved.token, platform: saved.platform };
  }

  async unregisterToken(userId: string, token: string): Promise<{ removed: boolean }> {
    const removed = await this.repository.deletePushToken(userId, token);
    return { removed };
  }

  /**
   * Preference-gated, idempotent Expo push. Returns without throwing on
   * delivery failures so event hooks (rollover / realloc) never fail the
   * primary money path because Expo was briefly unreachable.
   */
  async sendIfAllowed(
    userId: string,
    kind: NotificationKind,
    dedupeKey: string,
    content: PushContent,
  ): Promise<PushSendResult> {
    const allowed = await this.isPreferenceEnabled(userId, KIND_PREFERENCE[kind]);
    if (!allowed) {
      return { sent: false, reason: 'preference_off' };
    }

    const claimed = await this.repository.tryClaimNotificationDelivery({
      id: uuidv4(),
      user_id: userId,
      kind,
      dedupe_key: dedupeKey,
      title: content.title,
      body: content.body,
      data: content.data ?? {},
    });
    if (!claimed) {
      return { sent: false, reason: 'already_sent' };
    }

    const tokens = await this.repository.getPushTokensByUserId(userId);
    if (tokens.length === 0) {
      // No device yet — release the claim so a later registration + event
      // (or scheduler retry) can still deliver. Local notifications cover
      // the foreground path on the client.
      await this.repository.deleteNotificationDelivery(userId, kind, dedupeKey);
      return { sent: false, reason: 'no_tokens' };
    }

    try {
      const ticketCount = await this.dispatchExpo(
        tokens.map((t) => t.token),
        content,
      );
      if (ticketCount === 0) {
        // Expo accepted the HTTP call but produced no ok tickets (e.g. all
        // DeviceNotRegistered). Release so a future token can retry.
        await this.repository.deleteNotificationDelivery(userId, kind, dedupeKey);
        return { sent: false, reason: 'expo_error', ticketCount: 0 };
      }
      return { sent: true, ticketCount };
    } catch (err) {
      this.logger.warn(
        `Expo push failed for user=${userId} kind=${kind}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Release the claim so cron / a later event can retry after transient
      // Expo outages — claim-before-send must not permanently drop events.
      await this.repository.deleteNotificationDelivery(userId, kind, dedupeKey);
      return { sent: false, reason: 'expo_error' };
    }
  }

  async notifyStreakMilestone(
    userId: string,
    days: number,
    awardedOnIso = new Date().toISOString().slice(0, 10),
  ): Promise<PushSendResult> {
    // Dedupe includes the award date so a future streak reset that re-hits
    // the same milestone can notify again (scoring may still lifetime-gate).
    return this.sendIfAllowed(
      userId,
      NOTIFICATION_KIND.STREAK_MILESTONE,
      `milestone:${days}:${awardedOnIso}`,
      {
        title: `${days}-day streak!`,
        body: `You stayed under your daily caps for ${days} days. Keep it going.`,
        data: { kind: NOTIFICATION_KIND.STREAK_MILESTONE, days, screen: '/(tabs)/insights' },
      },
    );
  }

  async notifyRolloverSuccess(userId: string, dateIso: string, amount: number): Promise<PushSendResult> {
    const formatted = Math.round(amount).toLocaleString('en-KE');
    return this.sendIfAllowed(userId, NOTIFICATION_KIND.ROLLOVER_SUCCESS, `rollover:${dateIso}`, {
      title: 'Daily rollover complete',
      body: `KSh ${formatted} moved into Savings from yesterday's unspent budget.`,
      data: { kind: NOTIFICATION_KIND.ROLLOVER_SUCCESS, amount, date: dateIso, screen: '/(tabs)' },
    });
  }

  async notifyCoolingOffReady(
    userId: string,
    reallocationId: string,
    amount: number,
  ): Promise<PushSendResult> {
    const formatted = Math.round(amount).toLocaleString('en-KE');
    return this.sendIfAllowed(
      userId,
      NOTIFICATION_KIND.COOLING_OFF_READY,
      `cooling_off:${reallocationId}`,
      {
        title: 'Cooling-off ended',
        body: `Your KSh ${formatted} reallocation is ready to complete.`,
        data: {
          kind: NOTIFICATION_KIND.COOLING_OFF_READY,
          reallocationId,
          screen: '/(modals)/realloc-cooloff',
        },
      },
    );
  }

  async notifyReallocationConfirm(
    userId: string,
    reallocationId: string,
    amount: number,
    fromName: string,
    toName: string,
  ): Promise<PushSendResult> {
    const formatted = Math.round(amount).toLocaleString('en-KE');
    return this.sendIfAllowed(
      userId,
      NOTIFICATION_KIND.REALLOCATION_CONFIRM,
      `realloc_done:${reallocationId}`,
      {
        title: 'Money moved',
        body: `KSh ${formatted} moved from ${fromName} to ${toName}.`,
        data: {
          kind: NOTIFICATION_KIND.REALLOCATION_CONFIRM,
          reallocationId,
          screen: '/(tabs)',
        },
      },
    );
  }

  async notifyStreakAtRisk(userId: string, currentStreak: number, dateIso: string): Promise<PushSendResult> {
    return this.sendIfAllowed(userId, NOTIFICATION_KIND.STREAK_AT_RISK, `streak_risk:${dateIso}`, {
      title: 'Streak at risk',
      body:
        currentStreak > 0
          ? `Log a spend under budget today to keep your ${currentStreak}-day streak alive.`
          : 'Log a spend under budget today to start a streak.',
      data: { kind: NOTIFICATION_KIND.STREAK_AT_RISK, currentStreak, screen: '/(tabs)' },
    });
  }

  async notifyMonthlyInsight(userId: string, period: string, score: number): Promise<PushSendResult> {
    return this.sendIfAllowed(userId, NOTIFICATION_KIND.MONTHLY_INSIGHT, `monthly:${period}`, {
      title: 'Your monthly insights are ready',
      body: `Your current discipline score is ${score}. Open Insights for the full picture.`,
      data: { kind: NOTIFICATION_KIND.MONTHLY_INSIGHT, period, screen: '/(tabs)/insights' },
    });
  }

  async notifyAllocationReceived(
    userId: string,
    incomeEventId: string,
    amount: number,
    pocketCount: number,
  ): Promise<PushSendResult> {
    const formatted = Math.round(amount).toLocaleString('en-KE');
    return this.sendIfAllowed(
      userId,
      NOTIFICATION_KIND.ALLOCATION_RECEIVED,
      `allocation:${incomeEventId}`,
      {
        title: 'Income allocated',
        body: `KSh ${formatted} split across ${pocketCount} pocket${pocketCount === 1 ? '' : 's'}.`,
        data: {
          kind: NOTIFICATION_KIND.ALLOCATION_RECEIVED,
          amount,
          pocketCount,
          screen: '/(tabs)',
        },
      },
    );
  }

  async isPreferenceEnabled(userId: string, key: PreferenceKey): Promise<boolean> {
    const prefs = await this.repository.getNotificationPreferencesByUserId(userId);
    if (!prefs) {
      return DEFAULT_NOTIFICATION_PREFERENCES[key];
    }
    return Boolean(prefs[key]);
  }

  /**
   * Exposed for the scheduler: users who opted into a preference and have
   * at least one registered push token.
   */
  async listUserIdsWithPreferenceAndTokens(key: PreferenceKey): Promise<string[]> {
    const withTokens = await this.repository.listUserIdsWithPushTokens();
    if (withTokens.length === 0) return [];

    const enabled: string[] = [];
    for (const userId of withTokens) {
      if (await this.isPreferenceEnabled(userId, key)) {
        enabled.push(userId);
      }
    }
    return enabled;
  }

  private async dispatchExpo(tokens: string[], content: PushContent): Promise<number> {
    const messages = tokens.map((to) => ({
      to,
      sound: 'default' as const,
      title: content.title,
      body: content.body,
      data: content.data ?? {},
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Expo HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ status: string; message?: string; details?: { error?: string } }>;
    };

    const tickets = payload.data ?? [];
    const invalidTokens: string[] = [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(tokens[index]);
      }
    });

    for (const token of invalidTokens) {
      await this.repository.deletePushTokenByValue(token);
    }

    return tickets.filter((t) => t.status === 'ok').length;
  }
}
