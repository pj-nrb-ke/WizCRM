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
