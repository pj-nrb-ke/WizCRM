export type PersonalDashboardMetrics = {
  openLeads: number;
  tasksDue: number;
  staleLeads: number;
  upcomingEvents: number;
};

type LeadRow = {
  stage: string;
  updatedAt: string;
  lastActivityAt?: string | null;
};

type TaskRow = {
  dueAt: string | null;
  completedAt?: string | null;
};

type EventRow = {
  startAt: string;
};

function isClosedStage(stage: string) {
  return stage === 'WON' || stage === 'LOST';
}

export function buildPersonalMetrics(
  leads: LeadRow[],
  tasks: TaskRow[],
  events: EventRow[],
  now = new Date(),
): PersonalDashboardMetrics {
  const staleCutoffMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const dueCutoff = new Date(now);
  dueCutoff.setHours(23, 59, 59, 999);
  const upcomingCutoffMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const openLeads = leads.filter((lead) => !isClosedStage(lead.stage)).length;
  const staleLeads = leads.filter((lead) => {
    if (isClosedStage(lead.stage)) return false;
    const lastTouch = lead.lastActivityAt ?? lead.updatedAt;
    return new Date(lastTouch).getTime() <= staleCutoffMs;
  }).length;
  const tasksDue = tasks.filter((task) => {
    if (task.completedAt) return false;
    if (!task.dueAt) return false;
    return new Date(task.dueAt).getTime() <= dueCutoff.getTime();
  }).length;
  const upcomingEvents = events.filter((event) => {
    const startMs = new Date(event.startAt).getTime();
    return startMs >= nowMs && startMs <= upcomingCutoffMs;
  }).length;

  return { openLeads, tasksDue, staleLeads, upcomingEvents };
}
