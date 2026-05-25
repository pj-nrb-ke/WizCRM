import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  activityFindMany: vi.fn(),
  calendarEventFindMany: vi.fn(),
}));

const teamServiceMocks = vi.hoisted(() => ({
  getTeamMemberIds: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    activity: {
      findMany: prismaMocks.activityFindMany,
    },
    calendarEvent: {
      findMany: prismaMocks.calendarEventFindMany,
    },
  },
}));

vi.mock('../src/services/team.service.js', () => ({
  getTeamMemberIds: teamServiceMocks.getTeamMemberIds,
}));

import { loadTeamActivityFeed } from '../src/services/activity-feed.service.js';

describe('activity-feed.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.activityFindMany.mockResolvedValue([]);
    prismaMocks.calendarEventFindMany.mockResolvedValue([]);
    teamServiceMocks.getTeamMemberIds.mockResolvedValue(['sales-1', 'sales-2']);
  });

  it('normalizes month date filters to full-day boundaries', async () => {
    await loadTeamActivityFeed('org-1', {
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
      teamId: 'team-1',
    });

    expect(teamServiceMocks.getTeamMemberIds).toHaveBeenCalledWith('team-1', 'org-1');

    const activityWhere = prismaMocks.activityFindMany.mock.calls[0][0].where;
    const calendarWhere = prismaMocks.calendarEventFindMany.mock.calls[0][0].where;
    const start = activityWhere.createdAt.gte as Date;
    const end = activityWhere.createdAt.lte as Date;
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(1);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(1);
    expect(end.getDate()).toBe(28);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(calendarWhere.userId).toEqual({ in: ['sales-1', 'sales-2'] });
    expect(activityWhere.lead.ownerId).toEqual({ in: ['sales-1', 'sales-2'] });
  });
});
