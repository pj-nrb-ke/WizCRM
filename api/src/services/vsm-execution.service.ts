import type { PersonPlan, PlanItem } from './vsm-planning.service.js';
import { generateMorningPlan } from './vsm-planning.service.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { EmailUnavailableError, sendTransactionalEmail } from './brevo-mail.js';
import { checkHighValueStalled, updateSilenceStreak } from './vsm-escalation.service.js';
import { getOrgSettings } from './org-settings.service.js';
import { isStaleLead, resolveStaleLeadDays } from './stale-lead.service.js';
import { eodCheckIn, morningGreeting, signOff } from './vsm-i18n.js';
import { notifyUser } from './notification.service.js';

const APP_URL = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function replyAddress(taskId: string) {
  return `task-${taskId}@${config.brevoInboundDomain}`;
}

function runReplyAddress(runId: string) {
  return `vsmrun-${runId}@${config.brevoInboundDomain}`;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function todayDateOnly() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Reads current time/day in the org's own configured timezone via Intl,
 * rather than a fixed VPS-local crontab time — the VPS is on Europe/Berlin,
 * which drifts against Africa/Nairobi across DST changes, and a fixed cron
 * time can't respect the per-org runMorningAt/workingDays config anyway.
 * Cron is expected to poll frequently (e.g. every 15 min); this gate is what
 * actually decides whether it's time yet. */
export function isScheduledTimeReached(
  timezone: string,
  targetHHMM: string,
  workingDays: number[],
  requiredWeekday?: number,
): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort);
  // Weekly review (§3) is fixed to Friday regardless of the org's
  // Mon-Fri-style workingDays config, which governs the daily rhythm only.
  if (requiredWeekday !== undefined) {
    if (dayIndex !== requiredWeekday) return false;
  } else if (workingDays.length > 0 && !workingDays.includes(dayIndex)) {
    return false;
  }

  const [targetHour, targetMinute] = targetHHMM.split(':').map(Number);
  return hour > targetHour || (hour === targetHour && minute >= targetMinute);
}

async function safeSend(params: Parameters<typeof sendTransactionalEmail>[0]) {
  try {
    await sendTransactionalEmail(params);
  } catch (e) {
    if (e instanceof EmailUnavailableError) return;
    throw e;
  }
}

/** Idempotent per (org, date, kind): a double-fired cron finds the existing
 * row instead of generating (and later sending) a second plan. `fromCron`
 * gates on the configured run time/working days; the manual "Run now" button
 * bypasses that gate on purpose — an admin clicking it means now. */
export async function getOrCreateMorningRun(organizationId: string, opts: { fromCron?: boolean } = {}) {
  const vsmConfig = await prisma.vsmConfig.findUnique({ where: { organizationId } });
  if (!vsmConfig || !vsmConfig.enabled) {
    throw new Error('VSM_NOT_ENABLED');
  }
  if (opts.fromCron && !isScheduledTimeReached(vsmConfig.timezone, vsmConfig.runMorningAt, vsmConfig.workingDays)) {
    return null;
  }

  const existing = await prisma.vsmRun.findUnique({
    where: { organizationId_date_kind: { organizationId, date: todayDateOnly(), kind: 'MORNING' } },
  });
  if (existing) return existing;

  const plan = await generateMorningPlan(organizationId, vsmConfig);
  const run = await prisma.vsmRun.create({
    data: {
      organizationId,
      date: todayDateOnly(),
      kind: 'MORNING',
      status: 'DRAFT',
      contextSnapshot: {
        peopleConsidered: plan.people.length,
        totalItems: plan.people.reduce((n, p) => n + p.items.length, 0),
      },
      planJson: plan as unknown as object,
    },
  });

  if (vsmConfig.autonomy === 'AUTO') {
    return sendMorningRun(run.id, null);
  }

  await notifyCeosDraftReady(run.id, vsmConfig, plan);
  return run;
}

/** DRAFT mode has no in-app requirement: the CEO gets the plan by email and
 * approves it by replying — no login needed. Fires once, right when the
 * DRAFT run is created (idempotent creation above already prevents a second
 * run — and therefore a second email — on repeat cron polls same day). */
