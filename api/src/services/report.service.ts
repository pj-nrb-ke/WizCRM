import type { LeadStage, Prisma } from '@prisma/client';
import { lossReasonLabel } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getTeamMemberIds } from './team.service.js';
import { STALE_LEAD_DAYS, isStaleLead } from './team.service.js';

const CLOSED: LeadStage[] = ['WON', 'LOST'];
const DEFAULT_RANGE_DAYS = 90;

export type ReportDateRange = {
  dateFrom: Date;
  dateTo: Date;
};

export async function resolveOwnerFilter(organizationId: string, teamId?: string) {
  if (!teamId) return {};
  const memberIds = await getTeamMemberIds(teamId, organizationId);
  if (!memberIds) return null;
  if (memberIds.length === 0) return { ownerId: { in: [] as string[] } };
  return { ownerId: { in: memberIds } };
}

export async function loadReportSummary(
  organizationId: string,
  teamId?: string,
  range?: ReportDateRange,
) {
  const ownerFilter = await resolveOwnerFilter(organizationId, teamId);
  if (ownerFilter === null) {
    return null;
  }

  const { dateFrom, dateTo } = normalizeDateRange(range);
  const leadWhere: Prisma.LeadWhereInput = {
    organizationId,
    ...ownerFilter,
    createdAt: { gte: dateFrom, lte: dateTo },
  };
  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: {
      id: true,
      stage: true,
      source: true,
      ownerId: true,
      createdAt: true,
      lastActivityAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  const byStage: Record<string, number> = {};
  const sourceMap = new Map<string, number>();
  const ownerMap = new Map<
    string,
    {
      ownerId: string;
      ownerName: string;
      ownerEmail: string;
      count: number;
      openCount: number;
      wonCount: number;
      lostCount: number;
    }
  >();
  let openLeads = 0;
  let wonCount = 0;
  let lostCount = 0;
  let staleCount = 0;

  for (const lead of leads) {
    byStage[lead.stage] = (byStage[lead.stage] ?? 0) + 1;
    const isOpenLead = !CLOSED.includes(lead.stage);
    if (isOpenLead) {
      openLeads += 1;
      if (isStaleLead(lead.lastActivityAt, lead.createdAt)) {
        staleCount += 1;
      }
    }
    if (lead.stage === 'WON') wonCount += 1;
    if (lead.stage === 'LOST') lostCount += 1;
    const key = lead.source?.trim() || '(none)';
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);

    const owner = ownerMap.get(lead.ownerId) ?? {
      ownerId: lead.owner.id,
      ownerName: lead.owner.name,
      ownerEmail: lead.owner.email,
      count: 0,
      openCount: 0,
      wonCount: 0,
      lostCount: 0,
    };
    owner.count += 1;
    if (isOpenLead) owner.openCount += 1;
    if (lead.stage === 'WON') owner.wonCount += 1;
    if (lead.stage === 'LOST') owner.lostCount += 1;
    ownerMap.set(lead.ownerId, owner);
  }

  const closed = wonCount + lostCount;
  const bySource = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
  const byOwner = [...ownerMap.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.ownerName.localeCompare(b.ownerName);
  });
  const activitiesLast30Days = await loadLast30DayActivities(organizationId, ownerFilter);
  const lossReasons = await loadLossReasons(leads.filter((lead) => lead.stage === 'LOST').map((l) => l.id));

  return {
    totalLeads: leads.length,
    openLeads,
    wonCount,
    lostCount,
    winRate: closed > 0 ? Math.round((wonCount / closed) * 1000) / 10 : null,
    conversionRateOpenToWon:
      openLeads > 0 ? Math.round((wonCount / openLeads) * 1000) / 10 : null,
    wonLoss: {
      won: wonCount,
      lost: lostCount,
      lossReasons,
    },
    byStage,
    bySource,
    byOwner,
    activitiesLast30Days,
    staleCount,
    staleDays: STALE_LEAD_DAYS,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  };
}

export async function loadLeadsForExport(organizationId: string, teamId?: string) {
  const ownerFilter = await resolveOwnerFilter(organizationId, teamId);
  if (ownerFilter === null) return null;

  return prisma.lead.findMany({
    where: { organizationId, ...ownerFilter },
    include: {
      owner: { select: { name: true, email: true, team: { select: { name: true } } } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

type ExportLead = NonNullable<Awaited<ReturnType<typeof loadLeadsForExport>>>[number];

export function leadsToCsv(leads: ExportLead[]): string {
  const header = [
    'name',
    'company',
    'email',
    'phone',
    'stage',
    'source',
    'owner',
    'team',
    'updatedAt',
  ];
  const rows = leads.map((l) => [
    l.name,
    l.company ?? '',
    l.email ?? '',
    l.phone ?? '',
    l.stage,
    l.source ?? '',
    l.owner.name,
    l.owner.team?.name ?? '',
    l.updatedAt.toISOString(),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function normalizeDateRange(range?: ReportDateRange): ReportDateRange {
  if (range) return range;
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - DEFAULT_RANGE_DAYS);
  return { dateFrom, dateTo };
}

async function loadLast30DayActivities(
  organizationId: string,
  ownerFilter: Record<string, unknown>,
): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const ownerIdFilter = (ownerFilter as { ownerId?: { in: string[] } }).ownerId;
  return prisma.activity.count({
    where: {
      createdAt: { gte: since },
      lead: {
        organizationId,
        ...(ownerIdFilter ? { ownerId: ownerIdFilter } : {}),
      },
    },
  });
}

async function loadLossReasons(leadIds: string[]) {
  if (leadIds.length === 0) return [] as { reason: string; count: number }[];

  const lostLeads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, stage: 'LOST' },
    select: { id: true, lossReason: true },
  });

  const reasons = new Map<string, number>();
  const needsNote: string[] = [];

  for (const lead of lostLeads) {
    if (lead.lossReason) {
      const label = lossReasonLabel(lead.lossReason);
      reasons.set(label, (reasons.get(label) ?? 0) + 1);
    } else {
      needsNote.push(lead.id);
    }
  }

  if (needsNote.length > 0) {
    const changes = await prisma.stageChange.findMany({
      where: { leadId: { in: needsNote }, toStage: 'LOST' },
      select: { leadId: true, note: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const seenLeads = new Set<string>();
    for (const change of changes) {
      if (seenLeads.has(change.leadId)) continue;
      seenLeads.add(change.leadId);
      const reason = change.note?.trim() || '(unspecified)';
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  return [...reasons.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}
