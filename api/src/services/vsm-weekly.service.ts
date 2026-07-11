import { prisma } from '../lib/prisma.js';
import { EmailUnavailableError, sendTransactionalEmail } from './brevo-mail.js';
import { loadSalesPacing } from './sales-targets.service.js';
import { createOpenAIClient, chatJson } from './ai/openai.provider.js';
import { isScheduledTimeReached } from './vsm-execution.service.js';

const APP_URL = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function safeSend(params: Parameters<typeof sendTransactionalEmail>[0]) {
  try {
    await sendTransactionalEmail(params);
  } catch (e) {
    if (e instanceof EmailUnavailableError) return;
    throw e;
  }
}

function todayDateOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number) {
  const d = todayDateOnly();
  d.setDate(d.getDate() - n);
  return d;
}

type RepTrend = {
  userId: string;
  userName: string;
  tasksCompletedThisWeek: number;
  tasksCompletedLastWeek: number;
  activitiesThisWeek: number;
  activitiesLastWeek: number;
  trend: 'up' | 'down' | 'flat';
  pacingLabel: string;
  achievementPct: number | null;
};

async function buildRepTrends(organizationId: string): Promise<RepTrend[]> {
  const roster = await prisma.user.findMany({
    where: { organizationId, isVirtual: false, teamMemberProfile: { managedByVsm: true } },
    select: { id: true, name: true },
  });

  const thisWeekStart = daysAgo(7);
  const lastWeekStart = daysAgo(14);
  const pacing = await loadSalesPacing(organizationId);
  const pacingByUser = new Map(pacing.reps.map((r) => [r.userId, r]));

  const trends: RepTrend[] = [];
  for (const person of roster) {
    const [tasksThisWeek, tasksLastWeek, activitiesThisWeek, activitiesLastWeek] = await Promise.all([
      prisma.task.count({ where: { organizationId, userId: person.id, completedAt: { gte: thisWeekStart } } }),
      prisma.task.count({
        where: { organizationId, userId: person.id, completedAt: { gte: lastWeekStart, lt: thisWeekStart } },
      }),
      prisma.activity.count({ where: { userId: person.id, createdAt: { gte: thisWeekStart } } }),
      prisma.activity.count({ where: { userId: person.id, createdAt: { gte: lastWeekStart, lt: thisWeekStart } } }),
    ]);
    const trend: RepTrend['trend'] =
      tasksThisWeek + activitiesThisWeek > tasksLastWeek + activitiesLastWeek
        ? 'up'
        : tasksThisWeek + activitiesThisWeek < tasksLastWeek + activitiesLastWeek
          ? 'down'
          : 'flat';
    const rep = pacingByUser.get(person.id);
    trends.push({
      userId: person.id,
      userName: person.name,
      tasksCompletedThisWeek: tasksThisWeek,
      tasksCompletedLastWeek: tasksLastWeek,
      activitiesThisWeek,
      activitiesLastWeek,
      trend,
      pacingLabel: rep?.pacingLabel ?? '—',
      achievementPct: rep?.achievementPct ?? null,
    });
  }
  return trends;
}

/** One grounded coaching line per rep — same no-invented-facts rule as the
 * rest of the module (§5.1): the LLM only rephrases the numbers it's given,
 * it never adds claims. Deterministic fallback when no OpenAI client. */
async function coachingObservations(trends: RepTrend[], tone: string): Promise<Map<string, string>> {
  const client = createOpenAIClient();
  if (!client || trends.length === 0) {
    return new Map(
      trends.map((t) => [
        t.userId,
        `${t.trend === 'up' ? 'Activity trending up' : t.trend === 'down' ? 'Activity trending down' : 'Activity steady'} this week; ${t.pacingLabel.toLowerCase()} on target.`,
      ]),
    );
  }

  const input = JSON.stringify({
    tone,
    reps: trends.map((t) => ({
      userId: t.userId,
      name: t.userName,
      tasksCompletedThisWeek: t.tasksCompletedThisWeek,
      tasksCompletedLastWeek: t.tasksCompletedLastWeek,
      activitiesThisWeek: t.activitiesThisWeek,
      activitiesLastWeek: t.activitiesLastWeek,
      pacingLabel: t.pacingLabel,
      achievementPct: t.achievementPct,
    })),
  });

  const result = await chatJson<{ observations: { userId: string; note: string }[] }>(
    client,
    `You are Wanjiru, a ${tone} sales manager writing one-line weekly coaching observations for the CEO's Friday review. For each rep, write ONE short sentence grounded strictly in the numbers given — never invent a reason, never speculate about why, just describe the trend and pacing plainly and constructively. Never use judgmental or disciplinary language. Return JSON: {"observations": [{"userId": string, "note": string}]}, one entry per rep.`,
    input,
  );

  const map = new Map<string, string>();
  for (const o of result.observations ?? []) {
    if (o.userId && o.note) map.set(o.userId, o.note);
  }
  // Fill any rep the LLM skipped with the deterministic fallback line.
  for (const t of trends) {
    if (!map.has(t.userId)) {
      map.set(t.userId, `${t.trend === 'up' ? 'Activity trending up' : t.trend === 'down' ? 'Activity trending down' : 'Activity steady'} this week; ${t.pacingLabel.toLowerCase()} on target.`);
    }
  }
  return map;
}