async function notifyCeosDraftReady(
  runId: string,
  vsmConfig: { ceoUserIds: string[]; personaName: string },
  plan: { people: PersonPlan[] },
) {
  if (vsmConfig.ceoUserIds.length === 0) return;

  const perPersonCounts = plan.people.map((p) => ({
    name: p.userName,
    count: p.items.filter((i) => i.included && i.createsTask).length,
  }));
  const totalTasks = perPersonCounts.reduce((n, p) => n + p.count, 0);
  const peopleLabel = `${plan.people.length} ${plan.people.length === 1 ? 'person' : 'people'}`;

  const summaryLines = perPersonCounts.map(
    (p) => `- ${p.name}: ${p.count} task${p.count === 1 ? '' : 's'}`,
  );
  const summaryHtml = perPersonCounts
    .map((p) => `<li>${escapeHtml(p.name)}: ${p.count} task${p.count === 1 ? '' : 's'}</li>`)
    .join('');

  const text =
    `${vsmConfig.personaName}'s morning plan is ready — ${totalTasks} task${totalTasks === 1 ? '' : 's'} across ${peopleLabel}:\n\n` +
    (summaryLines.join('\n') || 'No one has anything today.') +
    `\n\nReply APPROVE to send it to the team now, or reply SKIP to hold it back today.`;
  const html =
    `<p>${escapeHtml(vsmConfig.personaName)}'s morning plan is ready — ${totalTasks} task${totalTasks === 1 ? '' : 's'} across ${peopleLabel}:</p>` +
    `<ul>${summaryHtml || '<li>No one has anything today.</li>'}</ul>` +
    `<p><strong>Reply APPROVE</strong> to send it to the team now, or <strong>reply SKIP</strong> to hold it back today.</p>`;

  const ceos = await prisma.user.findMany({ where: { id: { in: vsmConfig.ceoUserIds } }, select: { email: true, name: true } });
  for (const ceo of ceos) {
    await safeSend({
      toEmail: ceo.email,
      toName: ceo.name,
      subject: `${vsmConfig.personaName}'s morning plan — ${totalTasks} task${totalTasks === 1 ? '' : 's'} ready for your OK`,
      text,
      html,
      replyTo: { email: runReplyAddress(runId), name: vsmConfig.personaName },
    });
  }
}

/** Stamps `edited: true` onto contextSnapshot — the cheap signal
 * vsm-performance.service.ts reads for plan-edit rate (§4.2a) and the
 * draft → auto eligibility check (§4.2b), without a separate table. */
export async function updateMorningRunPlan(runId: string, people: PersonPlan[]) {
  const run = await prisma.vsmRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('RUN_NOT_FOUND');
  if (run.status !== 'DRAFT') throw new Error('RUN_NOT_EDITABLE');
  const current = run.planJson as unknown as { generatedAt: string; taskCapPerDay: number; people: PersonPlan[] };
  const updated = { ...current, people };
  const contextSnapshot = { ...(run.contextSnapshot as object), edited: true };
  return prisma.vsmRun.update({
    where: { id: runId },
    data: { planJson: updated as unknown as object, contextSnapshot },
  });
}

/** Creates the real Tasks, sends one digest email per person, and — since a
 * single email can only carry one Reply-To header — the primary Reply-To
 * targets that person's first task; every other task line also gets its own
 * mailto link so a reply to any specific task still threads correctly. */
