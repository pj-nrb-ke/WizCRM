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
  /** HOT/WARM/COLD off the underlying Lead, when there is one — the "which
   * leads are golden" signal PJ asked for (2026-07-11). */
  leadPriority: 'HOT' | 'WARM' | 'COLD' | null;
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
      select: { id: true, name: true, company: true, stage: true, ownerId: true, lastActivityAt: true, priority: true, createdAt: true },
      take: 300,
    }),
    prisma.task.findMany({
      where: { organizationId, completedAt: null, dueAt: { lt: now } },
      select: { id: true, title: true, userId: true, dueAt: true, leadId: true },
      take: 200,
    }),
    prisma.lead.findMany({
      where: { organizationId, createdAt: { lt: newLeadCutoff }, activities: { none: {} } },
      select: { id: true, name: true, company: true, ownerId: true, createdAt: true, priority: true },
      take: 200,
    }),
    prisma.calendarEvent.findMany({
      where: { organizationId, eventType: 'DEMO', startAt: { gte: todayStart, lte: todayEnd } },
      select: {
        id: true,
        title: true,
        userId: true,
        startAt: true,
        leadId: true,
        lead: { select: { name: true, priority: true } },
      },
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
      evidence: {
        leadId: l.id,
        stage: l.stage,
        lastActivityAt: l.lastActivityAt?.toISOString() ?? null,
        staleSinceDate: (l.lastActivityAt ?? l.createdAt).toISOString(),
      },
      leadPriority: l.priority,
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
      leadPriority: null,
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
      leadPriority: l.priority,
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
      leadPriority: e.lead?.priority ?? null,
    });
  }

  return candidates;
}

/**
 * "Which leads are golden" scoring (PJ, 2026-07-11): lead priority dominates
 * — a HOT lead beats a COLD one regardless of how long either has been
 * quiet — then rule urgency (a same-day demo outranks a merely-stale lead),
 * then how overdue it is as a tiebreaker. Deterministic and cheap; this is
 * the pre-filter that keeps the LLM's input bounded, not the final word —
 * the LLM still makes the last call within this ranked pool.
 */
function scoreCandidate(c: PlanCandidate): number {
  const priorityScore = c.leadPriority === 'HOT' ? 100 : c.leadPriority === 'WARM' ? 60 : c.leadPriority === 'COLD' ? 20 : 40;
  const ruleScore = c.rule === 'R4_DEMO_TODAY' ? 80 : c.rule === 'R3_NEW_LEAD_UNWORKED' ? 50 : 30;
  let stalenessBonus = 0;
  const staleSinceDate = (c.evidence as { staleSinceDate?: string }).staleSinceDate;
  if (staleSinceDate) {
    const daysStale = (Date.now() - new Date(staleSinceDate).getTime()) / (24 * 60 * 60 * 1000);
    stalenessBonus = Math.min(Math.round(daysStale), 30);
  }
  return priorityScore + ruleScore + stalenessBonus;
}

export type PlanItem = {
  rule: PlanCandidate['rule'];
  createsTask: boolean;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
  leadPriority: PlanCandidate['leadPriority'];
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
  dailyFocusCap: number;
  taskCapPerDay: number;
  rawCandidateCount: number;
  people: PersonPlan[];
};

/** How much headroom the LLM gets over the final cap to actually exercise
 * judgement (fit to roster responsibilities, etc.) rather than just
 * rubber-stamping the deterministic score order. */
const LLM_POOL_MULTIPLIER = 3;
const MIN_LLM_POOL = 20;

type RosterEntry = { id: string; name: string; responsibilities: string | null };

/** One LLM call across the WHOLE org, not one per person — "10 focused
 * things across the team" (PJ) is a single ranking problem, not N
 * independent per-person ones. The LLM may only pick from `pool` and must
 * respect each person's `taskCapPerDay`; it can never invent a candidate. */
