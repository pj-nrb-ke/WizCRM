import { prisma } from '../lib/prisma.js';

export type LeadCostRollup = {
  budgeted: number;
  spent: number;
  revenue: number;
  margin: number;
  opportunityCount: number;
};

export type OrgCostRollup = {
  budgeted: number;
  spent: number;
  revenue: number;
  margin: number;
  overBudgetOpportunities: { id: string; referenceNumber: string; leadName: string; budgeted: number; spent: number }[];
};

async function sumExpensesByOpportunity(opportunityIds: string[]) {
  if (opportunityIds.length === 0) return new Map<string, number>();
  const rows = await prisma.opportunityExpense.groupBy({
    by: ['opportunityId'],
    where: { opportunityId: { in: opportunityIds } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.opportunityId, Number(r._sum.amount ?? 0)]));
}

async function sumRevenueByOpportunity(opportunityIds: string[]) {
  if (opportunityIds.length === 0) return new Map<string, number>();
  const rows = await prisma.leadAttachment.groupBy({
    by: ['opportunityId'],
    where: { opportunityId: { in: opportunityIds }, documentType: 'INVOICE' },
    _sum: { amount: true },
  });
  return new Map(
    rows
      .filter((r) => r.opportunityId != null)
      .map((r) => [r.opportunityId as string, Number(r._sum.amount ?? 0)]),
  );
}

export async function getLeadCostRollup(leadId: string, organizationId: string): Promise<LeadCostRollup> {
  const opportunities = await prisma.salesOpportunity.findMany({
    where: { leadId, organizationId },
    select: { id: true, budgeted: true },
  });
  const ids = opportunities.map((o) => o.id);
  const [spentByOpp, revenueByOpp] = await Promise.all([
    sumExpensesByOpportunity(ids),
    sumRevenueByOpportunity(ids),
  ]);

  const budgeted = opportunities.reduce((sum, o) => sum + (o.budgeted ?? 0), 0);
  const spent = [...spentByOpp.values()].reduce((sum, v) => sum + v, 0);
  const revenue = [...revenueByOpp.values()].reduce((sum, v) => sum + v, 0);

  return {
    budgeted,
    spent,
    revenue,
    margin: revenue - spent,
    opportunityCount: opportunities.length,
  };
}

export async function getOrgCostRollup(organizationId: string): Promise<OrgCostRollup> {
  const opportunities = await prisma.salesOpportunity.findMany({
    where: { organizationId },
    select: { id: true, referenceNumber: true, budgeted: true, lead: { select: { name: true } } },
  });
  const ids = opportunities.map((o) => o.id);
  const [spentByOpp, revenueByOpp] = await Promise.all([
    sumExpensesByOpportunity(ids),
    sumRevenueByOpportunity(ids),
  ]);

  let budgeted = 0;
  let spent = 0;
  let revenue = 0;
  const overBudgetOpportunities: OrgCostRollup['overBudgetOpportunities'] = [];

  for (const o of opportunities) {
    const oppSpent = spentByOpp.get(o.id) ?? 0;
    const oppRevenue = revenueByOpp.get(o.id) ?? 0;
    budgeted += o.budgeted ?? 0;
    spent += oppSpent;
    revenue += oppRevenue;
    if (o.budgeted != null && oppSpent > o.budgeted) {
      overBudgetOpportunities.push({
        id: o.id,
        referenceNumber: o.referenceNumber,
        leadName: o.lead.name,
        budgeted: o.budgeted,
        spent: oppSpent,
      });
    }
  }

  return {
    budgeted,
    spent,
    revenue,
    margin: revenue - spent,
    overBudgetOpportunities,
  };
}
