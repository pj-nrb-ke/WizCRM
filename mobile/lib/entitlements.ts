/** Local mirror of shared entitlements (APK bundle). */

export type PlanCode = 'lite' | 'pro' | 'enterprise';
export type LicenseStatus = 'active' | 'grace' | 'expired' | 'read_only';
export type ErpSyncStatus = 'NONE' | 'PENDING' | 'SYNCED' | 'FAILED';

export type Entitlements = {
  plan: PlanCode;
  licenseStatus: LicenseStatus;
  readOnly: boolean;
  banner: string | null;
  features: {
    erpSync: boolean;
    geofence: boolean;
    advancedReports: boolean;
    webhook: boolean;
  };
};

export function erpSyncStatusLabel(status: ErpSyncStatus): string {
  switch (status) {
    case 'NONE':
      return 'Not synced';
    case 'PENDING':
      return 'Syncing…';
    case 'SYNCED':
      return 'Synced';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}
