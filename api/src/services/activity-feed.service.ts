import { prisma } from '../lib/prisma.js';
import { getTeamMemberIds } from './team.service.js';

export type TeamActivityItem = {
  id: string;
  kind: 'activity' | 'calendar';
  at: string;
  user: { id: string; name: string };
  lead: { id: string; name: string; company: string | null } | null;
  summary: string;
  detail: string | null;
  activityType?: string;
};

function parseDateStart(iso?: string): Date {
  if (!iso) {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateEnd(iso?: string): Date {
  if (!iso) {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function loadTeamActivityFeed(
  organizationId: string,
  filters: {
    dateFrom?: string;
    dateTo?: string;
    leadId?: string;
    teamId?: string;
    ownerId?: string;
  },
): Promise<TeamActivityItem[]> {
  const dateFrom = parseDateStart(filters.dateFrom);
  const dateTo = parseDateEnd(filters.dateTo);

  let ownerIds: string[] | undefined;
  if (filters.ownerId) {
    ownerIds = [filters.ownerId];
  } else if (filters.teamId) {
    const ids = await getTeamMemberIds(filters.teamId, organizationId);
    ownerIds = ids ?? [];
  }

  const leadWhere = {
    organizationId,
    ...(filters.leadId ? { id: filters.leadId } : {}),
    ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
  };

  const activities = await prisma.activity.findMany({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      lead: leadWhere,
    },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const calendarEvents = await prisma.calendarEvent.findMany({
    where: {
      organizationId,
      startAt: { lte: dateTo },
      endAt: { gte: dateFrom },
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(ownerIds ? { userId: { in: ownerIds } } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
    orderBy: { startAt: 'desc' },
    take: 100,
  });

  const activityItems: TeamActivityItem[] = activities.map((a) => ({
    id: a.id,
    kind: 'activity' as const,
    at: a.createdAt.toISOString(),
    user: a.user,
    lead: a.lead,
    summary: activitySummary(a.type, a.subject),
    detail: a.body,
    activityType: a.type,
  }));

  const calendarItems: TeamActivityItem[] = calendarEvents.map((e) => ({
    id: e.id,
    kind: 'calendar' as const,
    at: e.startAt.toISOString(),
    user: e.user,
    lead: e.lead,
    summary: `Calendar: ${e.title}`,
    detail: e.notes,
    activityType: 'CALENDAR_EVENT',
  }));

  return [...activityItems, ...calendarItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 300);
}

function activitySummary(type: string, subject: string | null): string {
  const label = type.replace(/_/g, ' ').toLowerCase();
  if (subject) return `${label}: ${subject}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