export async function sendMorningRun(runId: string, approvedByUserId: string | null) {
  const run = await prisma.vsmRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('RUN_NOT_FOUND');
  if (run.status !== 'DRAFT') return run; // already sent/skipped — idempotent

  const plan = run.planJson as unknown as { people: PersonPlan[] };
  const vsmConfig = await prisma.vsmConfig.findUnique({ where: { organizationId: run.organizationId } });
  if (!vsmConfig) throw new Error('VSM_NOT_ENABLED');

  const dueAt = endOfToday();
  const sentSummary: { userId: string; userName: string; taskCount: number }[] = [];

  for (const person of plan.people) {
    const included = person.items.filter((i) => i.included && i.createsTask);
    if (included.length === 0 && person.carryover.length === 0) continue;

    const createdTasks: { id: string; title: string; reason: string }[] = [];
    for (const item of included) {
      const task = await prisma.task.create({
        data: {
          organizationId: run.organizationId,
          userId: person.userId,
          leadId: (item.evidence as { leadId?: string }).leadId ?? null,
          title: item.title,
          description: item.reason,
          source: 'VSM',
          reason: item.reason,
          evidence: item.evidence as object,
          priority: 'MEDIUM',
          dueAt,
        },
      });
      createdTasks.push({ id: task.id, title: item.title, reason: item.reason });
    }

    if (createdTasks.length > 0) {
      await notifyUser({
        organizationId: run.organizationId,
        userId: person.userId,
        kind: 'vsm_morning_plan',
        title: `${vsmConfig.personaName} assigned you ${createdTasks.length} task${createdTasks.length === 1 ? '' : 's'}`,
        body: createdTasks.map((t) => t.title).join('; '),
        linkPath: '/',
      });

      const user = await prisma.user.findUnique({ where: { id: person.userId }, select: { email: true, name: true } });
      if (user) {
        const lines = createdTasks
          .map(
            (t) =>
              `<li><strong>${escapeHtml(t.title)}</strong> — ${escapeHtml(t.reason)} ` +
              `(<a href="mailto:${replyAddress(t.id)}?subject=${encodeURIComponent(`Re: ${t.title}`)}">reply to this one</a>)</li>`,
          )
          .join('');
        const carryoverLines = person.carryover
          .map((c: PlanItem) => `<li>${escapeHtml(c.title)} — ${escapeHtml(c.reason)} <em>(carried over)</em></li>`)
          .join('');
        const html =
          `<p>${escapeHtml(morningGreeting(vsmConfig.language, user.name))} — ${createdTasks.length} thing${createdTasks.length === 1 ? '' : 's'} today:</p>` +
          `<ul>${lines}${carryoverLines}</ul>` +
          `<p><a href="${APP_URL}">Open in WizCRM</a></p>` +
          `<p style="color:#94a3b8;font-size:12px">${escapeHtml(signOff(vsmConfig.language, vsmConfig.personaName))}</p>`;
        const text =
          `${morningGreeting(vsmConfig.language, user.name)} — ${createdTasks.length} thing${createdTasks.length === 1 ? '' : 's'} today:\n\n` +
          createdTasks.map((t) => `- ${t.title} — ${t.reason}`).join('\n') +
          (person.carryover.length ? `\n\nStill open from before:\n${person.carryover.map((c) => `- ${c.title} — ${c.reason}`).join('\n')}` : '') +
          `\n\nOpen in WizCRM: ${APP_URL}`;

        await safeSend({
          toEmail: user.email,
          toName: user.name,
          subject: `Today's plan — ${createdTasks.length} thing${createdTasks.length === 1 ? '' : 's'}`,
          text,
          html,
          replyTo: { email: replyAddress(createdTasks[0].id), name: vsmConfig.personaName },
        });
      }
      sentSummary.push({ userId: person.userId, userName: person.userName, taskCount: createdTasks.length });
    }
  }

  const updated = await prisma.vsmRun.update({
    where: { id: runId },
    data: { status: 'SENT', approvedBy: approvedByUserId, approvedAt: new Date(), sentAt: new Date() },
  });

  if (approvedByUserId === null) {
    // AUTO mode — CEO gets an FYI, not an approval prompt (VSM-SPEC §3).
    await notifyCeos(
      run.organizationId,
      vsmConfig,
      `${vsmConfig.personaName}'s morning plan sent automatically`,
      `Auto-sent to ${sentSummary.length} people:\n\n${sentSummary.map((s) => `- ${s.userName}: ${s.taskCount} task${s.taskCount === 1 ? '' : 's'}`).join('\n')}`,
    );
  }

  return updated;
}

/** Extracted so both the web "Skip" button and an emailed "SKIP" reply go
 * through the same idempotent, DRAFT-only guard. */
export async function skipMorningRun(runId: string) {
  const run = await prisma.vsmRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error('RUN_NOT_FOUND');
  if (run.status !== 'DRAFT') return run; // already sent/skipped — idempotent
  return prisma.vsmRun.update({ where: { id: runId }, data: { status: 'SKIPPED' } });
}

async function notifyCeos(organizationId: string, vsmConfig: { ceoUserIds: string[]; personaName: string }, subject: string, text: string) {
  if (vsmConfig.ceoUserIds.length === 0) return;
  const ceos = await prisma.user.findMany({ where: { id: { in: vsmConfig.ceoUserIds } }, select: { email: true, name: true } });
  for (const ceo of ceos) {
    await safeSend({
      toEmail: ceo.email,
      toName: ceo.name,
      subject,
      text,
      html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
    });
  }
}

// ─── End-of-day collection (VSM-SPEC §3) ────────────────────────────────────
// A routine daily check-in — not the staged silence-escalation ladder in
// §4.6/§4.7 (that needs VsmEscalation + multi-day tracking; Phase 2).

