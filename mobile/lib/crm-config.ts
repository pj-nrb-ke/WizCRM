import { api } from './api';

export type CrmConfig = {
  leadSources: string[];
  lossReasons: { code: string; label: string }[];
};

export async function fetchCrmConfig(): Promise<CrmConfig | null> {
  try {
    return await api<CrmConfig>('/leads/crm-config');
  } catch {
    return null;
  }
}
