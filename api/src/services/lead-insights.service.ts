import type { Lead, LeadPriority, LeadStage, Task } from '@prisma/client';

type LeadRow = Lead & {
  tasks: Pick<Task, 'dueAt' | 'completedAt'>[];
};

export type LeadInsights = {
  priority: LeadPriority | null;
  source: string | null;
  scores: {
    engagement: number;
    urgency: number;
    fit: number;
  };
  hygiene: string[];
};

export function buildLeadInsights(lead: LeadRow, staleDays = 7): LeadInsights {
  const hygiene: string[] = [];
  if (!lead.email && !lead.phone) hygiene.push('Missing email and phone');
  else if (!lead.email) hygiene.push('Missing email');
  else if (!lead.phone) hygiene.push('Missing phone');
  if (!lead.company) hygiene.push('Missing company');
  if (!lead.source) hygiene.push('Missing lead source');

  const now = Date.now();
  const last = lead.lastActivityAt?.getTime() ?? lead.createdAt.getTime();
  const daysIdle = (now - last) / (24 * 60 * 60 * 1000);

  if (daysIdle >= staleDays && !isClosed(lead.stage)) {
    hygiene.push(`Stale ${Math.floor(daysIdle)}d — follow up`);
  }
  if (lead.stage === 'NEW' && daysIdle >= 2) hygiene.push('New lead not contacted yet');

  const overdue = lead.tasks.filter((t) => !t.completedAt && t.dueAt && t.dueAt.getTime() <= now).length;
  if (overdue > 0) hygiene.push(`${overdue} overdue task(s)`);

  let urgency = 40;
  if (lead.priority === 'HOT') urgency += 35;
  if (lead.priority === 'WARM') urgency += 15;
  if (overdue > 0) urgency += 25;
  if (daysIdle >= staleDays) urgency += 20;
  if (lead.stage === 'NEGOTIATION' || lead.stage === 'PROPOSAL') urgency += 15;

  let engagement = 50;
  if (daysIdle <= 1) engagement += 30;
  else if (daysIdle <= 3) engagement += 15;
  else if (daysIdle >= 14) engagement -= 25;

  let fit = 55;
  if (lead.email && lead.phone) fit += 20;
  if (lead.company) fit += 10;
  if (lead.source) fit += 5;

  return {
    priority: lead.priority,
    source: lead.source,
    scores: {
      engagement: clamp(engagement),
      urgency: clamp(urgency),
      fit: clamp(fit),
    },
    hygiene,
  };
}

function isClosed(stage: LeadStage) {
  return stage === 'WON' || stage === 'LOST';
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}
