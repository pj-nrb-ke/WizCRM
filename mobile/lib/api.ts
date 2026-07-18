import * as SecureStore from 'expo-secure-store';
import { getApiUrl } from './api-url-file';
import { formatNetworkError } from './network-message';

const TOKEN_KEY = 'wizcrm_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  /** Abort request after this many ms (default 20s). */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const apiUrl = await getApiUrl();
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        `Request timed out (${timeoutMs / 1000}s). Is the API running at ${apiUrl}?`,
      );
    }
    if (e instanceof Error && e.message === 'Network request failed') {
      throw new Error(formatNetworkError(apiUrl));
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { error?: string; message?: string };
    const err = new Error(body.message ?? body.error ?? res.statusText) as Error & {
      status: number;
      data: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  organizationName?: string | null;
};

export type LeadOwner = {
  id: string;
  name: string;
  email: string;
  team?: { id: string; name: string } | null;
};

export type Lead = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  extraPhones?: string[] | null;
  extraEmails?: string[] | null;
  address?: string | null;
  googleMapsUrl?: string | null;
  source?: string | null;
  tags?: string[];
  priority?: string | null;
  stage: string;
  wonValue?: number | string | null;
  wonStartAt?: string | null;
  wonProducts?: string | null;
  lossReason?: string | null;
  lastActivityAt?: string | null;
  owner?: LeadOwner;
  activities?: {
    id: string;
    type: string;
    subject?: string | null;
    body: string;
    createdAt: string;
    user?: { name: string };
  }[];
  stageChanges?: {
    id: string;
    fromStage: string;
    toStage: string;
    note: string | null;
    createdAt: string;
    user: { name: string };
  }[];
};

export function leadContactLists(lead: Lead) {
  const extraPhones = Array.isArray(lead.extraPhones) ? lead.extraPhones : [];
  const extraEmails = Array.isArray(lead.extraEmails) ? lead.extraEmails : [];
  return { extraPhones, extraEmails };
}

export type LeadInsights = {
  priority: string | null;
  source: string | null;
  scores: { engagement: number; urgency: number; fit: number };
  hygiene: string[];
};

export type MemberStats = {
  openLeads: number;
  overdueTasks: number;
  staleLeads: number;
  wonLeads: number;
  lastActivityAt: string | null;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  stats: MemberStats;
};

export type TeamOverview = {
  id: string;
  name: string;
  memberCount: number;
  stats: MemberStats & { memberCount: number; wonLeads: number };
  members: TeamMember[];
};

export type TeamsResponse = {
  teams: TeamOverview[];
  unassigned: { id: string; name: string; email: string; stats: MemberStats }[];
};

export async function login(email: string, password: string) {
  const data = await api<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
  await setToken(data.token);
  return data.user;
}

export type { Entitlements } from './entitlements';
