import { prisma } from '../../lib/prisma.js';

const PROVIDER_ENV_KEYS: Record<string, string> = {
  apify: 'APIFY_TOKEN',
  firecrawl: 'FIRECRAWL_API_KEY',
  apollo: 'APOLLO_API_KEY',
  hunter: 'HUNTER_API_KEY',
  tavily: 'TAVILY_API_KEY',
  opencorporates: 'OPENCORPORATES_API_KEY',
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
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const stored = (settings.leadEngine ?? {}) as Record<string, unknown>;
  const storedProviders = (stored.providers ?? {}) as Record<string, { enabled: boolean }>;

  const providers: Record<string, boolean> = {};
  for (const [id, envKey] of Object.entries(PROVIDER_ENV_KEYS)) {
    const configured = Boolean(process.env[envKey]);
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
