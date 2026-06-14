import type { TeamOverview } from './types';

export type OrgStats = {
  open: number;
  overdue: number;
  stale: number;
  won: number;
};

export function aggregateOrgStats(teams: TeamOverview[]): OrgStats {
  return teams.reduce(
    (acc, t) => ({
      open: acc.open + t.stats.openLeads,
      overdue: acc.overdue + t.stats.overdueTasks,
      stale: acc.stale + t.stats.staleLeads,
      won: acc.won + t.stats.wonLeads,
    }),
    { open: 0, overdue: 0, stale: 0, won: 0 },
  );
}
