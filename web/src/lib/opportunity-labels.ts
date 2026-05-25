export const SALES_OPP_STAGES = [
  'NEW_OPPORTUNITY',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED',
] as const;

export const SALES_OPP_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PENDING',
  'WON',
  'LOST',
  'CANCELLED',
] as const;

export const OPPORTUNITY_SOURCE_TYPES = [
  'OTHER',
  'REFERRAL',
  'CAMPAIGN',
  'EXISTING_CUSTOMER',
  'WEBSITE',
  'AGENT',
] as const;

export const SALES_OPP_STAGE_LABELS: Record<string, string> = {
  NEW_OPPORTUNITY: 'New opportunity',
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED: 'Closed',
};

export const SALES_OPP_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PENDING: 'Pending',
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
};
