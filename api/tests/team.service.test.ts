import { describe, it, expect } from 'vitest';
import {
  isStaleLead,
  mergeMemberStats,
  teamStatsFromMembers,
} from '../src/services/team.service.js';

describe('UT team stats', () => {
  it('flags stale when no activity for 7+ days', () => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    expect(isStaleLead(null, old, 7, new Date())).toBe(true);
  });

  it('mergeMemberStats counts open and stale leads', () => {
    const now = new Date();
    const recent = new Date(now);
    recent.setDate(recent.getDate() - 1);
    const stale = new Date(now);
    stale.setDate(stale.getDate() - 14);

    const stats = mergeMemberStats(
      [
        { stage: 'NEW', lastActivityAt: recent, createdAt: recent },
        { stage: 'QUALIFIED', lastActivityAt: stale, createdAt: stale },
        { stage: 'WON', lastActivityAt: recent, createdAt: recent },
      ],
      2,
      7,
      now,
    );
    expect(stats.openLeads).toBe(2);
    expect(stats.staleLeads).toBe(1);
    expect(stats.overdueTasks).toBe(2);
  });

  it('teamStatsFromMembers sums member stats', () => {
    const stats = teamStatsFromMembers([
      { stats: { openLeads: 3, overdueTasks: 1, staleLeads: 0, lastActivityAt: null } },
      { stats: { openLeads: 2, overdueTasks: 0, staleLeads: 1, lastActivityAt: null } },
    ]);
    expect(stats.openLeads).toBe(5);
    expect(stats.memberCount).toBe(2);
    expect(stats.overdueTasks).toBe(1);
    expect(stats.staleLeads).toBe(1);
  });
});
