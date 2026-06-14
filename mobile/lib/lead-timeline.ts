export type TimelineActivity = {
  id: string;
  type: string;
  subject?: string | null;
  body: string;
  createdAt: string;
  userName?: string;
};

export type TimelineStageChange = {
  id: string;
  fromStage: string;
  toStage: string;
  note: string | null;
  createdAt: string;
  userName: string;
};

export type TimelineItem =
  | { kind: 'activity'; at: string; data: TimelineActivity }
  | { kind: 'stage'; at: string; data: TimelineStageChange };

export function mergeLeadTimeline(
  activities: TimelineActivity[],
  stageChanges: TimelineStageChange[],
): TimelineItem[] {
  return [
    ...activities.map((a) => ({ kind: 'activity' as const, at: a.createdAt, data: a })),
    ...stageChanges.map((s) => ({ kind: 'stage' as const, at: s.createdAt, data: s })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
