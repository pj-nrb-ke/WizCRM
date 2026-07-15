import { AsyncLocalStorage } from 'node:async_hooks';
import type { OrgSettings } from '@wizcrm/shared';

type OrgApiKeys = NonNullable<OrgSettings['apiKeys']>;

type OrgCtx = {
  organizationId: string;
  apiKeys: OrgApiKeys;
};

const als = new AsyncLocalStorage<OrgCtx>();

/** Bound once per request (in the auth hook) so every downstream call in this
 * request's async chain can resolve the caller's own org-scoped integration
 * keys without threading organizationId through every function signature. */
export function bindOrgContext(organizationId: string, apiKeys: OrgApiKeys): void {
  als.enterWith({ organizationId, apiKeys });
}

function key(name: keyof OrgApiKeys): string {
  return als.getStore()?.apiKeys[name] || '';
}

export const orgApiKeys = {
  apolloApiKey: () => key('apolloApiKey'),
  apifyToken: () => key('apifyToken'),
  firecrawlApiKey: () => key('firecrawlApiKey'),
  tavilyApiKey: () => key('tavilyApiKey'),
  hunterApiKey: () => key('hunterApiKey'),
  openCorporatesApiKey: () => key('openCorporatesApiKey'),
  prospeoApiKey: () => key('prospeoApiKey'),
  tombaApiKey: () => key('tombaApiKey'),
  tombaApiSecret: () => key('tombaApiSecret'),
};
