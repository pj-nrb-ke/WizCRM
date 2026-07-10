import { createHash } from 'node:crypto';

/**
 * Rendered speech, held in memory until Africa's Talking has fetched it.
 *
 * AT plays audio by URL, so every line Jane speaks must be reachable over HTTP
 * for a few seconds. Keyed by a hash of the text, so the greeting and the stock
 * apologies are synthesised once and replayed for every subsequent call — those
 * are the lines a caller hears first, and the ones we cannot afford to stall on.
 */
type Entry = { audio: Buffer; expiresAt: number };

const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 200;

const store = new Map<string, Entry>();

function prune(now: number): void {
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
  // Under sustained load, drop the oldest rather than grow without bound.
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

export function audioIdFor(text: string, voice: string): string {
  return createHash('sha256').update(`${voice}:${text}`).digest('hex').slice(0, 32);
}

export function hasAudio(id: string): boolean {
  const entry = store.get(id);
  return !!entry && entry.expiresAt > Date.now();
}

export function putAudio(id: string, audio: Buffer): void {
  const now = Date.now();
  prune(now);
  store.set(id, { audio, expiresAt: now + TTL_MS });
}

export function getAudio(id: string): Buffer | null {
  const entry = store.get(id);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  // Refresh on read: a long call should not lose its greeting mid-conversation.
  entry.expiresAt = Date.now() + TTL_MS;
  return entry.audio;
}

/** Test seam. */
export function clearAudio(): void {
  store.clear();
}
