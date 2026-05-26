import { describe, expect, it } from 'vitest';
import { resolveEntitlements } from './entitlements.js';

describe('resolveEntitlements', () => {
  it('defaults to lite active', () => {
    const e = resolveEntitlements({});
    expect(e.plan).toBe('lite');
    expect(e.licenseStatus).toBe('active');
    expect(e.readOnly).toBe(false);
    expect(e.features.erpSync).toBe(false);
  });

  it('pro enables erp sync feature flag', () => {
    const e = resolveEntitlements({ plan: 'pro' });
    expect(e.features.erpSync).toBe(true);
    expect(e.features.geofence).toBe(true);
    expect(e.features.leadInsights).toBe(true);
    expect(e.features.targetsPacing).toBe(true);
    expect(e.features.quotations).toBe(true);
  });

  it('grace shows banner', () => {
    const e = resolveEntitlements({ plan: 'pro', licenseStatus: 'grace' });
    expect(e.banner).toContain('grace');
    expect(e.readOnly).toBe(false);
  });

  it('expired is read-only', () => {
    const e = resolveEntitlements({ licenseStatus: 'expired' });
    expect(e.readOnly).toBe(true);
    expect(e.banner).toContain('read-only');
  });
});
