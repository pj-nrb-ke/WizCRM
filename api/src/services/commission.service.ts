import type { CommissionBasisType, OpportunityCommissionView } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings } from './org-settings.service.js';

/** Rate to lock in right now for this salesperson — per-user override, else org default, else 0. */
async function resolveEffectiveRatePct(organizationId: string, salespersonId: string): Promise<number> {
  const [settings, user] = await Promise.all([
    getOrgSettings(organizationId),
    prisma.user.findUnique({ where: { id: salespersonId }, select: { commissionRatePct: true } }),
  ]);
  if (user?.commissionRatePct != null) return user.commissionRatePct;
  return settings.commissionDefaultRatePct ?? 0;
}

/**
 * Recompute the commission basis for an opportunity after a Quotation/Proforma
 * Invoice/Invoice document is uploaded. An Invoice always wins over a
 * Quotation/Proforma Invoice; within a tier, the latest document wins. Locks
 * in whatever rate is currently configured — never rewritten by later rate
 * edits, only by the next recomputation.
 */
export async function recomputeCommissionBasis(opportunityId: string, organizationId: string) {
  const opp = await prisma.salesOpportunity.findFirst({
    where: { id: opportunityId, organizationId },
    select: { id: true, ownerId: true },
  });
  if (!opp) return;

  const latestInvoice = await prisma.leadAttachment.findFirst({
    where: { opportunityId, documentType: 'INVOICE', amount: { not: null } },
    orderBy: { createdAt: 'desc' },
  });

  let basisType: CommissionBasisType | null = null;
  let basisAmount: number | null = null;
  let basisAttachmentId: string | null = null;

  if (latestInvoice) {
    basisType = 'INVOICE';
    basisAmount = Number(latestInvoice.amount);
    basisAttachmentId = latestInvoice.id;
  } else {
    const latestForecast = await prisma.leadAttachment.findFirst({
      where: {
        opportunityId,
        documentType: { in: ['QUOTATION', 'PROFORMA_INVOICE'] },
        amount: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (latestForecast) {
      basisType = latestForecast.documentType as CommissionBasisType;
      basisAmount = Number(latestForecast.amount);
      basisAttachmentId = latestForecast.id;
    }
  }

  if (basisType == null || basisAmount == null) return;

  const ratePct = await resolveEffectiveRatePct(organizationId, opp.ownerId);
  const computedAmount = Math.round(basisAmount * (ratePct / 100) * 100) / 100;

  await prisma.opportunityCommission.upsert({
    where: { opportunityId },
    create: {
      organizationId,
      opportunityId,
      salespersonId: opp.ownerId,
      basisType,
      basisAmount,
      basisAttachmentId,
      ratePctLocked: ratePct,
      forecastedAmount: basisType === 'INVOICE' ? null : computedAmount,
      dueAmount: basisType === 'INVOICE' ? computedAmount : null,
    },
    update: {
      salespersonId: opp.ownerId,
      basisType,
      basisAmount,
      basisAttachmentId,
      ratePctLocked: ratePct,
      forecastedAmount: basisType === 'INVOICE' ? null : computedAmount,
      dueAmount: basisType === 'INVOICE' ? computedAmount : null,
    },
  });
}

/** LPO uploaded — stamps the eligibility date once; a repeat LPO doesn't move it. */
export async function stampLpoCollectible(opportunityId: string, organizationId: string) {
  const opp = await prisma.salesOpportunity.findFirst({
    where: { id: opportunityId, organizationId },
    select: { id: true, ownerId: true },
  });
  if (!opp) return;

  const existing = await prisma.opportunityCommission.findUnique({ where: { opportunityId } });
  if (existing?.collectibleFromDate) return;

  await prisma.opportunityCommission.upsert({
    where: { opportunityId },
    create: { organizationId, opportunityId, salespersonId: opp.ownerId, collectibleFromDate: new Date() },
    update: { collectibleFromDate: new Date() },
  });
}

function deriveView(
  commission: {
    basisType: string | null;
    basisAmount: unknown;
    ratePctLocked: number | null;
    forecastedAmount: unknown;
    dueAmount: unknown;
    collectibleFromDate: Date | null;
  } | null,
  totalPaidByCustomer: number,
  paidOut: number,
): Omit<OpportunityCommissionView, 'hidden' | 'hiddenReason'> {
  const dueAmount = commission?.dueAmount != null ? Number(commission.dueAmount) : null;
  const forecastedAmount = commission?.forecastedAmount != null ? Number(commission.forecastedAmount) : null;
  const invoiceTotal = commission?.basisAmount != null ? Number(commission.basisAmount) : null;

  let collectibleAmount = 0;
  if (dueAmount != null && commission?.collectibleFromDate && commission.collectibleFromDate <= new Date()) {
    // Collectible only in proportion to what the customer has actually paid
    // against the invoice total — never against the (much smaller) commission
    // due amount, which would let a partial payment unlock the full commission.
    const paidRatio = Math.min(1, invoiceTotal && invoiceTotal > 0 ? totalPaidByCustomer / invoiceTotal : 0);
    collectibleAmount = Math.round(dueAmount * paidRatio * 100) / 100;
  }
  const pendingPayout = Math.max(0, Math.round((collectibleAmount - paidOut) * 100) / 100);

  return {
    basisType: (commission?.basisType as CommissionBasisType | null) ?? null,
    basisAmount: commission?.basisAmount != null ? Number(commission.basisAmount) : null,
    ratePctLocked: commission?.ratePctLocked ?? null,
    forecastedAmount,
    dueAmount,
    collectibleFromDate: commission?.collectibleFromDate?.toISOString() ?? null,
    totalPaidByCustomer,
    collectibleAmount,
    paidOut,
    pendingPayout,
  };
}

/** Full commission view for one opportunity, respecting the org/person hide switches. */
export async function getOpportunityCommissionView(
  opportunityId: string,
  organizationId: string,
): Promise<OpportunityCommissionView | null> {
  const opp = await prisma.salesOpportunity.findFirst({
    where: { id: opportunityId, organizationId },
    select: { id: true, ownerId: true, owner: { select: { commissionEnabled: true } } },
  });
  if (!opp) return null;

  const settings = await getOrgSettings(organizationId);
  if (settings.commissionEnabled === false) {
    return {
      hidden: true,
      hiddenReason: 'org',
      basisType: null,
      basisAmount: null,
      ratePctLocked: null,
      forecastedAmount: null,
      dueAmount: null,
      collectibleFromDate: null,
      totalPaidByCustomer: 0,
      collectibleAmount: 0,
      paidOut: 0,
      pendingPayout: 0,
    };
  }
  if (!opp.owner.commissionEnabled) {
    return {
      hidden: true,
      hiddenReason: 'person',
      basisType: null,
      basisAmount: null,
      ratePctLocked: null,
      forecastedAmount: null,
      dueAmount: null,
      collectibleFromDate: null,
      totalPaidByCustomer: 0,
      collectibleAmount: 0,
      paidOut: 0,
      pendingPayout: 0,
    };
  }

  const [commission, paymentAgg, payoutAgg] = await Promise.all([
    prisma.opportunityCommission.findUnique({ where: { opportunityId } }),
    prisma.opportunityCustomerPayment.aggregate({ where: { opportunityId }, _sum: { amount: true } }),
    prisma.opportunityCommissionPayout.aggregate({ where: { opportunityId }, _sum: { amount: true } }),
  ]);

  const totalPaidByCustomer = Number(paymentAgg._sum.amount ?? 0);
  const paidOut = Number(payoutAgg._sum.amount ?? 0);

  return {
    hidden: false,
    hiddenReason: null,
    ...deriveView(commission, totalPaidByCustomer, paidOut),
  };
}

export async function listCustomerPayments(opportunityId: string, organizationId: string) {
  const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opp) return null;
  return prisma.opportunityCustomerPayment.findMany({
    where: { opportunityId },
    orderBy: { date: 'desc' },
    include: { loggedBy: { select: { id: true, name: true } } },
  });
}

export async function createCustomerPayment(
  opportunityId: string,
  organizationId: string,
  userId: string,
  input: { amount: number; date?: string },
) {
  const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opp) return null;
  return prisma.opportunityCustomerPayment.create({
    data: {
      organizationId,
      opportunityId,
      amount: input.amount,
      date: input.date ? new Date(input.date) : new Date(),
      loggedById: userId,
    },
    include: { loggedBy: { select: { id: true, name: true } } },
  });
}

export async function listCommissionPayouts(opportunityId: string, organizationId: string) {
  const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, organizationId } });
  if (!opp) return null;
  return prisma.opportunityCommissionPayout.findMany({
    where: { opportunityId },
    orderBy: { date: 'desc' },
    include: { loggedBy: { select: { id: true, name: true } } },
  });
}

