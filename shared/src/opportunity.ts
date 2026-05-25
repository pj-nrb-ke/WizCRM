import { z } from 'zod';

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

export type SalesOppStage = (typeof SALES_OPP_STAGES)[number];
export type SalesOppStatus = (typeof SALES_OPP_STATUSES)[number];

export const SALES_OPP_STAGE_LABELS: Record<SalesOppStage, string> = {
  NEW_OPPORTUNITY: 'New opportunity',
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED: 'Closed',
};

export const SALES_OPP_STATUS_LABELS: Record<SalesOppStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PENDING: 'Pending',
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
};

export const createSalesOpportunitySchema = z.object({
  leadId: z.string().uuid(),
  description: z.string().min(1).max(500),
  contactPerson: z.string().max(200).optional(),
  isPublic: z.boolean().optional(),
  oppStage: z.enum(SALES_OPP_STAGES).optional(),
  oppStatus: z.enum(SALES_OPP_STATUSES).optional(),
  probabilityPct: z.number().min(0).max(100).optional(),
  sourceType: z.enum(OPPORTUNITY_SOURCE_TYPES).optional(),
  sourceDetail: z.string().max(200).optional(),
  startDate: z.string().datetime().optional(),
  closeBy: z.string().datetime().optional(),
  budgeted: z.number().min(0).optional(),
  forecastedExcl: z.number().min(0).optional(),
});

export const updateSalesOpportunitySchema = createSalesOpportunitySchema
  .omit({ leadId: true })
  .partial()
  .extend({
    actualClose: z.string().datetime().optional(),
  });

export function computeExpectedValue(forecastedExcl: number | null | undefined, probabilityPct: number) {
  if (forecastedExcl == null || Number.isNaN(forecastedExcl)) return null;
  return Math.round(forecastedExcl * (probabilityPct / 100) * 100) / 100;
}
