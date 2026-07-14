const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3000';

export const TOKEN_KEY = 'wizcrm_web_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getApiBaseUrl(): string {
  return API_URL.replace(/\/$/, '');
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.auth !== false) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error';
    if (msg === 'Failed to fetch') {
      throw new Error(
        'Could not reach the API. Check your connection, or ask an admin to verify api.wizcrm.app is running.',
      );
    }
    throw e;
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

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

async function fetchAuthenticatedBlob(path: string): Promise<Blob> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getApiBaseUrl()}${path}`, { headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = data as { error?: string; message?: string };
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  return res.blob();
}

export async function downloadAuthenticated(path: string, filename: string): Promise<void> {
  const blob = await fetchAuthenticatedBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Blob object URL for inline viewing (e.g. in an <iframe>/<img>). Caller must revoke it when done. */
export async function openAuthenticatedBlobUrl(path: string): Promise<string> {
  const blob = await fetchAuthenticatedBlob(path);
  return URL.createObjectURL(blob);
}
