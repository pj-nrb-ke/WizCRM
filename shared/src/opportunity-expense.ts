import { z } from 'zod';

export const EXPENSE_CATEGORIES = ['TRAVEL', 'SAMPLES', 'LABOR', 'OTHER'] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRAVEL: 'Travel',
  SAMPLES: 'Samples',
  LABOR: 'Labor',
  OTHER: 'Other',
};

export const createOpportunityExpenseSchema = z.object({
  description: z.string().min(1).max(300),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amount: z.number().positive().max(999_999_999),
  date: z.string().datetime().optional(),
  receiptAttachmentId: z.string().uuid().optional(),
});

export const updateOpportunityExpenseSchema = createOpportunityExpenseSchema.partial();

export type CreateOpportunityExpenseInput = z.infer<typeof createOpportunityExpenseSchema>;
export type UpdateOpportunityExpenseInput = z.infer<typeof updateOpportunityExpenseSchema>;

export type OpportunityCostSummary = {
  budgeted: number | null;
  spent: number;
  remaining: number | null;
  revenue: number;
  margin: number | null;
  overBudget: boolean;
};
