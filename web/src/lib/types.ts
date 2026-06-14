export type MemberStats = {
  openLeads: number;
  overdueTasks: number;
  staleLeads: number;
  lastActivityAt: string | null;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  stats: MemberStats;
};

export type TeamOverview = {
  id: string;
  name: string;
  memberCount: number;
  stats: MemberStats & { memberCount: number; wonLeads: number };
  members: TeamMember[];
};

export type TeamsResponse = {
  teams: TeamOverview[];
  unassigned: { id: string; name: string; email: string; stats: MemberStats }[];
};

export type LeadOwner = {
  id: string;
  name: string;
  email: string;
  team?: { id: string; name: string } | null;
};

export type LeadSummary = {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  stage: string;
  source?: string | null;
  tags?: string[];
  lastActivityAt?: string | null;
  updatedAt?: string;
  owner?: LeadOwner;
};
