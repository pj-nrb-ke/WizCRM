import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
  activityCount: vi.fn(),
  stageChangeFindMany: vi.fn(),
}));

const teamServiceMocks = vi.hoisted(() => ({
  getTeamMemberIds: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    lead: {
      findMany: prismaMocks.leadFindMany,
    },
    activity: {
      count: prismaMocks.activityCount,
    },
    stageChange: {
      findMany: prismaMocks.stageChangeFindMany,
    },
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

import { loadReportSummary } from '../src/services/report.service.js';

describe('reports.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamServiceMocks.getTeamMemberIds.mockResolvedValue(['rep-1', 'rep-2']);
    prismaMocks.leadFindMany.mockResolvedValue([]);
    prismaMocks.activityCount.mockResolvedValue(0);
    prismaMocks.stageChangeFindMany.mockResolvedValue([]);
  });

  it('returns null when team does not exist', async () => {
    teamServiceMocks.getTeamMemberIds.mockResolvedValueOnce(null);

    const summary = await loadReportSummary('org-1', 'team-missing');

    expect(summary).toBeNull();
    expect(prismaMocks.leadFindMany).not.toHaveBeenCalled();
  });

  it('builds phase 1 analytics metrics for selected range', async () => {
    prismaMocks.leadFindMany.mockResolvedValueOnce([
      {
        id: 'lead-1',
        stage: 'NEW',
        source: 'Web',
        ownerId: 'rep-1',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-03-02T00:00:00.000Z'),
        owner: { id: 'rep-1', name: 'Alice', email: 'alice@wizcrm.app' },
      },
      {
        id: 'lead-2',
        stage: 'WON',
        source: 'Referral',
        ownerId: 'rep-1',
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
        lastActivityAt: new Date('2026-03-10T00:00:00.000Z'),
        owner: { id: 'rep-1', name: 'Alice', email: 'alice@wizcrm.app' },
      },
      {
        id: 'lead-3',
        stage: 'LOST',
        source: null,
        ownerId: 'rep-2',
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        lastActivityAt: new Date('2026-03-12T00:00:00.000Z'),
        owner: { id: 'rep-2', name: 'Bob', email: 'bob@wizcrm.app' },
      },
      {
        id: 'lead-4',
        stage: 'CONTACTED',
        source: 'Web',
        ownerId: 'rep-2',
        createdAt: new Date('2026-03-15T00:00:00.000Z'),
        lastActivityAt: new Date(),
        owner: { id: 'rep-2', name: 'Bob', email: 'bob@wizcrm.app' },
      },
    ])
      .mockResolvedValueOnce([{ id: 'lead-3', lossReason: 'NO_BUDGET' }]);
    prismaMocks.activityCount.mockResolvedValueOnce(7);
    prismaMocks.stageChangeFindMany.mockResolvedValueOnce([
      {
        leadId: 'lead-3',
        note: 'No budget',
        createdAt: new Date('2026-03-18T09:00:00.000Z'),
      },
      {
        leadId: 'lead-3',
        note: 'Went with competitor',
        createdAt: new Date('2026-03-17T09:00:00.000Z'),
      },
    ]);

    const dateFrom = new Date('2026-03-01T00:00:00.000Z');
    const dateTo = new Date('2026-03-31T23:59:59.000Z');
    const summary = await loadReportSummary('org-1', undefined, { dateFrom, dateTo });

    expect(prismaMocks.leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          createdAt: { gte: dateFrom, lte: dateTo },
        }),
      }),
    );
    expect(summary).toMatchObject({
      totalLeads: 4,
      openLeads: 2,
      wonCount: 1,
      lostCount: 1,
      winRate: 50,
      conversionRateOpenToWon: 50,
      activitiesLast30Days: 7,
      staleCount: 1,
      wonLoss: {
        won: 1,
        lost: 1,
        lossReasons: [{ reason: 'No budget', count: 1 }],
      },
    });
    expect(summary?.byStage).toMatchObject({
      NEW: 1,
      CONTACTED: 1,
      WON: 1,
      LOST: 1,
    });
    expect(summary?.bySource).toEqual([
      { source: 'Web', count: 2 },
      { source: 'Referral', count: 1 },
      { source: '(none)', count: 1 },
    ]);
    expect(summary?.byOwner).toEqual([
      {
        ownerId: 'rep-1',
        ownerName: 'Alice',
        ownerEmail: 'alice@wizcrm.app',
        count: 2,
        openCount: 1,
        wonCount: 1,
        lostCount: 0,
      },
      {
        ownerId: 'rep-2',
        ownerName: 'Bob',
        ownerEmail: 'bob@wizcrm.app',
        count: 2,
        openCount: 1,
        wonCount: 0,
        lostCount: 1,
      },
    ]);
  });

  it('applies team owner filter and skips loss reasons when no lost leads', async () => {
    prismaMocks.leadFindMany.mockResolvedValueOnce([
      {
        id: 'lead-1',
        stage: 'WON',
        source: 'Web',
        ownerId: 'rep-1',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-02-02T00:00:00.000Z'),
        owner: { id: 'rep-1', name: 'Alice', email: 'alice@wizcrm.app' },
      },
    ]);
    prismaMocks.activityCount.mockResolvedValueOnce(1);

    const summary = await loadReportSummary('org-1', 'team-1', {
      dateFrom: new Date('2026-02-01T00:00:00.000Z'),
      dateTo: new Date('2026-02-10T00:00:00.000Z'),
    });

    expect(teamServiceMocks.getTeamMemberIds).toHaveBeenCalledWith('team-1', 'org-1');
    expect(prismaMocks.leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: { in: ['rep-1', 'rep-2'] },
        }),
      }),
    );
    expect(prismaMocks.stageChangeFindMany).not.toHaveBeenCalled();
    expect(summary?.wonLoss.lossReasons).toEqual([]);
  });
});