export async function createCommissionPayout(
  opportunityId: string,
  organizationId: string,
  userId: string,
  input: { amount: number; date?: string },
) {
  const view = await getOpportunityCommissionView(opportunityId, organizationId);
  if (!view) return null;
  if (view.hidden) return { error: 'COMMISSION_HIDDEN' as const };
  if (input.amount > view.pendingPayout + 0.005) {
    return { error: 'EXCEEDS_COLLECTIBLE' as const, pendingPayout: view.pendingPayout };
  }
  const payout = await prisma.opportunityCommissionPayout.create({
    data: {
      organizationId,
      opportunityId,
      amount: input.amount,
      date: input.date ? new Date(input.date) : new Date(),
      loggedById: userId,
    },
    include: { loggedBy: { select: { id: true, name: true } } },
  });
  return { payout };
}

/** Salesperson dashboard number — running pending commission across all of their opportunities. */
export async function getMyPendingCommission(userId: string, organizationId: string) {
  const settings = await getOrgSettings(organizationId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { commissionEnabled: true },
  });
  if (settings.commissionEnabled === false || !user?.commissionEnabled) {
    return { pendingCommission: 0, hidden: true };
  }

  const opportunities = await prisma.salesOpportunity.findMany({
    where: { organizationId, ownerId: userId },
    select: { id: true },
  });
  const ids = opportunities.map((o) => o.id);
  if (ids.length === 0) return { pendingCommission: 0, hidden: false };

  const [commissions, payments, payouts] = await Promise.all([
    prisma.opportunityCommission.findMany({ where: { opportunityId: { in: ids } } }),
    prisma.opportunityCustomerPayment.groupBy({ by: ['opportunityId'], where: { opportunityId: { in: ids } }, _sum: { amount: true } }),
    prisma.opportunityCommissionPayout.groupBy({ by: ['opportunityId'], where: { opportunityId: { in: ids } }, _sum: { amount: true } }),
  ]);
  const paidByOpp = new Map(payments.map((p) => [p.opportunityId, Number(p._sum.amount ?? 0)]));
  const payoutByOpp = new Map(payouts.map((p) => [p.opportunityId, Number(p._sum.amount ?? 0)]));

  let pendingCommission = 0;
  for (const c of commissions) {
    const view = deriveView(c, paidByOpp.get(c.opportunityId) ?? 0, payoutByOpp.get(c.opportunityId) ?? 0);
    pendingCommission += view.pendingPayout;
  }

  return { pendingCommission: Math.round(pendingCommission * 100) / 100, hidden: false };
}

