import { useEffect, useState } from 'react';
import { api } from './api';

let cachedBrandName: string | null = null;
let inflight: Promise<string> | null = null;

async function fetchBrandName(): Promise<string> {
  if (cachedBrandName) return cachedBrandName;
  if (!inflight) {
    inflight = api<{ branding?: { displayName?: string | null } }>('/leads/crm-config')
      .then((d) => {
        cachedBrandName = d.branding?.displayName || 'your organization';
        return cachedBrandName;
      })
      .catch(() => 'your organization');
  }
  return inflight;
}

/** The org's own display name for copy that mentions "your company" — never hardcode "WizCRM" in tenant-facing text. */
export function useBrandName(): string {
  const [name, setName] = useState(cachedBrandName ?? 'your organization');
  useEffect(() => {
    let cancelled = false;
    fetchBrandName().then((n) => {
      if (!cancelled) setName(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return name;
}
