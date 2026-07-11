import type { EscalationKind, EscalationSeverity } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/** Consecutive silent working days before REP_UNRESPONSIVE fires
 * (VSM-SPEC §4.7: "≥ 2 consecutive working days"). */
const SILENCE_ESCALATION_THRESHOLD = 2;

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

/** Called once per person per EOD run. Updates the silence streak and, once
 * it crosses the threshold, raises/refreshes a REP_UNRESPONSIVE escalation.
 * A person who moves anything resets to 0 — this is about sustained silence,
 * not one quiet afternoon (§4.6: an explained absence isn't silence either,
 * but that check belongs to the Meeting Room's absence flow, Phase 4). */
export async function updateSilenceStreak(
  organizationId: string,
  userId: string,
  userName: string,
  hadMovementToday: boolean,
): Promise<{ streak: number; escalated: boolean }> {
  const profile = await prisma.teamMemberProfile.findUnique({ where: { userId } });
  const nextStreak = hadMovementToday ? 0 : (profile?.silentStreak ?? 0) + 1;

  await prisma.teamMemberProfile.updateMany({ where: { userId }, data: { silentStreak: nextStreak } });

  if (nextStreak < SILENCE_ESCALATION_THRESHOLD) {
    return { streak: nextStreak, escalated: false };
  }

  await upsertEscalation({
    organizationId,
    kind: 'REP_UNRESPONSIVE',
    severity: nextStreak >= SILENCE_ESCALATION_THRESHOLD + 2 ? 'CRITICAL' : 'WARNING',
    subjectUserId: userId,
    evidence: { userId, userName, silentStreak: nextStreak, asOf: new Date().toISOString() },
    suggestedAction: `${userName} has had no task movement for ${nextStreak} consecutive working days. Check in personally, or reassign their open accounts.`,
  });
  return { streak: nextStreak, escalated: true };
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
