import { api } from './api';

export type CrmConfig = {
  leadSources: string[];
  leadTags?: string[];
  lossReasons: { code: string; label: string }[];
  staleLeadDays?: number;
};

export async function fetchCrmConfig(): Promise<CrmConfig | null> {
  try {
    return await api<CrmConfig>('/leads/crm-config');
  } catch {
    return null;
  }
}
