import * as SecureStore from 'expo-secure-store';

const KEY = 'wizcrm_last_call_lead';

export type LastCallLead = { leadId: string; leadName: string; at: string };

export async function markCallStarted(leadId: string, leadName: string) {
  const payload: LastCallLead = { leadId, leadName, at: new Date().toISOString() };
  await SecureStore.setItemAsync(KEY, JSON.stringify(payload));
}

export async function peekLastCallLead(maxAgeMs = 2 * 60 * 60 * 1000): Promise<LastCallLead | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastCallLead;
    if (!parsed.leadId || !parsed.at) return null;
    if (Date.now() - new Date(parsed.at).getTime() > maxAgeMs) {
      await clearLastCallLead();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLastCallLead() {
  await SecureStore.deleteItemAsync(KEY);
}
