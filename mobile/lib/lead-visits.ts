import { api } from './api';

export type LeadVisit = {
  id: string;
  visitNumber: number;
  occurredAt: string;
  checkInLat: number | null;
  checkInLng: number | null;
  hasReport: boolean;
  outcome: string | null;
  whoMet: string | null;
  nextStep: string | null;
  user: { id: string; name: string; email: string };
  _count: { attachments: number };
};

export async function listVisits(leadId: string): Promise<LeadVisit[]> {
  const { visits } = await api<{ visits: LeadVisit[] }>(`/leads/${leadId}/visits`);
  return visits;
}

export async function logVisit(
  leadId: string,
  coords?: { checkInLat: number; checkInLng: number },
): Promise<LeadVisit> {
  const { visit } = await api<{ visit: LeadVisit }>(`/leads/${leadId}/visits`, {
    method: 'POST',
    body: coords ?? {},
  });
  return visit;
}
