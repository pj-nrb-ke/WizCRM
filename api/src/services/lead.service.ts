import type { LeadStage, Prisma } from '@prisma/client';
import { isAllowedStageTransition, isPipelineDragTransition } from '@wizcrm/shared';
import type { CreateLeadInput, UpdateLeadInput } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { findDuplicateLeads, normalizeEmail } from './duplicate.service.js';
import { normalizePhone, sanitizeStringList } from '@wizcrm/shared';

export async function loadLeadContext(leadId: string, organizationId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      tasks: { orderBy: { dueAt: 'asc' }, take: 10 },
    },
  });
}

async function nextPipelineRank(organizationId: string, stage: LeadStage, atTop: boolean) {
  if (atTop) {
    const min = await prisma.lead.aggregate({
      where: { organizationId, stage },
      _min: { pipelineRank: true },
    });
    return (min._min.pipelineRank ?? 0) - 1;
  }
  const max = await prisma.lead.aggregate({
    where: { organizationId, stage },
    _max: { pipelineRank: true },
  });
  return (max._max.pipelineRank ?? 0) + 1;
}

export async function reorderPipelineLeads(
  organizationId: string,
  stage: LeadStage,
  leadIds: string[],
) {
  const inStage = await prisma.lead.findMany({
    where: { organizationId, stage },
    select: { id: true, pipelineRank: true },
    orderBy: [{ pipelineRank: 'asc' }, { updatedAt: 'desc' }],
  });
  const byId = new Map(inStage.map((l) => [l.id, l]));
  for (const id of leadIds) {
    if (!byId.has(id)) {
      throw Object.assign(new Error('Lead not in this stage'), { statusCode: 400 });
    }
  }
  const reorderedIds = new Set(leadIds);
  const rest = inStage.filter((l) => !reorderedIds.has(l.id)).map((l) => l.id);
  const finalOrder = [...leadIds, ...rest];

  await prisma.$transaction(
    finalOrder.map((id, index) =>
      prisma.lead.update({
        where: { id },
        data: { pipelineRank: index },
      }),
    ),
  );
}

export async function createLead(
  organizationId: string,
  ownerId: string,
  input: CreateLeadInput,
) {
  const extraPhones = sanitizeStringList(input.extraPhones);
  const extraEmails = sanitizeStringList(input.extraEmails);
  const pipelineRank = await nextPipelineRank(organizationId, 'NEW', false);
  return prisma.lead.create({
    data: {
      organizationId,
      ownerId,
      name: input.name,
      pipelineRank,
      company: input.company,
      email: input.email,
      emailNormalized: input.email ? normalizeEmail(input.email) : null,
      phone: input.phone,
      phoneNormalized: input.phone ? normalizePhone(input.phone) : null,
      extraPhones,
      extraEmails,
      address: input.address,
      googleMapsUrl: input.googleMapsUrl,
      source: input.source,
      priority: input.priority,
    },
  });
}

export async function updateLead(
  leadId: string,
  organizationId: string,
  userId: string,
  input: UpdateLeadInput,
) {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
  });
  if (!existing) return null;

  const data: Prisma.LeadUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.company !== undefined) data.company = input.company;
  if (input.email !== undefined) {
    data.email = input.email;
    data.emailNormalized = input.email ? normalizeEmail(input.email) : null;
  }
  if (input.phone !== undefined) {
    data.phone = input.phone;
    data.phoneNormalized = input.phone ? normalizePhone(input.phone) : null;
  }
  if (input.source !== undefined) data.source = input.source;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.extraPhones !== undefined) data.extraPhones = input.extraPhones ?? [];
  if (input.extraEmails !== undefined) data.extraEmails = input.extraEmails ?? [];
  if (input.address !== undefined) data.address = input.address;
  if (input.googleMapsUrl !== undefined) data.googleMapsUrl = input.googleMapsUrl;

  if (input.stage && input.stage !== existing.stage) {
    if (!input.confirmStageSuggestion && input.stage !== existing.stage) {
      // direct user change still allowed when confirmStageSuggestion or no AI-only path
    }
    const allowed = input.pipelineMove
      ? isPipelineDragTransition(existing.stage, input.stage)
      : isAllowedStageTransition(existing.stage, input.stage);
    if (!allowed) {
      throw Object.assign(new Error('Invalid stage transition'), { statusCode: 400 });
    }
    data.stage = input.stage;
    if (input.pipelineMove) {
      data.pipelineRank = await nextPipelineRank(organizationId, input.stage, true);
    }
    await prisma.stageChange.create({
      data: {
        leadId,
        fromStage: existing.stage,
        toStage: input.stage,
        note: input.stageNote,
        suggestedByAi: Boolean(input.confirmStageSuggestion),
        userId,
      },
    });
    await prisma.activity.create({
      data: {
        leadId,
        userId,
        type: 'STAGE_CHANGE',
        subject: 'Stage changed',
        body: `${existing.stage} → ${input.stage}${input.stageNote ? `: ${input.stageNote}` : ''}`,
      },
    });
  }

  return prisma.lead.update({
    where: { id: leadId },
    data: {
      ...data,
      lastActivityAt: input.stage ? new Date() : undefined,
    },
  });
}

export { findDuplicateLeads };
