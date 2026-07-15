import { z } from 'zod';

/** Pages/actions an org admin can allow or block per role, beyond the fixed role hierarchy. */
export const FEATURE_KEYS = [
  'reports',
  'targets',
  'dataHygiene',
  'expoFinder',
  'bulkImport',
  'leadGenerator',
  'contactFinder',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, { label: string; description: string }> = {
  reports: { label: 'Reports', description: 'Team analytics, pipeline forecast, manager brief, lead CSV export.' },
  targets: { label: 'Targets', description: 'Sales targets and pacing dashboard.' },
  dataHygiene: { label: 'Data hygiene', description: 'Stale/incomplete lead cleanup report.' },
  expoFinder: { label: 'Expo finder', description: 'Discover and add exhibitions to the calendar.' },
  bulkImport: { label: 'Bulk import', description: 'CSV bulk lead import.' },
  leadGenerator: { label: 'Lead Generator', description: 'ICP-based lead discovery campaigns.' },
  contactFinder: { label: 'Contact Finder', description: 'Find decision-maker contacts for companies.' },
};

/** Roles an admin can configure per-feature access for. ADMIN always has full access and is not configurable. */
export const CONFIGURABLE_ROLES = ['MANAGER', 'SALES'] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export const rolePermissionsSchema = z
  .object({
    MANAGER: z.record(z.enum(FEATURE_KEYS), z.boolean()).optional(),
    SALES: z.record(z.enum(FEATURE_KEYS), z.boolean()).optional(),
  })
  .optional();

export type RolePermissions = z.infer<typeof rolePermissionsSchema>;

/** ADMIN always allowed; MANAGER/SALES default to allowed unless explicitly set to false in org settings. */
export function hasFeatureAccess(
  role: string,
  rolePermissions: RolePermissions | undefined,
  key: FeatureKey,
): boolean {
  if (role === 'ADMIN') return true;
  if (role !== 'MANAGER' && role !== 'SALES') return false;
  const value = rolePermissions?.[role]?.[key];
  return value !== false;
}

export function resolvePermissions(
  role: string,
  rolePermissions: RolePermissions | undefined,
): Record<FeatureKey, boolean> {
  const result = {} as Record<FeatureKey, boolean>;
  for (const key of FEATURE_KEYS) {
    result[key] = hasFeatureAccess(role, rolePermissions, key);
  }
  return result;
}
