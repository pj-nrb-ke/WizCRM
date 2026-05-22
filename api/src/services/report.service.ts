import type { LeadStage } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getTeamMemberIds } from './team.service.js';

const CLOSED: LeadStage[] = ['WON', 'LOST'];

export async function resolveOwnerFilter(organizationId: string, teamId?: string) {
  if (!teamId) return {};
  const memberIds = await getTeamMemberIds(teamId, organizationId);
  if (!memberIds) return null;
  if (memberIds.length === 0) return { ownerId: { in: [] as string[] } };
  return { ownerId: { in: memberIds } };
}

export async function loadReportSummary(organizationId: string, teamId?: string) {
  const ownerFilter = await resolveOwnerFilter(organizationId, teamId);
  if (ownerFilter === null) {
    return null;
  }

  const leads = await prisma.lead.findMany({
    where: { organizationId, ...ownerFilter },
    select: { stage: true, source: true },
  });

  const byStage: Record<string, number> = {};
  const sourceMap = new Map<string, number>();
  let openLeads = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const lead of leads) {
    byStage[lead.stage] = (byStage[lead.stage] ?? 0) + 1;
    if (!CLOSED.includes(lead.stage)) openLeads += 1;
    if (lead.stage === 'WON') wonCount += 1;
    if (lead.stage === 'LOST') lostCount += 1;
    const key = lead.source?.trim() || '(none)';
    sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
  }

  const closed = wonCount + lostCount;
  const bySource = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalLeads: leads.length,
    openLeads,
    wonCount,
    lostCount,
    winRate: closed > 0 ? Math.round((wonCount / closed) * 1000) / 10 : null,
    byStage,
    bySource,
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
