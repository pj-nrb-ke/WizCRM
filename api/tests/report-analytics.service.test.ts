import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
  stageChangeFindMany: vi.fn(),
}));

const teamServiceMocks = vi.hoisted(() => ({
  getTeamMemberIds: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    lead: { findMany: prismaMocks.leadFindMany },
    stageChange: { findMany: prismaMocks.stageChangeFindMany },
  },
}));

vi.mock('../src/services/team.service.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/team.service.js')>(
    '../src/services/team.service.js',
  );
  return {
    ...actual,
    getTeamMemberIds: teamServiceMocks.getTeamMemberIds,
  };
});

import { loadAdvancedAnalytics } from '../src/services/report-analytics.service.js';

describe('report-analytics.service', () => {
  const range = {
    dateFrom: new Date('2026-01-01'),
    dateTo: new Date('2026-03-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    teamServiceMocks.getTeamMemberIds.mockResolvedValue(undefined);
    prismaMocks.leadFindMany.mockResolvedValue([]);
    prismaMocks.stageChangeFindMany.mockResolvedValue([]);
  });

  it('returns null when team filter is invalid', async () => {
    teamServiceMocks.getTeamMemberIds.mockResolvedValueOnce(null);
    const result = await loadAdvancedAnalytics('org-1', 'bad-team', range);
    expect(result).toBeNull();
  });

  it('returns empty analytics when no leads in range', async () => {
    const result = await loadAdvancedAnalytics('org-1', undefined, range);
    expect(result).toEqual({ conversionFunnel: [], timeInStage: [] });
  });

  it('builds funnel and dwell metrics for leads with stage history', async () => {
    const created = new Date('2026-01-10');
    prismaMocks.leadFindMany.mockResolvedValueOnce([
      { id: 'lead-1', stage: 'QUALIFIED', createdAt: created },
    ]);
    prismaMocks.stageChangeFindMany.mockResolvedValueOnce([
      {
        leadId: 'lead-1',
        fromStage: 'NEW',
        toStage: 'CONTACTED',
        createdAt: new Date('2026-01-15'),
      },
      {
        leadId: 'lead-1',
        fromStage: 'CONTACTED',
        toStage: 'QUALIFIED',
        createdAt: new Date('2026-02-01'),
      },
    ]);

    const result = await loadAdvancedAnalytics('org-1', undefined, range);
    expect(result).not.toBeNull();
    expect(result!.conversionFunnel.length).toBeGreaterThan(0);
    expect(result!.conversionFunnel[0]!.stage).toBe('NEW');
    expect(result!.timeInStage.some((r) => r.stage === 'NEW' && r.samples > 0)).toBe(true);
  });
});
