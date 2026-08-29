import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';

/**
 * Minimal offline write queue for money-moving POSTs that fail on a dropped
 * connection. Not a full local-first sync layer (SQLite) — just retries
 * spend/income once connectivity returns, using the same idempotency keys
 * the API now accepts so a successful retry cannot double-write.
 */

const QUEUE_KEY = 'fh_offline_write_queue_v1';
const MAX_ITEMS = 25;

export type QueuedWrite = {
  id: string;
  endpoint: '/spend/commit' | '/income/manual' | string;
  body: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

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
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export async function enqueueWrite(
  endpoint: QueuedWrite['endpoint'],
  body: Record<string, unknown>,
): Promise<void> {
  const items = await readQueue();
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    endpoint,
    body,
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
      await api.post(item.endpoint, item.body);
      flushed += 1;
    } catch {
      remaining.push({ ...item, attempts: item.attempts + 1 });
    }
  }

  await writeQueue(remaining.filter((i) => i.attempts < 5));
  return { flushed, remaining: remaining.length };
}
