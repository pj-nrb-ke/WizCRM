import type { LastCallLead } from './call-return';

export function isLastCallStale(atIso: string, nowMs: number, maxAgeMs: number) {
  const at = new Date(atIso).getTime();
  if (Number.isNaN(at)) return true;
  return nowMs - at > maxAgeMs;
}

export function parseLastCallLead(raw: string | null): LastCallLead | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastCallLead;
    if (!parsed.leadId || !parsed.at) return null;
    return parsed;
  } catch {
    return null;
  }
}
