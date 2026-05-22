import type { Lead, Activity, Task } from '@prisma/client';

type LeadRow = Lead & {
  activities: Pick<Activity, 'type' | 'createdAt'>[];
  tasks: Pick<Task, 'title' | 'dueAt' | 'completedAt'>[];
};

export type DeskItem = { leadId: string; title: string; reason: string };

const MS_DAY = 24 * 60 * 60 * 1000;

/** Rules-based desk when LLM returns few/no items (LITE-005 fallback). */
export function buildRulesDesk(leads: LeadRow[]): DeskItem[] {
  const now = Date.now();
  const items: DeskItem[] = [];

  for (const lead of leads) {
    for (const task of lead.tasks) {
      if (task.completedAt || !task.dueAt) continue;
      if (new Date(task.dueAt).getTime() <= now) {
        items.push({
          leadId: lead.id,
          title: `Task due: ${lead.name}`,
          reason: task.title,
        });
      }
    }

    const last = lead.lastActivityAt?.getTime() ?? lead.createdAt.getTime();
    const daysIdle = (now - last) / MS_DAY;
    if (daysIdle >= 3 && lead.stage !== 'WON' && lead.stage !== 'LOST') {
      items.push({
        leadId: lead.id,
        title: `Follow up: ${lead.name}`,
        reason:
          daysIdle >= 7
            ? `No activity for ${Math.floor(daysIdle)} days`
            : `Check in (${lead.stage})`,
      });
    }

    if (lead.stage === 'NEW' && daysIdle < 1) {
      items.push({
        leadId: lead.id,
        title: `First contact: ${lead.name}`,
        reason: 'New lead — make first call or email',
      });
    }
  }

  const seen = new Set<string>();
  const unique: DeskItem[] = [];
  for (const item of items) {
    const key = `${item.leadId}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 5);
}

/** Pro/Lite+ desk: up to 8 items including stale and priority-hot leads. */
export function buildExtendedDesk(leads: LeadRow[]): DeskItem[] {
  const base = buildRulesDesk(leads);
  const now = Date.now();
  const extras: DeskItem[] = [];

  for (const lead of leads) {
    if (lead.priority === 'HOT') {
      extras.push({
        leadId: lead.id,
        title: `Hot: ${lead.name}`,
        reason: lead.source ? `Source: ${lead.source}` : 'Priority lead',
      });
    }
    const last = lead.lastActivityAt?.getTime() ?? lead.createdAt.getTime();
    const daysIdle = (now - last) / MS_DAY;
    if (daysIdle >= 7 && lead.stage !== 'WON' && lead.stage !== 'LOST') {
      extras.push({
        leadId: lead.id,
        title: `Stale: ${lead.name}`,
        reason: `No activity ${Math.floor(daysIdle)} days (${lead.stage})`,
      });
    }
  }

  const seen = new Set<string>();
  const merged: DeskItem[] = [];
  for (const item of [...base, ...extras]) {
    const key = item.title.startsWith('Task due:') ? `due:${item.leadId}` : item.leadId;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged.slice(0, 8);
}

/** Ensure overdue tasks from rules appear even when LLM desk returns other picks. */
export function mergeDueTasksIntoDesk(primary: DeskItem[], rules: DeskItem[]): DeskItem[] {
  const dueFromRules = rules.filter((i) => i.title.startsWith('Task due:'));
  const seen = new Set<string>();
  const merged: DeskItem[] = [];
  for (const item of dueFromRules) {
    if (seen.has(item.leadId)) continue;
    merged.push(item);
    seen.add(item.leadId);
  }
  for (const item of primary) {
    if (seen.has(item.leadId)) continue;
    merged.push(item);
    seen.add(item.leadId);
  }
  return merged.slice(0, 8);
}
