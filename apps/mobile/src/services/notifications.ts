import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { notificationsApi, type NotificationPreferences } from '@/services/api';

/**
 * Batch 7 — Expo local + push notifications.
 *
 * SDK 53+ removed remote push from Expo Go. Calling push APIs there throws
 * and — because this module used to run `setNotificationHandler` at import
 * time — crashed route evaluation across the app (false "missing default
 * export" warnings + ErrorBoundary errors). Everything here is gated for
 * Expo Go / web and wrapped so a missing native module never takes down
 * the navigator.
 */

/** True inside the Expo Go client (StoreClient), where remote push is gone. */
export function isExpoGo(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo'
  );
}

type NotificationsModule = typeof import('expo-notifications');

let notificationsMod: NotificationsModule | null | undefined;
let handlerReady = false;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (notificationsMod !== undefined) return notificationsMod;
  try {
    // Dynamic import so a throw inside the package during load doesn't
    // fail every screen that transitively imports this file.
    notificationsMod = await import('expo-notifications');
    return notificationsMod;
  } catch {
    notificationsMod = null;
    return null;
  }
}

async function ensureHandler(Notifications: NotificationsModule): Promise<void> {
  if (handlerReady) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerReady = true;
  } catch {
    // Expo Go / missing native module — local present may still no-op.
  }
}

const ANDROID_CHANNEL_ID = 'financial-hub-default';
const PUSH_TOKEN_KEY = 'expo_push_token';

let cachedPrefs: NotificationPreferences | null = null;
let cachedPrefsAt = 0;
const PREFS_TTL_MS = 60_000;

function resolveProjectId(): string | null {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    null
  );
}

async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

async function setStoredPushToken(token: string | null): Promise<void> {
  try {
    if (token) await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    else await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch {
    // Best-effort cache.
  }
}

/**
 * Prefer remote push when a token is registered to avoid double banners
 * (server Expo + local) for the same event. Fall back to local otherwise.
 */
async function shouldPresentLocal(): Promise<boolean> {
  const token = await getStoredPushToken();
  return !token;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  try {
    await ensureHandler(Notifications);
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Financial Hub',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F6E56',
    });
  } catch {
    // Channel setup is best-effort.
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  try {
    await ensureAndroidChannel();
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function loadNotificationPreferences(
  force = false,
): Promise<NotificationPreferences | null> {
  if (!force && cachedPrefs && Date.now() - cachedPrefsAt < PREFS_TTL_MS) {
    return cachedPrefs;
  }
  try {
    const { preferences } = await notificationsApi.getSettings();
    cachedPrefs = preferences;
    cachedPrefsAt = Date.now();
    return preferences;
  } catch {
    return cachedPrefs;
  }
}

export function clearNotificationPreferencesCache(): void {
  cachedPrefs = null;
  cachedPrefsAt = 0;
}

async function preferenceAllows(
  key: keyof NotificationPreferences,
): Promise<boolean> {
  const prefs = await loadNotificationPreferences();
  if (!prefs) {
    return key === 'reallocation_confirms' ||
      key === 'cooling_off_reminders' ||
      key === 'savings_milestones';
  }
  return Boolean(prefs[key]);
}

async function presentLocal(input: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!(await shouldPresentLocal())) return null;
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  try {
    await ensureHandler(Notifications);
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        sound: true,
      },
      trigger: null,
    });
  } catch {
    return null;
  }
}

export async function showRolloverSuccess(amount: number): Promise<void> {
  if (amount <= 0) return;
  if (!(await preferenceAllows('savings_milestones'))) return;
  const formatted = Math.round(amount).toLocaleString('en-KE');
  await presentLocal({
    title: 'Daily rollover complete',
    body: `KSh ${formatted} moved into Savings from yesterday's unspent budget.`,
    data: { kind: 'rollover_success', screen: '/(tabs)' },
  });
}

export async function showMilestoneCelebration(days: number): Promise<void> {
  if (!(await preferenceAllows('savings_milestones'))) return;
  await presentLocal({
    title: `${days}-day streak!`,
    body: `You stayed under your daily caps for ${days} days. Keep it going.`,
    data: { kind: 'streak_milestone', days, screen: '/(tabs)/insights' },
  });
}

export async function showAllocationReceived(
  amount: number,
  pocketCount: number,
): Promise<void> {
  if (amount <= 0 || pocketCount <= 0) return;
  if (!(await preferenceAllows('savings_milestones'))) return;
  const formatted = Math.round(amount).toLocaleString('en-KE');
  await presentLocal({
    title: 'Income allocated',
    body: `KSh ${formatted} split across ${pocketCount} pocket${pocketCount === 1 ? '' : 's'}.`,
    data: { kind: 'allocation_received', screen: '/(tabs)' },
  });
}

export async function showReallocationConfirm(
  amount: number,
  fromName: string,
  toName: string,
): Promise<void> {
  if (!(await preferenceAllows('reallocation_confirms'))) return;
  const formatted = Math.round(amount).toLocaleString('en-KE');
  await presentLocal({
    title: 'Money moved',
    body: `KSh ${formatted} moved from ${fromName} to ${toName}.`,
    data: { kind: 'reallocation_confirm', screen: '/(tabs)' },
  });
}

/**
 * Schedule a local reminder for when cooling-off ends. Always schedules
 * locally (time-delayed); server cron covers background devices that
 * registered a push token.
 */
export async function scheduleCoolingOffReminder(
  reallocationId: string,
  endsAtIso: string,
  amount: number,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!(await preferenceAllows('cooling_off_reminders'))) return null;

  const endsAt = new Date(endsAtIso).getTime();
  const seconds = Math.max(1, Math.floor((endsAt - Date.now()) / 1000));
  if (!Number.isFinite(seconds) || seconds > 60 * 60 * 24) return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const formatted = Math.round(amount).toLocaleString('en-KE');
  try {
    await ensureHandler(Notifications);
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Cooling-off ended',
        body: `Your KSh ${formatted} reallocation is ready to complete.`,
        data: {
          kind: 'cooling_off_ready',
          reallocationId,
          screen: '/(modals)/realloc-cooloff',
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Remote push token registration. No-ops in Expo Go (SDK 53+ removed
 * Android remote push from the Go client — use a development build).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || isExpoGo()) return null;

  const granted = await requestNotificationPermissions();
  if (!granted) return null;

  const projectId = resolveProjectId();
  if (!projectId) {
    return null;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = push.data;
    await notificationsApi.registerPushToken({
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    await setStoredPushToken(token);
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushToken(token?: string | null): Promise<void> {
  const resolved = token ?? (await getStoredPushToken());
  if (!resolved) return;
  try {
    await notificationsApi.unregisterPushToken(resolved);
  } catch {
    // Best-effort on sign-out.
  } finally {
    await setStoredPushToken(null);
  }
}

/** Wire notification-tap navigation. Safe no-op in Expo Go / web. */
export async function subscribeNotificationResponses(
  onResponse: (data: unknown) => void,
): Promise<() => void> {
  if (Platform.OS === 'web' || isExpoGo()) {
    return () => {};
  }
  const Notifications = await getNotifications();
  if (!Notifications) return () => {};

  try {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      onResponse(response.notification.request.content.data);
    });
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) onResponse(response.notification.request.content.data);
      })
      .catch(() => {});
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
