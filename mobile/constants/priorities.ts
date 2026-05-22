export const LEAD_PRIORITIES = ['HOT', 'WARM', 'COLD'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export function priorityLabel(p: LeadPriority | null | undefined) {
  if (!p) return '';
  if (p === 'HOT') return '🔥 Hot';
  if (p === 'WARM') return 'Warm';
  return 'Cold';
}
