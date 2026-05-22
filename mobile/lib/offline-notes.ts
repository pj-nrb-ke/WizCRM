import * as FileSystem from 'expo-file-system';
import { api } from './api';

export type PendingNote = {
  id: string;
  leadId: string;
  body: string;
  createdAt: string;
};

const FILE = `${FileSystem.documentDirectory}offline-notes.json`;

async function readAll(): Promise<PendingNote[]> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed = JSON.parse(raw) as PendingNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(notes: PendingNote[]) {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(notes));
}

export async function queueOfflineNote(leadId: string, body: string) {
  const notes = await readAll();
  notes.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    leadId,
    body,
    createdAt: new Date().toISOString(),
  });
  await writeAll(notes);
}

export async function listPendingNotes(): Promise<PendingNote[]> {
  return readAll();
}

export async function flushOfflineNotes(): Promise<{ synced: number; failed: number }> {
  const notes = await readAll();
  if (notes.length === 0) return { synced: 0, failed: 0 };
  const remaining: PendingNote[] = [];
  let synced = 0;
  let failed = 0;
  for (const note of notes) {
    try {
      await api(`/leads/${note.leadId}/activities`, {
        method: 'POST',
        body: { type: 'NOTE', body: note.body },
      });
      synced += 1;
    } catch {
      remaining.push(note);
      failed += 1;
    }
  }
  await writeAll(remaining);
  return { synced, failed };
}
