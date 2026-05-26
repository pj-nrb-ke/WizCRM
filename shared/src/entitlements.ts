import type { OrgSettings } from './schemas.js';

export const PLAN_CODES = ['lite', 'pro', 'enterprise'] as const;
export const LICENSE_STATUSES = ['active', 'grace', 'expired', 'read_only'] as const;
export const ERP_SYNC_STATUSES = ['NONE', 'PENDING', 'SYNCED', 'FAILED'] as const;

export type PlanCode = (typeof PLAN_CODES)[number];
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];
export type ErpSyncStatus = (typeof ERP_SYNC_STATUSES)[number];

export type EntitlementFeatures = {
  erpSync: boolean;
  geofence: boolean;
  advancedReports: boolean;
  webhook: boolean;
  /** PRO-003: lead priority / risk scores on detail */
  leadInsights: boolean;
  /** PRO-005/006: draft email/WhatsApp with approve-before-send */
  communicationDrafts: boolean;
  /** PRO-010: monthly targets and pacing */
  targetsPacing: boolean;
  /** PRO-008: org-wide data hygiene report */
  dataHygiene: boolean;
  /** PRO-011: quotations on leads */
  quotations: boolean;
};

export type Entitlements = {
  plan: PlanCode;
  licenseStatus: LicenseStatus;
  readOnly: boolean;
  banner: string | null;
  features: EntitlementFeatures;
};

export function resolveEntitlements(settings: OrgSettings = {}): Entitlements {
  const plan = (settings.plan ?? 'lite') as PlanCode;
  const licenseStatus = (settings.licenseStatus ?? 'active') as LicenseStatus;
  const readOnly = licenseStatus === 'expired' || licenseStatus === 'read_only';

  let banner: string | null = null;
  if (licenseStatus === 'grace') {
    banner = 'License in grace period — renew soon to avoid read-only mode.';
  } else if (licenseStatus === 'expired') {
    banner = 'License expired — CRM is read-only until renewal.';
  } else if (licenseStatus === 'read_only') {
    banner = 'Account is in read-only mode — contact your administrator.';
  }

  const isProOrEnt = plan === 'pro' || plan === 'enterprise';
  const isEnterprise = plan === 'enterprise';

  return {
    plan,
    licenseStatus,
    readOnly,
    banner,
    features: {
      erpSync: isProOrEnt && settings.erpConnectorEnabled !== false,
      geofence: isProOrEnt,
      advancedReports: isProOrEnt,
      webhook: isProOrEnt || settings.webhookEnabled === true,
      leadInsights: isProOrEnt,
      communicationDrafts: isProOrEnt,
      targetsPacing: isProOrEnt,
      dataHygiene: isProOrEnt,
      quotations: isProOrEnt,
    },
  };
}

export function erpSyncStatusLabel(status: ErpSyncStatus): string {
  switch (status) {
    case 'NONE':
      return 'Not synced';
    case 'PENDING':
      return 'Syncing…';
    case 'SYNCED':
      return 'Synced to ERP';
    case 'FAILED':
      return 'Sync failed';
    default:
      return status;
  }
}
