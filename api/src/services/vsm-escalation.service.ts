import type { EscalationKind, EscalationSeverity } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { EmailUnavailableError, sendTransactionalEmail } from './brevo-mail.js';

const APP_URL = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');

async function safeSend(params: Parameters<typeof sendTransactionalEmail>[0]) {
  try {
    await sendTransactionalEmail(params);
  } catch (e) {
    if (e instanceof EmailUnavailableError) return;
    throw e;
  }
}

/** Consecutive silent working days before a gentle named nudge goes out
 * directly to the person — day 2 of the staged ladder in §4.6, still no
 * CEO involvement. */
const SILENCE_NUDGE_THRESHOLD = 2;

/** Consecutive silent working days before REP_UNRESPONSIVE escalates to the
 * CEO — day 3 of the staged ladder in §4.6 ("Day 3 silent ... escalates to
 * the CEO automatically"). One day after the nudge, not the same day, so a
 * quiet person gets a chance to respond to the nudge first. */
const SILENCE_ESCALATION_THRESHOLD = 3;

/** How much staler than the normal follow-up window a HOT lead has to be
 * before it's a CRITICAL escalation rather than just tomorrow's task list —
 * twice the org's staleLeadDays, so this only fires on leads well past the
 * point a routine follow-up task should already have caught them. */
const HIGH_VALUE_STALL_MULTIPLIER = 2;

/**
 * De-duplication (VSM-SPEC §4.7): the same underlying issue accumulates
 * evidence on one OPEN row instead of spawning a new escalation every run —
 * otherwise a silent rep or a stalled deal would spam the CEO inbox daily.
 */
async function upsertEscalation(params: {
  organizationId: string;
  kind: EscalationKind;
  severity: EscalationSeverity;
  subjectUserId?: string | null;
  evidence: Record<string, unknown>;
  suggestedAction: string;
}) {
  const existing = await prisma.vsmEscalation.findFirst({
    where: {
      organizationId: params.organizationId,
      kind: params.kind,
      subjectUserId: params.subjectUserId ?? null,
      status: 'OPEN',
    },
  });
  if (existing) {
    return prisma.vsmEscalation.update({
      where: { id: existing.id },
      data: { evidence: params.evidence as object, severity: params.severity, suggestedAction: params.suggestedAction },
    });
  }
  return prisma.vsmEscalation.create({
    data: {
      organizationId: params.organizationId,
      kind: params.kind,
      severity: params.severity,
      subjectUserId: params.subjectUserId ?? null,
      evidence: params.evidence as object,
      suggestedAction: params.suggestedAction,
    },
  });
}

/** Called once per person per EOD run. Updates the silence streak and walks
 * the staged ladder from §4.6: day 1 is silent (noted in the digest by the
 * caller, nothing sent here), day 2 gets one gentle named nudge straight
 * from the VSM, day 3+ escalates to the CEO. A person who moves anything
 * resets to 0 — this is about sustained silence, not one quiet afternoon
 * (an explained absence isn't silence either, but that check belongs to the
 * Meeting Room's absence flow, Phase 4). */
export async function updateSilenceStreak(
  organizationId: string,
  userId: string,
  userName: string,
  hadMovementToday: boolean,
  persona: { name: string },
): Promise<{ streak: number; nudged: boolean; escalated: boolean }> {
  const profile = await prisma.teamMemberProfile.findUnique({ where: { userId } });
  const nextStreak = hadMovementToday ? 0 : (profile?.silentStreak ?? 0) + 1;

  await prisma.teamMemberProfile.updateMany({ where: { userId }, data: { silentStreak: nextStreak } });

  if (nextStreak === SILENCE_NUDGE_THRESHOLD) {
    await sendSilenceNudge(organizationId, userId, userName, persona.name);
    return { streak: nextStreak, nudged: true, escalated: false };
  }

  if (nextStreak < SILENCE_ESCALATION_THRESHOLD) {
    return { streak: nextStreak, nudged: false, escalated: false };
  }

  await upsertEscalation({
    organizationId,
    kind: 'REP_UNRESPONSIVE',
    severity: nextStreak >= SILENCE_ESCALATION_THRESHOLD + 2 ? 'CRITICAL' : 'WARNING',
    subjectUserId: userId,
    evidence: { userId, userName, silentStreak: nextStreak, asOf: new Date().toISOString() },
    suggestedAction: `${userName} has had no task movement for ${nextStreak} consecutive working days. Check in personally, or reassign their open accounts.`,
  });
  return { streak: nextStreak, nudged: false, escalated: true };
}

