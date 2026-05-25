import { describe, expect, it } from 'vitest';
import { aggregateOrgStats } from './manager-home';
import type { TeamOverview } from './types';

describe('aggregateOrgStats', () => {
  it('sums KPI counters across teams', () => {
    const teams: TeamOverview[] = [
      {
        id: 't1',
        name: 'Field',
        memberCount: 2,
        stats: {
          memberCount: 2,
          openLeads: 3,
          overdueTasks: 1,
          staleLeads: 2,
          wonLeads: 4,
          lastActivityAt: null,
        },
        members: [],
      },
      {
        id: 't2',
        name: 'Inside',
        memberCount: 1,
        stats: {
          memberCount: 1,
          openLeads: 5,
          overdueTasks: 2,
          staleLeads: 1,
          wonLeads: 3,
          lastActivityAt: null,
        },
        members: [],
      },
    ];

    expect(aggregateOrgStats(teams)).toEqual({
      open: 8,
      overdue: 3,
      stale: 3,
      won: 7,
    });
  });
});
