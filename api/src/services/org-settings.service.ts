import { orgSettingsSchema, type OrgSettings } from '@wizcrm/shared';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

export function parseOrgSettings(raw: unknown): OrgSettings {
  const parsed = orgSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  return parseOrgSettings(org?.settings);
}

/** Desk: DB setting overrides env default when `deskUseAi` is present in settings JSON. */
export async function resolveDeskUseAi(organizationId: string): Promise<boolean> {
  const settings = await getOrgSettings(organizationId);
  if (typeof settings.deskUseAi === 'boolean') {
    return settings.deskUseAi;
  }
  return config.deskUseAi;
}

export async function mergeOrgSettings(
  organizationId: string,
  patch: OrgSettings,
): Promise<OrgSettings> {
  const current = await getOrgSettings(organizationId);
  const merged = { ...current, ...patch };
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: merged },
  });
  return merged;
}
