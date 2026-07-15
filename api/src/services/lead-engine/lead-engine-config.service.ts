import { prisma } from '../../lib/prisma.js';
import { orgSettingsSchema, type OrgSettings } from '@wizcrm/shared';

const PROVIDER_KEY_FIELDS: Record<string, keyof NonNullable<OrgSettings['apiKeys']>> = {
  apify: 'apifyToken',
  firecrawl: 'firecrawlApiKey',
  apollo: 'apolloApiKey',
  hunter: 'hunterApiKey',
  tavily: 'tavilyApiKey',
  opencorporates: 'openCorporatesApiKey',
};

const PROVIDER_DEFAULTS: Record<string, boolean> = {
  apify: true,
  firecrawl: true,
  apollo: false,
  hunter: false,
  tavily: false,
  opencorporates: false,
};

export interface LeadEngineConfig {
  providers: Record<string, boolean>;
  globalLimit: number;
}

export async function getLeadEngineConfig(organizationId: string): Promise<LeadEngineConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const parsedSettings = orgSettingsSchema.safeParse(org?.settings ?? {});
  const settings: OrgSettings = parsedSettings.success ? parsedSettings.data : {};
  const rawSettings = (org?.settings ?? {}) as Record<string, unknown>;
  const stored = (rawSettings.leadEngine ?? {}) as Record<string, unknown>;
  const storedProviders = (stored.providers ?? {}) as Record<string, { enabled: boolean }>;

  const providers: Record<string, boolean> = {};
  for (const [id, field] of Object.entries(PROVIDER_KEY_FIELDS)) {
    const configured = Boolean(settings.apiKeys?.[field]);
    providers[id] = (storedProviders[id]?.enabled ?? PROVIDER_DEFAULTS[id]) && configured;
  }

  return {
    providers,
    globalLimit: (stored.globalLimit as number | undefined) ?? 20,
  };
}

export function isProviderEnabled(config: LeadEngineConfig, providerId: string): boolean {
  return config.providers[providerId] ?? false;
}