async function notifyCeos(organizationId: string, ceoUserIds: string[], personaName: string, subject: string, html: string, text: string) {
  if (ceoUserIds.length === 0) return;
  const ceos = await prisma.user.findMany({ where: { id: { in: ceoUserIds } }, select: { email: true, name: true } });
  for (const ceo of ceos) {
    await safeSend({ toEmail: ceo.email, toName: ceo.name, subject: `${personaName}'s ${subject}`, text, html });
  }
}

/** Friday 16:00 weekly review (§3, Phase 3): per-rep trends, one grounded
 * coaching observation each, and target trajectory — reusing the same
 * pacing computation the Reports/Targets pages already show. Idempotent
 * per (org, date, kind) like the daily runs. */
export async function getOrCreateWeeklyRun(organizationId: string, opts: { fromCron?: boolean } = {}) {
  const vsmConfig = await prisma.vsmConfig.findUnique({ where: { organizationId } });
  if (!vsmConfig || !vsmConfig.enabled) throw new Error('VSM_NOT_ENABLED');

  if (opts.fromCron && !isScheduledTimeReached(vsmConfig.timezone, vsmConfig.runWeeklyAt, vsmConfig.workingDays, 5)) {
    return null;
  }

  const existing = await prisma.vsmRun.findUnique({
    where: { organizationId_date_kind: { organizationId, date: todayDateOnly(), kind: 'WEEKLY' } },
  });
  if (existing) return existing;

  const trends = await buildRepTrends(organizationId);
  const observations = await coachingObservations(trends, vsmConfig.tone);

  const run = await prisma.vsmRun.create({
    data: {
      organizationId,
      date: todayDateOnly(),
      kind: 'WEEKLY',
      status: 'SENT',
      contextSnapshot: { repsConsidered: trends.length },
      planJson: {
        reps: trends.map((t) => ({ ...t, observation: observations.get(t.userId) ?? '' })),
      } as unknown as object,
      sentAt: new Date(),
    },
  });

  const rows = trends
    .map(
      (t) =>
        `<li><strong>${escapeHtml(t.userName)}</strong> — ${t.tasksCompletedThisWeek} tasks done (${t.tasksCompletedLastWeek} last week), ${t.pacingLabel}${t.achievementPct !== null ? ` (${t.achievementPct}%)` : ''}<br/><span style="color:#64748b">${escapeHtml(observations.get(t.userId) ?? '')}</span></li>`,
    )
    .join('');
  const textRows = trends
    .map(
      (t) =>
        `- ${t.userName}: ${t.tasksCompletedThisWeek} tasks done (${t.tasksCompletedLastWeek} last week), ${t.pacingLabel}${t.achievementPct !== null ? ` (${t.achievementPct}%)` : ''} — ${observations.get(t.userId) ?? ''}`,
    )
    .join('\n');

  await notifyCeos(
    organizationId,
    vsmConfig.ceoUserIds,
    vsmConfig.personaName,
    'weekly review',
    `<p>Weekly review — ${trends.length} rep${trends.length === 1 ? '' : 's'}:</p><ul>${rows}</ul><p><a href="${APP_URL}">Open in WizCRM</a></p>`,
    (trends.length ? `Weekly review — ${trends.length} rep(s):\n\n${textRows}` : 'No managed staff to review this week.') + `\n\nOpen in WizCRM: ${APP_URL}`,
  );

  return run;
}
