import type { LeadStage } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getTeamMemberIds, isStaleLead, STALE_LEAD_DAYS } from './team.service.js';

const CLOSED: LeadStage[] = ['WON', 'LOST'];

export type MetricKind = 'open' | 'stale' | 'won' | 'overdue';

export async function loadMetricDetails(
  organizationId: string,
  metric: MetricKind,
  filters: { teamId?: string; ownerId?: string },
) {
  let ownerIds: string[] | undefined;
  if (filters.ownerId) {
    ownerIds = [filters.ownerId];
  } else if (filters.teamId) {
    const ids = await getTeamMemberIds(filters.teamId, organizationId);
    ownerIds = ids ?? [];
  }

  const ownerFilter = ownerIds ? { ownerId: { in: ownerIds } } : {};

  if (metric === 'overdue') {
    const now = new Date();
    const tasks = await prisma.task.findMany({
      where: {
        organizationId,
        completedAt: null,
        dueAt: { lt: now },
        ...(ownerIds ? { userId: { in: ownerIds } } : {}),
      },
      include: {
        lead: { select: { id: true, name: true, company: true, stage: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { dueAt: 'asc' },
      take: 100,
    });
    return {
      metric,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: t.dueAt?.toISOString() ?? null,
        owner: t.user,
        lead: t.lead,
      })),
      leads: [],
    };
  }

  const leads = await prisma.lead.findMany({
    where: { organizationId, ...ownerFilter },
    include: {
      owner: { select: { id: true, name: true, team: { select: { name: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  });

  const now = new Date();
  const filtered = leads.filter((l) => {
    if (metric === 'won') return l.stage === 'WON';
    if (metric === 'open') return !CLOSED.includes(l.stage);
    if (metric === 'stale') {
      return !CLOSED.includes(l.stage) && isStaleLead(l.lastActivityAt, l.createdAt, now);
    }
    return false;
  });

  return {
    metric,
    leads: filtered.map((l) => ({
      id: l.id,
      name: l.name,
      company: l.company,
      stage: l.stage,
      email: l.email,
      phone: l.phone,
      updatedAt: l.updatedAt.toISOString(),
      lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
      owner: l.owner,
    })),
    tasks: [],
    staleDays: metric === 'stale' ? STALE_LEAD_DAYS : undefined,
  };
}
