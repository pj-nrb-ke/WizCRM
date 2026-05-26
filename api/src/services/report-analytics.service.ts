import type { LeadStage } from '@prisma/client';
import { FUNNEL_STAGES, maxStageIndexReached, stageIndex } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import type { ReportDateRange } from './report.service.js';
import { resolveOwnerFilter } from './report.service.js';

const MS_PER_DAY = 86_400_000;

export type ConversionFunnelRow = {
  stage: string;
  reached: number;
  pctOfTotal: number;
  pctFromPrevious: number | null;
};

export type TimeInStageRow = {
  stage: string;
  avgDays: number;
  samples: number;
};

export async function loadAdvancedAnalytics(
  organizationId: string,
  teamId: string | undefined,
  range: ReportDateRange,
) {
  const ownerFilter = await resolveOwnerFilter(organizationId, teamId);
  if (ownerFilter === null) return null;

  const leads = await prisma.lead.findMany({
    where: {
      organizationId,
      ...ownerFilter,
      createdAt: { lte: range.dateTo },
    },
    select: { id: true, stage: true, createdAt: true },
  });
  const leadIds = leads.map((l) => l.id);
  if (leadIds.length === 0) {
    return { conversionFunnel: [], timeInStage: [] };
  }

  const stageChanges = await prisma.stageChange.findMany({
    where: {
      leadId: { in: leadIds },
      createdAt: { gte: range.dateFrom, lte: range.dateTo },
    },
    select: { leadId: true, fromStage: true, toStage: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const changesByLead = new Map<string, typeof stageChanges>();
  for (const c of stageChanges) {
    const list = changesByLead.get(c.leadId) ?? [];
    list.push(c);
    changesByLead.set(c.leadId, list);
  }

  const total = leads.length;
  const conversionFunnel: ConversionFunnelRow[] = FUNNEL_STAGES.map((stage, idx) => {
    const reached = leads.filter((lead) => {
      const toStages = (changesByLead.get(lead.id) ?? []).map((c) => c.toStage);
      return maxStageIndexReached(lead.stage, toStages) >= idx;
    }).length;
    return { stage, reached, pctOfTotal: 0, pctFromPrevious: null as number | null };
  }).map((row, idx, arr) => {
    const pctOfTotal = total > 0 ? Math.round((row.reached / total) * 1000) / 10 : 0;
    const prev = idx > 0 ? arr[idx - 1]!.reached : total;
    const pctFromPrevious =
      idx === 0 ? null : prev > 0 ? Math.round((row.reached / prev) * 1000) / 10 : 0;
    return { ...row, pctOfTotal, pctFromPrevious };
  });

  const dwellBuckets = new Map<LeadStage, number[]>();
  for (const lead of leads) {
    const changes = changesByLead.get(lead.id) ?? [];
    let cursor = lead.createdAt;
    let currentStage: LeadStage = 'NEW';
    for (const change of changes) {
      const days = (change.createdAt.getTime() - cursor.getTime()) / MS_PER_DAY;
      if (days >= 0) {
        const list = dwellBuckets.get(currentStage) ?? [];
        list.push(days);
        dwellBuckets.set(currentStage, list);
      }
      currentStage = change.toStage;
      cursor = change.createdAt;
    }
    const tailDays = (range.dateTo.getTime() - cursor.getTime()) / MS_PER_DAY;
    if (tailDays >= 0 && !['WON', 'LOST'].includes(lead.stage)) {
      const stage = lead.stage as LeadStage;
      const list = dwellBuckets.get(stage) ?? [];
      list.push(tailDays);
      dwellBuckets.set(stage, list);
    }
  }

  const timeInStage: TimeInStageRow[] = FUNNEL_STAGES.map((stage) => {
    const samples = dwellBuckets.get(stage) ?? [];
    const avgDays =
      samples.length > 0
        ? Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
        : 0;
    return { stage, avgDays, samples: samples.length };
  });

  return { conversionFunnel, timeInStage };
}
