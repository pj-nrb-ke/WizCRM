import * as SecureStore from 'expo-secure-store';
import { isLastCallStale, parseLastCallLead } from './call-return-logic';

const KEY = 'wizcrm_last_call_lead';

export type LastCallLead = { leadId: string; leadName: string; at: string };

export async function markCallStarted(leadId: string, leadName: string) {
  const payload: LastCallLead = { leadId, leadName, at: new Date().toISOString() };
  await SecureStore.setItemAsync(KEY, JSON.stringify(payload));
}

export async function peekLastCallLead(maxAgeMs = 2 * 60 * 60 * 1000): Promise<LastCallLead | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  const parsed = parseLastCallLead(raw);
  if (!parsed) return null;
  if (isLastCallStale(parsed.at, Date.now(), maxAgeMs)) {
    await clearLastCallLead();
    return null;
  }
  return parsed;
}

export async function clearLastCallLead() {
  await SecureStore.deleteItemAsync(KEY);
}