/** Admin/Manager org-wide commission liability, broken down by salesperson. */
export async function getOrgCommissionLiability(organizationId: string) {
  const settings = await getOrgSettings(organizationId);
  if (settings.commissionEnabled === false) {
    return { enabled: false, bySalesperson: [] as never[] };
  }

  const salespeople = await prisma.user.findMany({
    where: { organizationId, isVirtual: false, commissionEnabled: true },
    select: { id: true, name: true },
  });
  const salespersonIds = salespeople.map((s) => s.id);
  if (salespersonIds.length === 0) return { enabled: true, bySalesperson: [] as never[] };

  const commissions = await prisma.opportunityCommission.findMany({
    where: { organizationId, salespersonId: { in: salespersonIds } },
  });
  const oppIds = commissions.map((c) => c.opportunityId);

  const [payments, payouts] = await Promise.all([
    prisma.opportunityCustomerPayment.groupBy({ by: ['opportunityId'], where: { opportunityId: { in: oppIds } }, _sum: { amount: true } }),
    prisma.opportunityCommissionPayout.groupBy({ by: ['opportunityId'], where: { opportunityId: { in: oppIds } }, _sum: { amount: true } }),
  ]);
  const paidByOpp = new Map(payments.map((p) => [p.opportunityId, Number(p._sum.amount ?? 0)]));
  const payoutByOpp = new Map(payouts.map((p) => [p.opportunityId, Number(p._sum.amount ?? 0)]));

  const bySalesperson = salespeople.map((sp) => {
    let forecasted = 0;
    let due = 0;
    let collectible = 0;
    let paid = 0;
    let pending = 0;
    for (const c of commissions.filter((row) => row.salespersonId === sp.id)) {
      const view = deriveView(c, paidByOpp.get(c.opportunityId) ?? 0, payoutByOpp.get(c.opportunityId) ?? 0);
      forecasted += view.forecastedAmount ?? 0;
      due += view.dueAmount ?? 0;
      collectible += view.collectibleAmount;
      paid += view.paidOut;
      pending += view.pendingPayout;
    }
    return {
      salespersonId: sp.id,
      salespersonName: sp.name,
      forecasted: Math.round(forecasted * 100) / 100,
      due: Math.round(due * 100) / 100,
      collectible: Math.round(collectible * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      pending: Math.round(pending * 100) / 100,
    };
  });

  return { enabled: true, bySalesperson };
}