async function selectOrgWideFocusList(
  pool: PlanCandidate[],
  roster: RosterEntry[],
  dailyFocusCap: number,
  taskCapPerDay: number,
  tone: string,
): Promise<{ index: number; title: string; reason: string }[]> {
  const client = createOpenAIClient();
  const rosterById = new Map(roster.map((r) => [r.id, r]));

  if (!client || pool.length === 0) {
    // Deterministic fallback: already sorted by score; just enforce caps.
    const perPersonCount = new Map<string, number>();
    const picked: { index: number; title: string; reason: string }[] = [];
    for (let i = 0; i < pool.length && picked.length < dailyFocusCap; i++) {
      const c = pool[i];
      const count = perPersonCount.get(c.assigneeUserId) ?? 0;
      if (count >= taskCapPerDay) continue;
      perPersonCount.set(c.assigneeUserId, count + 1);
      picked.push({ index: i, title: c.title, reason: c.reason });
    }
    return picked;
  }

  const input = JSON.stringify({
    dailyFocusCap,
    taskCapPerDay,
    tone,
    candidates: pool.map((c, i) => ({
      index: i,
      rule: c.rule,
      title: c.title,
      reason: c.reason,
      leadPriority: c.leadPriority,
      assignee: rosterById.get(c.assigneeUserId)?.name ?? 'Unknown',
      assigneeRole: rosterById.get(c.assigneeUserId)?.responsibilities ?? '(not set)',
    })),
  });

  const result = await chatJson<{ items: { index: number; title: string; reason: string }[] }>(
    client,
    `You are Wanjiru, a ${tone} sales manager. Pick the ${dailyFocusCap} most important items across the WHOLE team today from the candidate list — this is a hard cap, the team should focus on a short list, not a long one. Each candidate is already backed by real evidence (you cannot add one not in the list). Favour HOT leads over WARM over COLD, and same-day demos are time-critical. No single person should get more than ${taskCapPerDay} items even if they have more candidates than that. Rewrite each picked item's title and reason in one short, human, ${tone} sentence — same meaning, no invented facts. Return JSON: {"items": [{"index": number, "title": string, "reason": string}]}, ordered by priority, highest first, at most ${dailyFocusCap} items. Never include an index not present in the candidate list.`,
    input,
  );

  const perPersonCount = new Map<string, number>();
  const picked: { index: number; title: string; reason: string }[] = [];
  for (const it of result.items ?? []) {
    if (!Number.isInteger(it.index) || it.index < 0 || it.index >= pool.length) continue;
    if (picked.length >= dailyFocusCap) break;
    const c = pool[it.index];
    const count = perPersonCount.get(c.assigneeUserId) ?? 0;
    if (count >= taskCapPerDay) continue; // LLM told to respect this, but don't trust it blindly
    perPersonCount.set(c.assigneeUserId, count + 1);
    picked.push({ index: it.index, title: it.title || c.title, reason: it.reason || c.reason });
  }
  return picked;
}

export async function generateMorningPlan(organizationId: string, vsmConfig: VsmConfig): Promise<MorningPlan> {
  const candidates = await generateCandidates(organizationId);
  const roster = await prisma.user.findMany({
    where: { organizationId, isVirtual: false },
    select: { id: true, name: true, teamMemberProfile: { select: { responsibilities: true, managedByVsm: true } } },
  });
  const managed = new Set(roster.filter((r) => r.teamMemberProfile?.managedByVsm !== false).map((r) => r.id));
  const rosterEntries: RosterEntry[] = roster
    .filter((r) => managed.has(r.id))
    .map((r) => ({ id: r.id, name: r.name, responsibilities: r.teamMemberProfile?.responsibilities ?? null }));

  const taskCandidates = candidates.filter((c) => c.createsTask && managed.has(c.assigneeUserId));
  const carryover = candidates.filter((c) => !c.createsTask && managed.has(c.assigneeUserId));

  const poolSize = Math.max(vsmConfig.dailyFocusCap * LLM_POOL_MULTIPLIER, MIN_LLM_POOL);
  const scoredPool = [...taskCandidates].sort((a, b) => scoreCandidate(b) - scoreCandidate(a)).slice(0, poolSize);

  const selected = await selectOrgWideFocusList(scoredPool, rosterEntries, vsmConfig.dailyFocusCap, vsmConfig.taskCapPerDay, vsmConfig.tone);

  const itemsByPerson = new Map<string, PlanItem[]>();
  for (const sel of selected) {
    const c = scoredPool[sel.index];
    const item: PlanItem = {
      rule: c.rule,
      createsTask: true,
      title: sel.title,
      reason: sel.reason,
      evidence: c.evidence,
      leadPriority: c.leadPriority,
      included: true,
    };
    if (!itemsByPerson.has(c.assigneeUserId)) itemsByPerson.set(c.assigneeUserId, []);
    itemsByPerson.get(c.assigneeUserId)!.push(item);
  }

  const carryoverByPerson = new Map<string, PlanItem[]>();
  for (const c of carryover) {
    const item: PlanItem = {
      rule: c.rule,
      createsTask: false,
      title: c.title,
      reason: c.reason,
      evidence: c.evidence,
      leadPriority: c.leadPriority,
      included: true,
    };
    if (!carryoverByPerson.has(c.assigneeUserId)) carryoverByPerson.set(c.assigneeUserId, []);
    carryoverByPerson.get(c.assigneeUserId)!.push(item);
  }

  const people: PersonPlan[] = [];
  for (const user of rosterEntries) {
    const items = itemsByPerson.get(user.id) ?? [];
    const personCarryover = carryoverByPerson.get(user.id) ?? [];
    if (items.length === 0 && personCarryover.length === 0) continue;
    people.push({ userId: user.id, userName: user.name, items, carryover: personCarryover });
  }

  await prisma.aiAuditLog.create({
    data: {
      organizationId,
      userId: vsmConfig.vsmUserId,
      feature: 'vsm_morning_plan',
      model: config.openaiModel,
      promptVersion: config.aiPromptVersion,
      inputSummary: `${candidates.length} raw candidates, pool ${scoredPool.length}, cap ${vsmConfig.dailyFocusCap}`.slice(0, 2000),
      outputSummary: JSON.stringify(selected.map((s) => s.title)).slice(0, 2000),
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    dailyFocusCap: vsmConfig.dailyFocusCap,
    taskCapPerDay: vsmConfig.taskCapPerDay,
    rawCandidateCount: candidates.length,
    people,
  };
}
