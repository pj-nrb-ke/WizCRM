import { resolveEntitlements, type Entitlements } from '@wizcrm/shared';
import { getOrgSettings } from './org-settings.service.js';

export async function getOrganizationEntitlements(organizationId: string): Promise<Entitlements> {
  const settings = await getOrgSettings(organizationId);
  return resolveEntitlements(settings);
}
