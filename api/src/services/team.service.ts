import type { LeadStage } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  DEFAULT_STALE_LEAD_DAYS,
  isStaleLead as isStaleLeadWithDays,
  resolveStaleLeadDays,
} from './stale-lead.service.js';

/** @deprecated Use resolveStaleLeadDays(orgId) — kept for tests importing constant */
export const STALE_LEAD_DAYS = DEFAULT_STALE_LEAD_DAYS;

export { isStaleLeadWithDays as isStaleLead };

const CLOSED_STAGES: LeadStage[] = ['WON', 'LOST'];

export type MemberStats = {
  openLeads: number;
  overdueTasks: number;
  staleLeads: number;
  wonLeads: number;
  lastActivityAt: string | null;
};

export type TeamStats = MemberStats & {
  memberCount: number;
  wonLeads: number;
};

export function emptyMemberStats(): MemberStats {
  return {
    openLeads: 0,
    overdueTasks: 0,
    staleLeads: 0,
    wonLeads: 0,
    lastActivityAt: null,
  };
}

export function mergeMemberStats(
  leads: { stage: LeadStage; lastActivityAt: Date | null; createdAt: Date }[],
  overdueTaskCount: number,
  staleDays = DEFAULT_STALE_LEAD_DAYS,
  now = new Date(),
): MemberStats {
  let openLeads = 0;
  let staleLeads = 0;
  let wonLeads = 0;
  let latest: Date | null = null;

  for (const lead of leads) {
    if (lead.stage === 'WON') wonLeads += 1;
    if (!CLOSED_STAGES.includes(lead.stage)) {
      openLeads += 1;
      if (isStaleLeadWithDays(lead.lastActivityAt, lead.createdAt, staleDays, now)) {
        staleLeads += 1;
      }
    }
    const activity = lead.lastActivityAt ?? lead.createdAt;
    if (!latest || activity > latest) {
      latest = activity;
    }
  }

  return {
    openLeads,
    overdueTasks: overdueTaskCount,
    staleLeads,
    wonLeads,
    lastActivityAt: latest ? latest.toISOString() : null,
  };
}

export function teamStatsFromMembers(
  members: { stats: MemberStats }[],
): TeamStats {
  const base = members.reduce(
    (acc, m) => ({
      openLeads: acc.openLeads + m.stats.openLeads,
      overdueTasks: acc.overdueTasks + m.stats.overdueTasks,
      staleLeads: acc.staleLeads + m.stats.staleLeads,
      memberCount: acc.memberCount + 1,
      wonLeads: acc.wonLeads,
      lastActivityAt: pickLatest(acc.lastActivityAt, m.stats.lastActivityAt),
    }),
    {
      openLeads: 0,
      overdueTasks: 0,
      staleLeads: 0,
      memberCount: 0,
      wonLeads: 0,
      lastActivityAt: null as string | null,
    },
  );
  return base;
}

function pickLatest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
}

export async function loadOrganizationTeamContext(organizationId: string) {
  const now = new Date();
  const staleDays = await resolveStaleLeadDays(organizationId);
  const [teams, leads, overdueTasks, users] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId },
      include: {
        members: {
          where: { role: 'SALES' },
          select: { id: true, name: true, email: true, role: true, teamId: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.lead.findMany({
      where: { organizationId },
      select: {
        ownerId: true,
        stage: true,
        lastActivityAt: true,
        createdAt: true,
      },
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        completedAt: null,
        dueAt: { lt: now },
      },
      select: { userId: true },
    }),
    prisma.user.findMany({
      where: { organizationId, role: 'SALES' },
      select: { id: true, name: true, email: true, teamId: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const leadsByOwner = new Map<string, typeof leads>();
  for (const lead of leads) {
    const list = leadsByOwner.get(lead.ownerId) ?? [];
    list.push(lead);
    leadsByOwner.set(lead.ownerId, list);
  }

  const overdueByUser = new Map<string, number>();
  for (const task of overdueTasks) {
    overdueByUser.set(task.userId, (overdueByUser.get(task.userId) ?? 0) + 1);
  }

  const wonByOwner = new Map<string, number>();
  for (const lead of leads) {
    if (lead.stage === 'WON') {
      wonByOwner.set(lead.ownerId, (wonByOwner.get(lead.ownerId) ?? 0) + 1);
    }
  }

  function statsForUser(userId: string): MemberStats {
    return mergeMemberStats(
      leadsByOwner.get(userId) ?? [],
      overdueByUser.get(userId) ?? 0,
      staleDays,
      now,
    );
  }

  const teamsWithStats = teams.map((team) => {
    const members = team.members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      stats: statsForUser(m.id),
    }));
    const stats = teamStatsFromMembers(members);
    const wonLeads = team.members.reduce(
      (sum, m) => sum + (wonByOwner.get(m.id) ?? 0),
      0,
    );
    return {
      id: team.id,
      name: team.name,
      memberCount: members.length,
      stats: { ...stats, wonLeads },
      members,
    };
  });

  const unassigned = users
    .filter((u) => !u.teamId)
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      stats: statsForUser(u.id),
    }));

  return { teams: teamsWithStats, unassigned };
}

export async function getTeamMemberIds(teamId: string, organizationId: string) {
  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId },
    include: { members: { where: { role: 'SALES' }, select: { id: true } } },
  });
  if (!team) return null;
  return team.members.map((m) => m.id);
}
