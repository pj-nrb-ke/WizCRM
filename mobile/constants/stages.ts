/** Mirror of @wizcrm/shared stages — local copy avoids bundler watching shared/dist. */
export const LEAD_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;
