import * as FileSystem from 'expo-file-system/legacy';
import type { Lead } from './api';

const FILE = `${FileSystem.documentDirectory}leads-cache.json`;

export async function saveLeadsCache(leads: Lead[]): Promise<void> {
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify({ savedAt: new Date().toISOString(), leads }));
}

export async function loadLeadsCache(): Promise<{ savedAt: string; leads: Lead[] } | null> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed = JSON.parse(raw) as { savedAt?: string; leads?: Lead[] };
    if (!parsed.leads?.length) return null;
    return { savedAt: parsed.savedAt ?? '', leads: parsed.leads };
  } catch {
    return null;
  }
}

export type LeadDetailCache = {
  savedAt: string;
  lead: Lead;
  tasks: { id: string; title: string; dueAt: string | null; completedAt: string | null }[];
  activities: { id: string; type: string; subject?: string | null; body: string; createdAt: string; user?: { name: string } }[];
  stageChanges: { id: string; fromStage: string; toStage: string; note: string | null; createdAt: string; user: { name: string } }[];
};

function detailFile(leadId: string) {
  return `${FileSystem.documentDirectory}lead-detail-${leadId}.json`;
}

export async function saveLeadDetailCache(leadId: string, payload: LeadDetailCache): Promise<void> {
  await FileSystem.writeAsStringAsync(detailFile(leadId), JSON.stringify(payload));
}

export async function loadLeadDetailCache(leadId: string): Promise<LeadDetailCache | null> {
  try {
    const path = detailFile(leadId);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as LeadDetailCache;
  } catch {
    return null;
  }
}
