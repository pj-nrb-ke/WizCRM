import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  leadFindMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: { findMany: prismaMocks.userFindMany },
    lead: { findMany: prismaMocks.leadFindMany },
  },
}));

vi.mock('../src/services/org-settings.service.js', () => ({
  getOrgSettings: vi.fn().mockResolvedValue({
    orgMonthlyRevenueTarget: 10000,
    userMonthlyTargets: { 'rep-1': 15000 },
  }),
}));

import { loadSalesPacing } from '../src/services/sales-targets.service.js';

describe('sales-targets.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.userFindMany.mockResolvedValue([
      { id: 'rep-1', name: 'Alice', email: 'a@test.com' },
      { id: 'rep-2', name: 'Bob', email: 'b@test.com' },
    ]);
    prismaMocks.leadFindMany.mockResolvedValue([
      { ownerId: 'rep-1', wonValue: 5000 },
      { ownerId: 'rep-1', wonValue: 2500 },
    ]);
  });

  it('computes rep targets and won revenue', async () => {
    const report = await loadSalesPacing('org-1', 2026, 5);
    expect(report.reps).toHaveLength(2);
    const alice = report.reps.find((r) => r.userId === 'rep-1');
    expect(alice?.target).toBe(15000);
    expect(alice?.wonRevenue).toBe(7500);
    expect(alice?.wonDeals).toBe(2);
    expect(alice?.achievementPct).toBe(50);
  });
});
