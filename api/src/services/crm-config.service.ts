import { DEFAULT_CHECK_IN_RADIUS_METERS, DEFAULT_LEAD_SOURCES, DEFAULT_LOSS_REASONS } from '@wizcrm/shared';
import { getOrgSettings } from './org-settings.service.js';
import { resolveStaleLeadDays } from './stale-lead.service.js';

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
    leadTags: settings.leadTags ?? [],
    checkInRadiusMeters: settings.checkInRadiusMeters ?? DEFAULT_CHECK_IN_RADIUS_METERS,
    staleLeadDays: await resolveStaleLeadDays(organizationId),
    meetingGraceMinutes: settings.meetingGraceMinutes ?? 15,
    quoteFollowUpDays: settings.quoteFollowUpDays ?? 7,
    branding: {
      displayName: settings.brandDisplayName ?? null,
      logoUrl: settings.logoUrl ?? null,
      primaryColorHex: settings.primaryColorHex ?? null,
      supportEmail: settings.supportEmail ?? null,
    },
  };
}
