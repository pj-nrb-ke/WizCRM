import type { Prisma } from '@prisma/client';
import {
  computeExpectedValue,
  type createSalesOpportunitySchema,
  type updateSalesOpportunitySchema,
} from '@wizcrm/shared';
import type { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type CreateInput = z.infer<typeof createSalesOpportunitySchema>;
type UpdateInput = z.infer<typeof updateSalesOpportunitySchema>;

export async function nextOpportunityReference(organizationId: string): Promise<string> {
  const count = await prisma.salesOpportunity.count({ where: { organizationId } });
  return `SFO${String(count + 1).padStart(3, '0')}`;
}

function enrichOpportunity<T extends { forecastedExcl: number | null; probabilityPct: number }>(
  row: T,
) {
  return {
    ...row,
    expectedValue: computeExpectedValue(row.forecastedExcl, row.probabilityPct),
  };
}

export async function listOpportunitiesForLead(leadId: string, organizationId: string) {
  const rows = await prisma.salesOpportunity.findMany({
    where: { leadId, lead: { organizationId } },
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map(enrichOpportunity);
}

export async function createSalesOpportunity(
  organizationId: string,
  ownerId: string,
  input: CreateInput,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, organizationId },
  });
  if (!lead) return null;

  const ref = await nextOpportunityReference(organizationId);
  const closeBy = input.closeBy ? new Date(input.closeBy) : new Date();
  const startDate = input.startDate ? new Date(input.startDate) : new Date();

  const opp = await prisma.salesOpportunity.create({
    data: {
      organizationId,
      leadId: input.leadId,
      ownerId,
      referenceNumber: ref,
      description: input.description,
      contactPerson: input.contactPerson ?? lead.name,
      isPublic: input.isPublic ?? true,
      oppStage: input.oppStage ?? 'NEW_OPPORTUNITY',
      oppStatus: input.oppStatus ?? 'NOT_STARTED',
      probabilityPct: input.probabilityPct ?? 10,
      sourceType: input.sourceType ?? 'OTHER',
      sourceDetail: input.sourceDetail,
      startDate,
      closeBy,
      actualClose: closeBy,
      budgeted: input.budgeted,
      forecastedExcl: input.forecastedExcl,
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  await prisma.activity.create({
    data: {
      leadId: input.leadId,
      userId: ownerId,
      type: 'SALES_OPPORTUNITY',
      subject: `Opportunity ${ref}`,
      body: input.description,
      metadata: { opportunityId: opp.id, action: 'created' } as Prisma.InputJsonValue,
    },
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: { lastActivityAt: new Date() },
  });

  return enrichOpportunity(opp);
}

export async function updateSalesOpportunity(
  id: string,
  organizationId: string,
  userId: string,
  input: UpdateInput,
) {
  const existing = await prisma.salesOpportunity.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return null;
  if (existing.isClosed) {
    throw Object.assign(new Error('Closed opportunities cannot be edited'), { statusCode: 400 });
  }

  const data: Prisma.SalesOpportunityUpdateInput = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.contactPerson !== undefined) data.contactPerson = input.contactPerson;
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.oppStage !== undefined) data.oppStage = input.oppStage;
  if (input.oppStatus !== undefined) {
    data.oppStatus = input.oppStatus;
    if (['WON', 'LOST', 'CANCELLED'].includes(input.oppStatus)) {
      data.isClosed = true;
      data.actualClose = input.actualClose
        ? new Date(input.actualClose)
        : new Date();
    }
  }
  if (input.probabilityPct !== undefined) data.probabilityPct = input.probabilityPct;
  if (input.sourceType !== undefined) data.sourceType = input.sourceType;
  if (input.sourceDetail !== undefined) data.sourceDetail = input.sourceDetail;
  if (input.startDate !== undefined) data.startDate = new Date(input.startDate);
  if (input.closeBy !== undefined) {
    const closeBy = new Date(input.closeBy);
    data.closeBy = closeBy;
    data.actualClose = closeBy;
  }
  if (input.actualClose !== undefined) data.actualClose = new Date(input.actualClose);
  if (input.budgeted !== undefined) data.budgeted = input.budgeted;
  if (input.forecastedExcl !== undefined) data.forecastedExcl = input.forecastedExcl;

  const opp = await prisma.salesOpportunity.update({
    where: { id },
    data,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  await prisma.activity.create({
    data: {
      leadId: existing.leadId,
      userId,
      type: 'SALES_OPPORTUNITY',
      subject: `Opportunity ${existing.referenceNumber} updated`,
      body: `Stage ${opp.oppStage}, status ${opp.oppStatus}, probability ${opp.probabilityPct}%`,
      metadata: { opportunityId: opp.id, action: 'updated' } as Prisma.InputJsonValue,
    },
  });

  await prisma.lead.update({
    where: { id: existing.leadId },
    data: { lastActivityAt: new Date() },
  });

  return enrichOpportunity(opp);
}
