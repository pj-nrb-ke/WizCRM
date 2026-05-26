import { z } from 'zod';

export const QUOTATION_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

export const quotationLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999_999),
  unitPrice: z.number().nonnegative().max(999_999_999),
  discountPct: z.number().min(0).max(100).optional(),
});

export const createQuotationSchema = z.object({
  leadId: z.string().uuid(),
  referenceNumber: z.string().min(1).max(40).optional(),
  status: z.enum(QUOTATION_STATUSES).optional(),
  taxRatePct: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).optional(),
  validUntil: z.string().datetime().optional(),
  followUpAt: z.string().datetime().optional(),
  lines: z.array(quotationLineSchema).min(1).max(50),
});

export const updateQuotationSchema = z.object({
  status: z.enum(QUOTATION_STATUSES).optional(),
  taxRatePct: z.number().min(0).max(100).optional(),
  notes: z.string().max(5000).nullable().optional(),
  validUntil: z.string().datetime().nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  lines: z.array(quotationLineSchema).min(1).max(50).optional(),
});

export const webhookLeadSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(30).optional(),
  source: z.string().max(100).optional(),
  ownerEmail: z.string().email().optional(),
});

export type QuotationLine = z.infer<typeof quotationLineSchema>;
export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type WebhookLeadInput = z.infer<typeof webhookLeadSchema>;

export function computeQuotationTotals(
  lines: QuotationLine[],
  taxRatePct = 0,
): { subtotal: number; tax: number; total: number } {
  const subtotal = lines.reduce((sum, line) => {
    const disc = line.discountPct ?? 0;
    const lineTotal = line.quantity * line.unitPrice * (1 - disc / 100);
    return sum + lineTotal;
  }, 0);
  const tax = subtotal * (taxRatePct / 100);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round((subtotal + tax) * 100) / 100,
  };
}
