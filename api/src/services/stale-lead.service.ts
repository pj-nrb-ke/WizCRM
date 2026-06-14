import { getOrgSettings } from './org-settings.service.js';

export const DEFAULT_STALE_LEAD_DAYS = 7;

export async function resolveStaleLeadDays(organizationId: string): Promise<number> {
  const settings = await getOrgSettings(organizationId);
  const days = settings.staleLeadDays;
  if (typeof days === 'number' && days >= 1 && days <= 90) return days;
  return DEFAULT_STALE_LEAD_DAYS;
}

export function isStaleLead(
  lastActivityAt: Date | null,
  createdAt: Date,
  staleDays = DEFAULT_STALE_LEAD_DAYS,
  now = new Date(),
): boolean {
  const ref = lastActivityAt ?? createdAt;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - staleDays);
  return ref < cutoff;
}
