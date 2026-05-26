import { DEFAULT_LEAD_SOURCES, DEFAULT_LOSS_REASONS } from '@wizcrm/shared';
import { getOrgSettings } from './org-settings.service.js';

export async function getCrmConfig(organizationId: string) {
  const settings = await getOrgSettings(organizationId);
  return {
    leadSources:
      settings.leadSources && settings.leadSources.length > 0
        ? settings.leadSources
        : [...DEFAULT_LEAD_SOURCES],
    lossReasons:
      settings.lossReasons && settings.lossReasons.length > 0
        ? settings.lossReasons
        : [...DEFAULT_LOSS_REASONS],
  };
}
