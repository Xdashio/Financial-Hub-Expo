import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import { useDataSync } from '@/services/data-sync';

/**
 * Minimal offline write queue for money-moving POSTs that fail on a dropped
 * connection. Not a full local-first sync layer (SQLite) — just retries
 * spend/income once connectivity returns, using the same idempotency keys
 * the API now accepts so a successful retry cannot double-write.
 */

const QUEUE_KEY = 'fh_offline_write_queue_v1';
const MAX_ITEMS = 25;

/** Headers that must never be persisted in AsyncStorage (audit H7). */
const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-access-token',
  'x-refresh-token',
]);

export type QueuedWrite = {
  id: string;
  endpoint:
    | '/spend/commit'
    | '/income/manual'
    | '/msme/invoices'
    | '/msme/invoices/:id/pay'
    | '/msme/stock'
    | '/msme/stock/:id/movements'
    | string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
  createdAt: string;
  attempts: number;
};

function sanitizeHeaders(
  headers?: Record<string, string>,
): Record<string, string> | undefined {
  if (!headers) return undefined;
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) continue;
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedWrite[]): Promise<void> {
  // Keep the newest money writes when over capacity (audit H8) — dropping
  // the oldest is preferable to silently losing the user's latest spend/income.
  const trimmed = items.length > MAX_ITEMS ? items.slice(-MAX_ITEMS) : items;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

export async function enqueueWrite(
  endpoint: QueuedWrite['endpoint'],
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<void> {
  const items = await readQueue();
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    endpoint,
    body,
    headers: sanitizeHeaders(headers),
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(items);
}

export async function flushWriteQueue(): Promise<{ flushed: number; remaining: number }> {
  const items = await readQueue();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  const remaining: QueuedWrite[] = [];
  let flushed = 0;

  for (const item of items) {
    try {
      // Only replay non-auth headers (e.g. Idempotency-Key). api.post always
      // attaches a fresh Authorization from the live session (audit H7).
      const safeHeaders = sanitizeHeaders(item.headers);
      if (safeHeaders && Object.keys(safeHeaders).length > 0) {
        await api.post(item.endpoint, item.body, safeHeaders as any);
      } else {
        await api.post(item.endpoint, item.body);
      }
      flushed += 1;
    } catch (err: any) {
      const status = err?.status;
      // Do not retry permanent 4xx client validation errors
      if (status && status >= 400 && status < 500) {
        continue;
      }
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await writeQueue(remaining.filter((i) => i.attempts < 5));
  if (flushed > 0) {
    useDataSync.getState().bump();
  }
  return { flushed, remaining: remaining.length };
}
