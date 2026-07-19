import { z } from 'zod';

export const COMMISSION_BASIS_TYPES = ['QUOTATION', 'PROFORMA_INVOICE', 'INVOICE'] as const;
export type CommissionBasisType = (typeof COMMISSION_BASIS_TYPES)[number];

export const updateOrgCommissionSettingsSchema = z.object({
  commissionEnabled: z.boolean().optional(),
  commissionDefaultRatePct: z.number().min(0).max(100).optional(),
});

export const updateUserCommissionSettingsSchema = z.object({
  commissionEnabled: z.boolean().optional(),
  /** null clears the per-user override so the org default applies. */
  commissionRatePct: z.number().min(0).max(100).nullable().optional(),
});

export const createCustomerPaymentSchema = z.object({
  amount: z.number().positive().max(999_999_999),
  date: z.string().datetime().optional(),
});

export const createCommissionPayoutSchema = z.object({
  amount: z.number().positive().max(999_999_999),
  date: z.string().datetime().optional(),
});

export type OpportunityCommissionView = {
  hidden: boolean;
  hiddenReason: 'org' | 'person' | null;
  basisType: CommissionBasisType | null;
  basisAmount: number | null;
  ratePctLocked: number | null;
  forecastedAmount: number | null;
  dueAmount: number | null;
  collectibleFromDate: string | null;
  totalPaidByCustomer: number;
  collectibleAmount: number;
  paidOut: number;
  pendingPayout: number;
};
