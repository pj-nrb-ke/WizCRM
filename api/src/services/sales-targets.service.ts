import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings } from './org-settings.service.js';

export type RepPacingRow = {
  userId: string;
  name: string;
  email: string;
  target: number;
  wonRevenue: number;
  wonDeals: number;
  achievementPct: number | null;
  pacingLabel: string;
};

export type SalesPacingReport = {
  period: string;
  periodStart: string;
  periodEnd: string;
  orgTarget: number;
  orgWonRevenue: number;
  orgAchievementPct: number | null;
  orgPacingLabel: string;
  reps: RepPacingRow[];
};

function monthBounds(year: number, month: number) {
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const label = `${year}-${String(month).padStart(2, '0')}`;
  return { periodStart, periodEnd, label };
}

function currentMonthUtc() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

function pacingLabel(
  achievementPct: number | null,
  target: number,
  dayOfMonth: number,
  daysInMonth: number,
): string {
  if (target <= 0) return 'No target set';
  if (achievementPct === null) return '—';
  const expectedPct = (dayOfMonth / daysInMonth) * 100;
  const delta = achievementPct - expectedPct;
  if (delta >= 10) return 'Ahead of pace';
  if (delta >= -5) return 'On track';
  return 'Behind pace';
}

export async function loadSalesPacing(
  organizationId: string,
  year?: number,
  month?: number,
): Promise<SalesPacingReport> {
  const { year: y, month: m, day } = currentMonthUtc();
  const bounds = monthBounds(year ?? y, month ?? m);
  const daysInMonth = bounds.periodEnd.getUTCDate();

  const settings = await getOrgSettings(organizationId);
  const orgDefault = settings.orgMonthlyRevenueTarget ?? 0;
  const userTargets = settings.userMonthlyTargets ?? {};

  const users = await prisma.user.findMany({
    where: { organizationId, role: { in: ['SALES', 'MANAGER'] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });

  const wonWhere: Prisma.LeadWhereInput = {
    organizationId,
    stage: 'WON',
    OR: [
      { wonStartAt: { gte: bounds.periodStart, lte: bounds.periodEnd } },
      {
        wonStartAt: null,
        updatedAt: { gte: bounds.periodStart, lte: bounds.periodEnd },
      },
    ],
  };

  const wonLeads = await prisma.lead.findMany({
    where: wonWhere,
    select: { ownerId: true, wonValue: true },
  });

  const wonByOwner = new Map<string, { revenue: number; deals: number }>();
  for (const lead of wonLeads) {
    const prev = wonByOwner.get(lead.ownerId) ?? { revenue: 0, deals: 0 };
    const value = lead.wonValue ? Number(lead.wonValue) : 0;
    wonByOwner.set(lead.ownerId, {
      revenue: prev.revenue + value,
      deals: prev.deals + 1,
    });
  }

  const reps: RepPacingRow[] = users.map((u) => {
    const target = userTargets[u.id] ?? orgDefault;
    const won = wonByOwner.get(u.id) ?? { revenue: 0, deals: 0 };
    const achievementPct = target > 0 ? Math.round((won.revenue / target) * 1000) / 10 : null;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      target,
      wonRevenue: Math.round(won.revenue * 100) / 100,
      wonDeals: won.deals,
      achievementPct,
      pacingLabel: pacingLabel(achievementPct, target, day, daysInMonth),
    };
  });

  const orgWonRevenue = reps.reduce((s, r) => s + r.wonRevenue, 0);
  const orgTarget =
    Object.values(userTargets).reduce((s, v) => s + v, 0) ||
    orgDefault * Math.max(users.length, 1);
  const orgAchievementPct =
    orgTarget > 0 ? Math.round((orgWonRevenue / orgTarget) * 1000) / 10 : null;

  return {
    period: bounds.label,
    periodStart: bounds.periodStart.toISOString(),
    periodEnd: bounds.periodEnd.toISOString(),
    orgTarget: Math.round(orgTarget * 100) / 100,
    orgWonRevenue: Math.round(orgWonRevenue * 100) / 100,
    orgAchievementPct,
    orgPacingLabel: pacingLabel(orgAchievementPct, orgTarget, day, daysInMonth),
    reps,
  };
}
