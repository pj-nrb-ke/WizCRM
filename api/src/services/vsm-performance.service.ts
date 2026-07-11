import { prisma } from '../lib/prisma.js';
import { isStaleLead, resolveStaleLeadDays } from './stale-lead.service.js';

/**
 * VSM-SPEC §4.2a: the CEO's own KPIs for the VSM — actual vs configurable
 * target, and the evidence base for the draft → auto decision (§4.2b).
 */

const LOOKBACK_DAYS = 30;

export type VsmPerformanceSnapshot = {
  taskCompletionRatePct: number | null;
  medianResponseHours: number | null;
  currentStaleLeadCount: number;
  staleLeadReductionPct: number | null;
  planEditRatePct: number | null;
  sampleSizes: { tasksConsidered: number; morningRunsConsidered: number };
};

export async function computeVsmPerformance(organizationId: string): Promise<VsmPerformanceSnapshot> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Task completion rate — VSM-sourced tasks created in the trailing window.
  const vsmTasks = await prisma.task.findMany({
    where: { organizationId, source: 'VSM', createdAt: { gte: since } },
    select: { id: true, createdAt: true, completedAt: true },
  });
  const taskCompletionRatePct =
    vsmTasks.length > 0 ? round1((vsmTasks.filter((t) => t.completedAt).length / vsmTasks.length) * 100) : null;

  // Median first-response time — hours from task creation to the first human reply on it.
  const taskIds = vsmTasks.map((t) => t.id);
  const firstReplies =
    taskIds.length > 0
      ? await prisma.taskUpdate.findMany({
          where: { taskId: { in: taskIds }, isVsm: false },
          orderBy: { createdAt: 'asc' },
          select: { taskId: true, createdAt: true },
        })
      : [];
  const firstReplyByTask = new Map<string, Date>();
  for (const r of firstReplies) {
    if (!firstReplyByTask.has(r.taskId)) firstReplyByTask.set(r.taskId, r.createdAt);
  }
  const responseHours: number[] = [];
  for (const t of vsmTasks) {
    const reply = firstReplyByTask.get(t.id);
    if (reply) responseHours.push((reply.getTime() - t.createdAt.getTime()) / 3_600_000);
  }
  responseHours.sort((a, b) => a - b);
  const medianResponseHours = responseHours.length > 0 ? round1(responseHours[Math.floor(responseHours.length / 2)]) : null;

  // Current stale-lead count, and reduction vs. the count recorded at the oldest
  // EOD run on/before the lookback window — cheap baseline, no extra tracking table.
  const staleLeadDays = await resolveStaleLeadDays(organizationId);
  const activeLeads = await prisma.lead.findMany({
    where: { organizationId, stage: { notIn: ['WON', 'LOST'] } },
    select: { lastActivityAt: true, createdAt: true },
  });
  const currentStaleLeadCount = activeLeads.filter((l) => isStaleLead(l.lastActivityAt, l.createdAt, staleLeadDays)).length;

  const baselineRun = await prisma.vsmRun.findFirst({
    where: { organizationId, kind: 'EOD', date: { lte: since } },
    orderBy: { date: 'desc' },
    select: { contextSnapshot: true },
  });
  const baselineCount = (baselineRun?.contextSnapshot as { staleLeadCount?: number } | null)?.staleLeadCount;
  const staleLeadReductionPct =
    typeof baselineCount === 'number' && baselineCount > 0
      ? round1(((baselineCount - currentStaleLeadCount) / baselineCount) * 100)
      : null;

  // Plan-edit rate — of morning plans that reached APPROVED/SENT, how many
  // needed a CEO edit first. `edited` is stamped onto contextSnapshot by
  // updateMorningRunPlan, not a separate table.
  const morningRuns = await prisma.vsmRun.findMany({
    where: { organizationId, kind: 'MORNING', status: { in: ['APPROVED', 'SENT'] }, createdAt: { gte: since } },
    select: { contextSnapshot: true },
  });
  const editedCount = morningRuns.filter((r) => (r.contextSnapshot as { edited?: boolean } | null)?.edited === true).length;
  const planEditRatePct = morningRuns.length > 0 ? round1((editedCount / morningRuns.length) * 100) : null;

  return {
    taskCompletionRatePct,
    medianResponseHours,
    currentStaleLeadCount,
    staleLeadReductionPct,
    planEditRatePct,
    sampleSizes: { tasksConsidered: vsmTasks.length, morningRunsConsidered: morningRuns.length },
  };
}

const AUTO_MODE_MIN_RUNS = 5;
const AUTO_MODE_LOOKBACK_RUNS = 10;

export type AutoModeEligibility = { eligible: boolean; uneditedCount: number; totalCount: number; reason: string };

/** VSM-SPEC §3/§4.2: "auto is earned after ~2 weeks of approved-without-edits
 * plans." Approximated as the last AUTO_MODE_LOOKBACK_RUNS approved/sent
 * morning runs all being unedited, with a minimum sample so a brand-new org
 * can't unlock it after two lucky days. */
export async function computeAutoModeEligibility(organizationId: string): Promise<AutoModeEligibility> {
  const runs = await prisma.vsmRun.findMany({
    where: { organizationId, kind: 'MORNING', status: { in: ['APPROVED', 'SENT'] } },
    orderBy: { date: 'desc' },
    take: AUTO_MODE_LOOKBACK_RUNS,
    select: { contextSnapshot: true },
  });
  const uneditedCount = runs.filter((r) => (r.contextSnapshot as { edited?: boolean } | null)?.edited !== true).length;
  const totalCount = runs.length;

  if (totalCount < AUTO_MODE_MIN_RUNS) {
    return {
      eligible: false,
      uneditedCount,
      totalCount,
      reason: `Needs at least ${AUTO_MODE_MIN_RUNS} approved morning plans on record (has ${totalCount}).`,
    };
  }
  if (uneditedCount !== totalCount) {
    return {
      eligible: false,
      uneditedCount,
      totalCount,
      reason: `${totalCount - uneditedCount} of the last ${totalCount} plans needed an edit before approval — auto mode unlocks once there's a clean streak.`,
    };
  }
  return { eligible: true, uneditedCount, totalCount, reason: `Last ${totalCount} morning plans approved without edits.` };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
