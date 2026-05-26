import type { Prisma } from '@prisma/client';
import type { CreateQuotationInput, QuotationLine, UpdateQuotationInput } from '@wizcrm/shared';
import { computeQuotationTotals } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';

export async function listQuotationsForLead(leadId: string, organizationId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return null;
  return prisma.quotation.findMany({
    where: { leadId, organizationId },
    orderBy: { updatedAt: 'desc' },
    include: { owner: { select: { id: true, name: true } } },
  });
}

async function nextReference(organizationId: string) {
  const count = await prisma.quotation.count({ where: { organizationId } });
  const year = new Date().getFullYear();
  return `Q-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function createQuotation(
  organizationId: string,
  userId: string,
  input: CreateQuotationInput,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId },
  });
  if (!lead) return null;

  const taxRatePct = input.taxRatePct ?? 0;
  const totals = computeQuotationTotals(input.lines, taxRatePct);
  const ref = input.referenceNumber?.trim() || (await nextReference(organizationId));

  return prisma.quotation.create({
    data: {
      organizationId,
      leadId: input.leadId,
      ownerId: userId,
      referenceNumber: ref,
      status: input.status ?? 'DRAFT',
      taxRatePct,
      subtotal: totals.subtotal,
      taxAmount: totals.tax,
      total: totals.total,
      lines: input.lines as unknown as Prisma.InputJsonValue,
      notes: input.notes?.trim() || null,
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
    },
    include: { owner: { select: { id: true, name: true } } },
  });
}

export async function updateQuotation(
  id: string,
  organizationId: string,
  input: UpdateQuotationInput,
) {
  const existing = await prisma.quotation.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return null;

  const lines = (input.lines ?? existing.lines) as QuotationLine[];
  const taxRatePct = input.taxRatePct ?? existing.taxRatePct;
  const totals = computeQuotationTotals(lines, taxRatePct);

  return prisma.quotation.update({
    where: { id },
    data: {
      status: input.status,
      taxRatePct: input.taxRatePct,
      notes: input.notes === undefined ? undefined : input.notes?.trim() || null,
      validUntil:
        input.validUntil === undefined
          ? undefined
          : input.validUntil
            ? new Date(input.validUntil)
            : null,
      lines: input.lines ? (input.lines as unknown as Prisma.InputJsonValue) : undefined,
      subtotal: totals.subtotal,
      taxAmount: totals.tax,
      total: totals.total,
    },
    include: { owner: { select: { id: true, name: true } } },
  });
}
