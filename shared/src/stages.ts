export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const TERMINAL_STAGES: LeadStage[] = ['WON', 'LOST'];

export function isLeadStage(value: string): value is LeadStage {
  return (LEAD_STAGES as readonly string[]).includes(value);
}

/** Forward progression; reopening LOST is allowed explicitly in API. */
export function isAllowedStageTransition(from: LeadStage, to: LeadStage): boolean {
  if (from === to) return true;
  if (to === 'LOST') return from !== 'WON';
  if (from === 'LOST') return true;
  /** Reopen closed-won deals back into the pipeline (clears won fields in API). */
  if (from === 'WON') return to !== 'WON';
  const fromIdx = LEAD_STAGES.indexOf(from);
  const toIdx = LEAD_STAGES.indexOf(to);
  return toIdx >= fromIdx;
}
