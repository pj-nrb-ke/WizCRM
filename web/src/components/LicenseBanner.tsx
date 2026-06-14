import type { Entitlements } from '@wizcrm/shared';

type Props = {
  entitlements: Entitlements | null | undefined;
};

export function LicenseBanner({ entitlements }: Props) {
  if (!entitlements?.banner) return null;
  const severity =
    entitlements.licenseStatus === 'expired' || entitlements.readOnly ? 'warn' : 'info';
  return (
    <div className={`license-banner license-banner--${severity}`} role="status">
      <strong>{entitlements.plan.toUpperCase()}</strong>
      <span>{entitlements.banner}</span>
    </div>
  );
}
