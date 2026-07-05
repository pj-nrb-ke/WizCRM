import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';

export type OfflineMutation =
  | {
      id: string;
      type: 'NOTE' | 'ACTIVITY';
      leadId: string;
      createdAt: string;
      payload: { activityType: 'NOTE' | 'CALL' | 'EMAIL' | 'MEETING'; body: string; subject?: string };
    }
  | {
      id: string;
      type: 'LEAD_PATCH';
      leadId: string;
      createdAt: string;
      payload: Record<string, unknown>;
    }
  | {
      id: string;
      type: 'TASK_CREATE';
      leadId: string;
      createdAt: string;
      payload: { title: string; dueAt?: string };
    }
  | {
      id: string;
      type: 'VISIT_REPORT';
      leadId: string;
      createdAt: string;
      payload: {
        outcome: string;
        notes?: string;
        whoMet?: string;
        competitor?: string;
        objection?: string;
        nextStep?: string;
        nextStepDueAt?: string;
        location?: { lat: number; lng: number; label?: string };
        capturedAt?: string;
      };
    };

const FILE = `${FileSystem.documentDirectory}offline-queue.json`;
const LEGACY_NOTES = `${FileSystem.documentDirectory}offline-notes.json`;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readAll(): Promise<OfflineMutation[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) {
      await migrateLegacyNotes();
      const again = await FileSystem.getInfoAsync(FILE);
      if (!again.exists) return [];
    }
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed = JSON.parse(raw) as OfflineMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: OfflineMutation[]) {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(items));
}

/** Import old offline-notes.json into unified queue once. */
async function migrateLegacyNotes() {
  try {
    const info = await FileSystem.getInfoAsync(LEGACY_NOTES);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(LEGACY_NOTES);
    const parsed = JSON.parse(raw) as { id: string; leadId: string; body: string; createdAt: string }[];
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    const items: OfflineMutation[] = parsed.map((n) => ({
      id: n.id || newId(),
      type: 'NOTE',
      leadId: n.leadId,
      createdAt: n.createdAt,
      payload: { activityType: 'NOTE', body: n.body },
    }));
    await writeAll(items);
    await FileSystem.deleteAsync(LEGACY_NOTES, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export function isOfflineError(msg: string) {
  return (
    msg.includes('Cannot reach') ||
    msg.includes('Network request failed') ||
    msg.includes('timed out') ||
    msg.includes('Failed to fetch')
  );
}

export async function queueOfflineMutation(mutation: Omit<OfflineMutation, 'id' | 'createdAt'> & { id?: string }) {
  const items = await readAll();
  items.push({
    ...mutation,
    id: mutation.id ?? newId(),
    createdAt: new Date().toISOString(),
  } as OfflineMutation);
  await writeAll(items);
}

export async function listPendingMutations(): Promise<OfflineMutation[]> {
  return readAll();
}

export async function pendingMutationCount(): Promise<number> {
  return (await readAll()).length;
}

async function replayOne(item: OfflineMutation): Promise<void> {
  switch (item.type) {
    case 'NOTE':
    case 'ACTIVITY':
      await api(`/leads/${item.leadId}/activities`, {
        method: 'POST',
        body: {
          type: item.payload.activityType,
          body: item.payload.body,
          subject: item.payload.subject,
        },
      });
      break;
    case 'LEAD_PATCH':
      await api(`/leads/${item.leadId}`, {
        method: 'PATCH',
        body: item.payload,
      });
      break;
    case 'TASK_CREATE':
      await api('/tasks', {
        method: 'POST',
        body: {
          title: item.payload.title,
          dueAt: item.payload.dueAt,
          leadId: item.leadId,
        },
      });
      break;
    case 'VISIT_REPORT':
      await api(`/leads/${item.leadId}/visit-report`, {
        method: 'POST',
        body: item.payload,
      });
      break;
    default:
      break;
  }
}

export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const items = await readAll();
  if (items.length === 0) return { synced: 0, failed: 0 };
  const remaining: OfflineMutation[] = [];
  let synced = 0;
  let failed = 0;
  for (const item of items) {
    try {
      await replayOne(item);
      synced += 1;
    } catch {
      remaining.push(item);
      failed += 1;
    }
  }
  await writeAll(remaining);
  return { synced, failed };
}

/** @deprecated Use queueOfflineMutation with type NOTE */
export async function queueOfflineNote(leadId: string, body: string) {
  await queueOfflineMutation({
    type: 'NOTE',
    leadId,
    payload: { activityType: 'NOTE', body },
  });
}

/** @deprecated Use flushOfflineQueue */
export const flushOfflineNotes = flushOfflineQueue;
export const listPendingNotes = async () =>
  (await listPendingMutations()).filter((m) => m.type === 'NOTE' || m.type === 'ACTIVITY');