/** Day 2 of the staged silence ladder (§4.6) — a gentle, named nudge direct
 * from the VSM to the person, no CEO involvement yet. In-app notification +
 * email, same channels as the rest of the module. */
async function sendSilenceNudge(organizationId: string, userId: string, userName: string, personaName: string) {
  await prisma.notification.create({
    data: {
      organizationId,
      userId,
      kind: 'vsm_silence_nudge',
      title: `${personaName} checked in on your open tasks`,
      body: 'Anything blocking you? Reply on a task to let them know.',
      linkPath: '/',
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
  if (!user) return;
  const text = `Hi ${userName}, following up on yesterday's tasks — anything blocking you? Reply on any task in WizCRM and ${personaName} will see it.`;
  await safeSend({
    toEmail: user.email,
    toName: user.name,
    subject: 'Anything blocking you?',
    text: `${text}\n\nOpen in WizCRM: ${APP_URL}`,
    html: `<p>${text}</p><p><a href="${APP_URL}">Open in WizCRM</a></p>`,
  });
}

/** Called once per EOD run, org-wide. A HOT lead going quiet well past the
 * normal stale-lead window is a deal at risk, not just a task to add
 * tomorrow — this is the "high-value deal stalled" trigger (§4.7). */
export async function checkHighValueStalled(organizationId: string, staleLeadDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - staleLeadDays * HIGH_VALUE_STALL_MULTIPLIER * 24 * 60 * 60 * 1000);
  const stalledHotLeads = await prisma.lead.findMany({
    where: {
      organizationId,
      priority: 'HOT',
      stage: { notIn: ['WON', 'LOST'] },
      OR: [{ lastActivityAt: { lt: cutoff } }, { lastActivityAt: null, createdAt: { lt: cutoff } }],
    },
    select: { id: true, name: true, company: true, ownerId: true, owner: { select: { name: true } }, lastActivityAt: true },
    take: 50,
  });

  for (const lead of stalledHotLeads) {
    await upsertEscalation({
      organizationId,
      kind: 'HIGH_VALUE_STALLED',
      severity: 'CRITICAL',
      subjectUserId: lead.ownerId,
      evidence: {
        leadId: lead.id,
        leadName: lead.name,
        company: lead.company,
        ownerName: lead.owner.name,
        lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
      },
      suggestedAction: `${lead.name}${lead.company ? ` (${lead.company})` : ''} is a HOT lead with no movement in over ${staleLeadDays * HIGH_VALUE_STALL_MULTIPLIER} days, owned by ${lead.owner.name}. Worth a personal check-in before it goes cold.`,
    });
  }
  return stalledHotLeads.length;
}

/** Staff explicitly asking for help (§4.7) — the one escalation trigger that
 * isn't computed by a rule, it's a person clicking a button on their own
 * task. Still goes through the same de-dup path as everything else. */
export async function flagTaskForHelp(organizationId: string, taskId: string, userId: string, userName: string, taskTitle: string, note: string | null) {
  return upsertEscalation({
    organizationId,
    kind: 'STAFF_FLAGGED',
    severity: 'WARNING',
    subjectUserId: userId,
    evidence: { taskId, userId, userName, taskTitle, note: note ?? null, flaggedAt: new Date().toISOString() },
    suggestedAction: `${userName} flagged "${taskTitle}" as needing management help${note ? `: ${note}` : '.'}`,
  });
}
