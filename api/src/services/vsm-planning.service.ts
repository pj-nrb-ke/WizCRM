import type { VsmConfig } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { getOrgSettings } from './org-settings.service.js';
import { createOpenAIClient, chatJson } from './ai/openai.provider.js';

/**
 * Deterministic rule layer (VSM-SPEC §4.3, §5.1: "grounded tasks only" — the
 * LLM may rank/phrase but never invent a candidate without one of these).
 * R1/R3/R4 produce a new Task if approved; R2 never does — an overdue task
 * already exists, so it's carried into the plan as a reminder, not
 * duplicated into a second task about the first one.
 */
export type PlanCandidate = {
  rule: 'R1_STALE_LEAD' | 'R2_OVERDUE_TASK' | 'R3_NEW_LEAD_UNWORKED' | 'R4_DEMO_TODAY';
  createsTask: boolean;
  assigneeUserId: string;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Has an open, VSM-created task already been raised for this same evidence?
 * Keeps the rule layer from re-suggesting the same stale lead every single
 * morning (VSM-SPEC §4.3: "deduplicated against open tasks"). */
async function alreadyOpenForEvidence(organizationId: string, key: 'leadId' | 'eventId', value: string) {
  const existing = await prisma.task.findFirst({
    where: {
      organizationId,
      source: 'VSM',
      completedAt: null,
      evidence: { path: [key], equals: value },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function generateCandidates(organizationId: string): Promise<PlanCandidate[]> {
  const settings = await getOrgSettings(organizationId);
  const staleLeadDays = settings.staleLeadDays ?? 7;
  const staleCutoff = new Date(Date.now() - staleLeadDays * 24 * 60 * 60 * 1000);
  const newLeadCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const [staleLeads, overdueTasks, unworkedLeads, demosToday] = await Promise.all([
    prisma.lead.findMany({
      where: {
        organizationId,
        stage: { notIn: ['WON', 'LOST'] },
        OR: [{ lastActivityAt: { lt: staleCutoff } }, { lastActivityAt: null, createdAt: { lt: staleCutoff } }],
      },
      select: { id: true, name: true, company: true, stage: true, ownerId: true, lastActivityAt: true },
      take: 200,
    }),
    prisma.task.findMany({
      where: { organizationId, completedAt: null, dueAt: { lt: now } },
      select: { id: true, title: true, userId: true, dueAt: true, leadId: true },
      take: 200,
    }),
    prisma.lead.findMany({
      where: { organizationId, createdAt: { lt: newLeadCutoff }, activities: { none: {} } },
      select: { id: true, name: true, company: true, ownerId: true, createdAt: true },
      take: 200,
    }),
    prisma.calendarEvent.findMany({
      where: { organizationId, eventType: 'DEMO', startAt: { gte: todayStart, lte: todayEnd } },
      select: { id: true, title: true, userId: true, startAt: true, leadId: true, lead: { select: { name: true } } },
      take: 100,
    }),
  ]);

  const candidates: PlanCandidate[] = [];

  for (const l of staleLeads) {
    if (await alreadyOpenForEvidence(organizationId, 'leadId', l.id)) continue;
    candidates.push({
      rule: 'R1_STALE_LEAD',
      createsTask: true,
      assigneeUserId: l.ownerId,
      title: `Follow up: ${l.name}${l.company ? ` (${l.company})` : ''}`,
      reason: `No activity since ${l.lastActivityAt?.toISOString().slice(0, 10) ?? 'lead creation'} — stage ${l.stage}`,
      evidence: { leadId: l.id, stage: l.stage, lastActivityAt: l.lastActivityAt?.toISOString() ?? null },
    });
  }

  for (const t of overdueTasks) {
    candidates.push({
      rule: 'R2_OVERDUE_TASK',
      createsTask: false,
      assigneeUserId: t.userId,
      title: t.title,
      reason: `Was due ${t.dueAt?.toISOString().slice(0, 10)}`,
      evidence: { taskId: t.id, leadId: t.leadId, dueAt: t.dueAt?.toISOString() ?? null },
    });
  }

  for (const l of unworkedLeads) {
    if (await alreadyOpenForEvidence(organizationId, 'leadId', l.id)) continue;
    candidates.push({
      rule: 'R3_NEW_LEAD_UNWORKED',
      createsTask: true,
      assigneeUserId: l.ownerId,
      title: `First touch: ${l.name}${l.company ? ` (${l.company})` : ''}`,
      reason: `Created ${l.createdAt.toISOString().slice(0, 10)}, no activity logged yet`,
      evidence: { leadId: l.id, createdAt: l.createdAt.toISOString() },
    });
  }

  for (const e of demosToday) {
    if (await alreadyOpenForEvidence(organizationId, 'eventId', e.id)) continue;
    candidates.push({
      rule: 'R4_DEMO_TODAY',
      createsTask: true,
      assigneeUserId: e.userId,
      title: `Prep for demo: ${e.lead?.name ?? e.title}`,
      reason: `Demo today at ${e.startAt.toISOString().slice(11, 16)} UTC`,
      evidence: { eventId: e.id, leadId: e.leadId, startAt: e.startAt.toISOString() },
    });
  }

  return candidates;
}

export type PlanItem = {
  rule: PlanCandidate['rule'];
  createsTask: boolean;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
  included: boolean;
};

export type PersonPlan = {
  userId: string;
  userName: string;
  items: PlanItem[];
  carryover: PlanItem[];
};

export type MorningPlan = {
  generatedAt: string;
  taskCapPerDay: number;
  people: PersonPlan[];
};

const MAX_CANDIDATES_PER_PERSON_TO_LLM = 15;

/** LLM ranks/phrases within the cap — it never adds a candidate that isn't
 * already in `taskCandidates` (VSM-SPEC §4.3 grounding rule), so a bad LLM
 * response can only drop or reorder items, never fabricate one. */
async function rankAndPhrase(
  personName: string,
  responsibilities: string | null,
  taskCandidates: PlanCandidate[],
  cap: number,
  tone: string,
): Promise<{ selectedIndexes: number[]; titles: string[]; reasons: string[] }> {
  const client = createOpenAIClient();
  if (!client || taskCandidates.length === 0) {
    const selected = taskCandidates.slice(0, cap);
    return {
      selectedIndexes: selected.map((_, i) => i),
      titles: selected.map((c) => c.title),
      reasons: selected.map((c) => c.reason),
    };
  }

  const input = JSON.stringify({
    person: personName,
    responsibilities: responsibilities ?? '(not set)',
    cap,
    tone,
    candidates: taskCandidates.map((c, i) => ({ index: i, rule: c.rule, title: c.title, reason: c.reason })),
  });

  const result = await chatJson<{ items: { index: number; title: string; reason: string }[] }>(
    client,
    `You are Wanjiru, a ${tone} sales manager assistant. Given a person's candidate tasks (each already backed by real evidence — you cannot add tasks not in the list), pick at most ${cap} of the most important, considering their role. Rewrite each picked item's title and reason in one short, human, ${tone} sentence — keep the same meaning, no invented facts. Return JSON: {"items": [{"index": number, "title": string, "reason": string}]} ordered by priority, highest first. Never include an index not present in the candidate list.`,
    input,
  );

  const valid = (result.items ?? []).filter((it) => Number.isInteger(it.index) && it.index >= 0 && it.index < taskCandidates.length).slice(0, cap);
  return {
    selectedIndexes: valid.map((it) => it.index),
    titles: valid.map((it) => it.title || taskCandidates[it.index].title),
    reasons: valid.map((it) => it.reason || taskCandidates[it.index].reason),
  };
}

export async function generateMorningPlan(organizationId: string, vsmConfig: VsmConfig): Promise<MorningPlan> {
  const candidates = await generateCandidates(organizationId);
  const roster = await prisma.user.findMany({
    where: { organizationId, isVirtual: false },
    select: { id: true, name: true, teamMemberProfile: { select: { responsibilities: true, managedByVsm: true } } },
  });
  const managed = new Set(roster.filter((r) => r.teamMemberProfile?.managedByVsm !== false).map((r) => r.id));

  const byPerson = new Map<string, PlanCandidate[]>();
  for (const c of candidates) {
    if (!managed.has(c.assigneeUserId)) continue;
    if (!byPerson.has(c.assigneeUserId)) byPerson.set(c.assigneeUserId, []);
    byPerson.get(c.assigneeUserId)!.push(c);
  }

  const people: PersonPlan[] = [];
  for (const user of roster) {
    if (!managed.has(user.id)) continue;
    const all = byPerson.get(user.id) ?? [];
    const taskCandidates = all.filter((c) => c.createsTask).slice(0, MAX_CANDIDATES_PER_PERSON_TO_LLM);
    const carryoverCandidates = all.filter((c) => !c.createsTask);
    if (taskCandidates.length === 0 && carryoverCandidates.length === 0) continue;

    const ranked = await rankAndPhrase(
      user.name,
      user.teamMemberProfile?.responsibilities ?? null,
      taskCandidates,
      vsmConfig.taskCapPerDay,
      vsmConfig.tone,
    );

    const items: PlanItem[] = ranked.selectedIndexes.map((idx, i) => ({
      rule: taskCandidates[idx].rule,
      createsTask: true,
      title: ranked.titles[i],
      reason: ranked.reasons[i],
      evidence: taskCandidates[idx].evidence,
      included: true,
    }));

    people.push({
      userId: user.id,
      userName: user.name,
      items,
      carryover: carryoverCandidates.map((c) => ({
        rule: c.rule,
        createsTask: false,
        title: c.title,
        reason: c.reason,
        evidence: c.evidence,
        included: true,
      })),
    });
  }

  await prisma.aiAuditLog.create({
    data: {
      organizationId,
      userId: vsmConfig.vsmUserId,
      feature: 'vsm_morning_plan',
      model: config.openaiModel,
      promptVersion: config.aiPromptVersion,
      inputSummary: `${candidates.length} candidates across ${people.length} people`.slice(0, 2000),
      outputSummary: JSON.stringify(people.map((p) => ({ userId: p.userId, count: p.items.length }))).slice(0, 2000),
    },
  });

  return { generatedAt: new Date().toISOString(), taskCapPerDay: vsmConfig.taskCapPerDay, people };
}
