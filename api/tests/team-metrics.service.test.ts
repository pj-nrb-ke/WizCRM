import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  leadFindMany: vi.fn(),
  taskFindMany: vi.fn(),
}));

const teamServiceMocks = vi.hoisted(() => ({
  getTeamMemberIds: vi.fn(),
  isStaleLead: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    lead: {
      findMany: prismaMocks.leadFindMany,
    },
    task: {
      findMany: prismaMocks.taskFindMany,
    },
  },
}));

vi.mock('../src/services/team.service.js', () => ({
  getTeamMemberIds: teamServiceMocks.getTeamMemberIds,
}));

vi.mock('../src/services/stale-lead.service.js', () => ({
  resolveStaleLeadDays: vi.fn().mockResolvedValue(7),
  isStaleLead: teamServiceMocks.isStaleLead,
}));

import { loadMetricDetails } from '../src/services/team-metrics.service.js';

describe('team-metrics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.leadFindMany.mockResolvedValue([]);
    prismaMocks.taskFindMany.mockResolvedValue([]);
    teamServiceMocks.getTeamMemberIds.mockResolvedValue(['sales-1']);
    teamServiceMocks.isStaleLead.mockReturnValue(false);
  });

  it('uses ownerId filter over teamId', async () => {
    await loadMetricDetails('org-1', 'open', { ownerId: 'owner-42', teamId: 'team-7' });

    expect(teamServiceMocks.getTeamMemberIds).not.toHaveBeenCalled();
    expect(prismaMocks.leadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', ownerId: { in: ['owner-42'] } },
      }),
    );
  });

  it('applies team member filter for overdue tasks', async () => {
    prismaMocks.taskFindMany.mockResolvedValueOnce([
      {
        id: 'task-1',
        title: 'Follow up',
        dueAt: new Date('2026-02-03T08:00:00.000Z'),
        user: { id: 'sales-1', name: 'Rep 1' },
        lead: { id: 'lead-1', name: 'Lead 1', company: 'Co', stage: 'NEW' },
      },
    ]);

    const result = await loadMetricDetails('org-1', 'overdue', { teamId: 'team-7' });

    expect(teamServiceMocks.getTeamMemberIds).toHaveBeenCalledWith('team-7', 'org-1');
    expect(prismaMocks.taskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          completedAt: null,
          userId: { in: ['sales-1'] },
        }),
      }),
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe('task-1');
  });

  it('returns only open stale leads and staleDays metadata', async () => {
    prismaMocks.leadFindMany.mockResolvedValueOnce([
      {
        id: 'lead-open-stale',
        name: 'Old Lead',
        company: null,
        stage: 'QUALIFIED',
        email: null,
        phone: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-03-20T00:00:00.000Z'),
        owner: { id: 'sales-1', name: 'Rep 1', team: { name: 'A' } },
      },
      {
        id: 'lead-won-stale',
        name: 'Won Lead',
        company: null,
        stage: 'WON',
        email: null,
        phone: null,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-03-10T00:00:00.000Z'),
        owner: { id: 'sales-1', name: 'Rep 1', team: { name: 'A' } },
      },
    ]);
    teamServiceMocks.isStaleLead.mockImplementation((lastActivityAt: Date | null) => Boolean(lastActivityAt));

    const result = await loadMetricDetails('org-1', 'stale', { ownerId: 'sales-1' });

    expect(result.staleDays).toBe(7);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].id).toBe('lead-open-stale');
  });
});
