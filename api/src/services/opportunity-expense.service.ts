import type { Prisma } from '@prisma/client';
import type {
  CreateOpportunityExpenseInput,
  OpportunityCostSummary,
  UpdateOpportunityExpenseInput,
} from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';

const userSelect = { id: true, name: true } as const;

export async function listOpportunityExpenses(opportunityId: string, organizationId: string) {
  const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opp) return null;
  return prisma.opportunityExpense.findMany({
    where: { opportunityId },
    orderBy: { date: 'desc' },
    include: { loggedBy: { select: userSelect } },
  });
}

export async function createOpportunityExpense(
  opportunityId: string,
  organizationId: string,
  userId: string,
  input: CreateOpportunityExpenseInput,
) {
  const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opp) return null;
  if (opp.ownerId !== userId) {
    return { error: 'NOT_OWNER' as const };
  }

  if (input.receiptAttachmentId) {
    const receipt = await prisma.leadAttachment.findFirst({
      where: { id: input.receiptAttachmentId, opportunityId },
    });
    if (!receipt) return { error: 'RECEIPT_NOT_FOUND' as const };
  }

  const expense = await prisma.opportunityExpense.create({
    data: {
      organizationId,
      opportunityId,
      description: input.description,
      category: input.category ?? 'OTHER',
      amount: input.amount,
      date: input.date ? new Date(input.date) : new Date(),
      loggedById: userId,
      receiptAttachmentId: input.receiptAttachmentId,
    },
    include: { loggedBy: { select: userSelect } },
  });
  return { expense };
}

export async function updateOpportunityExpense(
  expenseId: string,
  organizationId: string,
  userId: string,
  role: string,
  input: UpdateOpportunityExpenseInput,
) {
  const existing = await prisma.opportunityExpense.findFirst({
    where: { id: expenseId, organizationId },
  });
  if (!existing) return null;
  const manager = role === 'MANAGER' || role === 'ADMIN';
  if (existing.loggedById !== userId && !manager) {
    return { error: 'FORBIDDEN' as const };
  }

  const data: Prisma.OpportunityExpenseUpdateInput = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.date !== undefined) data.date = new Date(input.date);

  const expense = await prisma.opportunityExpense.update({
    where: { id: expenseId },
    data,
    include: { loggedBy: { select: userSelect } },
  });
  return { expense };
}

export async function deleteOpportunityExpense(
  expenseId: string,
  organizationId: string,
  userId: string,
  role: string,
) {
  const existing = await prisma.opportunityExpense.findFirst({
    where: { id: expenseId, organizationId },
  });
  if (!existing) return null;
  const manager = role === 'MANAGER' || role === 'ADMIN';
  if (existing.loggedById !== userId && !manager) {
    return { error: 'FORBIDDEN' as const };
  }
  await prisma.opportunityExpense.delete({ where: { id: expenseId } });
  return { ok: true };
}

export async function getOpportunityCostSummary(
  opportunityId: string,
  organizationId: string,
): Promise<OpportunityCostSummary | null> {
  const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opp) return null;

  const [expenseAgg, invoiceAgg] = await Promise.all([
    prisma.opportunityExpense.aggregate({
      where: { opportunityId },
      _sum: { amount: true },
    }),
    prisma.leadAttachment.aggregate({
      where: { opportunityId, documentType: 'INVOICE' },
      _sum: { amount: true },
    }),
  ]);

  const budgeted = opp.budgeted ?? null;
  const spent = Number(expenseAgg._sum.amount ?? 0);
  const revenue = Number(invoiceAgg._sum.amount ?? 0);
  const remaining = budgeted != null ? budgeted - spent : null;
  const margin = revenue - spent;

  return {
    budgeted,
    spent,
    remaining,
    revenue,
    margin,
    overBudget: budgeted != null && spent > budgeted,
  };
}