export async function getOrCreateEodRun(organizationId: string, opts: { fromCron?: boolean } = {}) {
  const vsmConfig = await prisma.vsmConfig.findUnique({ where: { organizationId } });
  if (!vsmConfig || !vsmConfig.enabled) throw new Error('VSM_NOT_ENABLED');
  if (opts.fromCron && !isScheduledTimeReached(vsmConfig.timezone, vsmConfig.runEveningAt, vsmConfig.workingDays)) {
    return null;
  }

  const existing = await prisma.vsmRun.findUnique({
    where: { organizationId_date_kind: { organizationId, date: todayDateOnly(), kind: 'EOD' } },
  });
  if (existing) return existing;

  const todayStart = todayDateOnly();
  const now = new Date();

  const settings = await getOrgSettings(organizationId);
  const stalledCount = await checkHighValueStalled(organizationId, settings.staleLeadDays ?? 7);

  // Recorded purely as a baseline for vsm-performance.service.ts's stale-lead
  // reduction metric (§4.2a) — cheaper than a dedicated history table.
  const staleLeadDays = await resolveStaleLeadDays(organizationId);
  const activeLeads = await prisma.lead.findMany({
    where: { organizationId, stage: { notIn: ['WON', 'LOST'] } },
    select: { lastActivityAt: true, createdAt: true },
  });
  const staleLeadCount = activeLeads.filter((l) => isStaleLead(l.lastActivityAt, l.createdAt, staleLeadDays)).length;

  const roster = await prisma.user.findMany({
    where: { organizationId, isVirtual: false, isActive: true, teamMemberProfile: { managedByVsm: true } },
    select: { id: true, name: true, email: true },
  });

  type PersonDigest = { userId: string; userName: string; completedToday: number; stillOpen: number; hadMovementToday: boolean };
  const perPerson: PersonDigest[] = [];

  for (const person of roster) {
    const [completedToday, stillOpenTasks, updatesToday] = await Promise.all([
      prisma.task.count({ where: { organizationId, userId: person.id, completedAt: { gte: todayStart, lte: now } } }),
      prisma.task.findMany({ where: { organizationId, userId: person.id, completedAt: null }, select: { id: true } }),
      prisma.taskUpdate.count({
        where: { userId: person.id, createdAt: { gte: todayStart, lte: now }, task: { organizationId } },
      }),
    ]);
    const hadMovementToday = completedToday > 0 || updatesToday > 0;
    perPerson.push({
      userId: person.id,
      userName: person.name,
      completedToday,
      stillOpen: stillOpenTasks.length,
      hadMovementToday,
    });

    await updateSilenceStreak(organizationId, person.id, person.name, hadMovementToday, {
      name: vsmConfig.personaName,
      language: vsmConfig.language,
    });

    if (stillOpenTasks.length > 0) {
      const user = await prisma.user.findUnique({ where: { id: person.id }, select: { email: true, name: true } });
      if (user) {
        const checkIn = eodCheckIn(vsmConfig.language);
        const text = `Hi ${user.name} — you have ${stillOpenTasks.length} open item${stillOpenTasks.length === 1 ? '' : 's'}. ${checkIn} Reply to let ${vsmConfig.personaName} know.`;
        await safeSend({
          toEmail: user.email,
          toName: user.name,
          subject: checkIn,
          text: `${text}\n\nOpen in WizCRM: ${APP_URL}`,
          html: `<p>${escapeHtml(text)}</p><p><a href="${APP_URL}">Open in WizCRM</a></p>`,
        });
      }
    }
  }

  const run = await prisma.vsmRun.create({
    data: {
      organizationId,
      date: todayDateOnly(),
      kind: 'EOD',
      status: 'SENT',
      contextSnapshot: { peopleConsidered: roster.length, stalledHighValueLeads: stalledCount, staleLeadCount },
      planJson: { perPerson } as unknown as object,
      sentAt: new Date(),
    },
  });

  const digestText = perPerson
    .map((p) => `- ${p.userName}: ${p.completedToday} done today, ${p.stillOpen} still open${p.hadMovementToday ? '' : ' (no movement today)'}`)
    .join('\n');
  const riskLine = stalledCount > 0 ? `\n\n⚠ ${stalledCount} HOT lead${stalledCount === 1 ? '' : 's'} stalled — see the Escalations inbox.` : '';
  await notifyCeos(
    organizationId,
    vsmConfig,
    `${vsmConfig.personaName}'s evening digest`,
    (digestText || 'No managed staff with activity today.') + riskLine,
  );

  return run;
}
