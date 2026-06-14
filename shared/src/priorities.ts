export const LEAD_PRIORITIES = ['HOT', 'WARM', 'COLD'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export function isLeadPriority(value: string): value is LeadPriority {
  return (LEAD_PRIORITIES as readonly string[]).includes(value);
}
