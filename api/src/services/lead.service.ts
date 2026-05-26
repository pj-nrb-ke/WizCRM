import type { LeadStage, Prisma } from '@prisma/client';
import {
  isAllowedStageTransition,
  isPipelineDragTransition,
  isValidLossReasonCode,
  lossReasonLabel,
} from '@wizcrm/shared';
import type { CreateLeadInput, UpdateLeadInput } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getCrmConfig } from './crm-config.service.js';
import { findDuplicateLeads, normalizeEmail } from './duplicate.service.js';
import { normalizePhone, sanitizeStringList } from '@wizcrm/shared';

const TERMINAL: LeadStage[] = ['WON', 'LOST'];

export async function loadLeadContext(leadId: string, organizationId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    include: {
      owner: { select: { id: true, name: true, email: true, team: { select: { id: true, name: true } } } },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { user: { select: { id: true, name: true } } },
      },
      tasks: { orderBy: { dueAt: 'asc' }, take: 10 },
      stageChanges: {
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { user: { select: { id: true, name: true } } },
      },
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
    const allowed = input.pipelineMove
      ? isPipelineDragTransition(existing.stage, input.stage)
      : isAllowedStageTransition(existing.stage, input.stage);
    if (!allowed) {
      throw Object.assign(new Error('Invalid stage transition'), { statusCode: 400 });
    }

    const config = await getCrmConfig(organizationId);
    let stageNote = input.stageNote?.trim() || undefined;

    if (input.stage === 'WON') {
      if (input.wonValue === undefined) {
        throw Object.assign(new Error('Deal value is required when marking as Won'), {
          statusCode: 400,
        });
      }
      data.wonValue = input.wonValue;
      data.wonStartAt = input.wonStartAt ? new Date(input.wonStartAt) : new Date();
      data.wonProducts = input.wonProducts?.trim() || null;
      data.lossReason = null;
      stageNote =
        stageNote ??
        `Won · ${input.wonValue}${input.wonProducts ? ` · ${input.wonProducts}` : ''}`;
    } else if (input.stage === 'LOST') {
      if (!input.lossReason) {
        throw Object.assign(new Error('Loss reason is required when marking as Lost'), {
          statusCode: 400,
        });
      }
      if (!isValidLossReasonCode(input.lossReason, config.lossReasons)) {
        throw Object.assign(new Error('Invalid loss reason'), { statusCode: 400 });
      }
      data.lossReason = input.lossReason;
      data.wonValue = null;
      data.wonStartAt = null;
      data.wonProducts = null;
      const reasonLabel = lossReasonLabel(input.lossReason);
      stageNote = stageNote ? `${reasonLabel} — ${stageNote}` : reasonLabel;
    } else if (TERMINAL.includes(existing.stage)) {
      data.wonValue = null;
      data.wonStartAt = null;
      data.wonProducts = null;
      data.lossReason = null;
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
        note: stageNote,
        suggestedByAi: Boolean(input.confirmStageSuggestion),
        userId,
      },
    });
    await prisma.activity.create({
      data: {
        leadId,
        userId,
        type: 'STAGE_CHANGE',
        subject: input.stage === 'WON' ? 'Deal won' : input.stage === 'LOST' ? 'Deal lost' : 'Stage changed',
        body: `${existing.stage} → ${input.stage}${stageNote ? `: ${stageNote}` : ''}`,
      },
    });
  } else if (input.wonValue !== undefined || input.wonProducts !== undefined || input.wonStartAt) {
    if (existing.stage !== 'WON') {
      throw Object.assign(new Error('Won details can only be updated on Won leads'), {
        statusCode: 400,
      });
    }
    if (input.wonValue !== undefined) data.wonValue = input.wonValue;
    if (input.wonStartAt !== undefined) data.wonStartAt = new Date(input.wonStartAt);
    if (input.wonProducts !== undefined) data.wonProducts = input.wonProducts?.trim() || null;
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...data,
      lastActivityAt: input.stage || input.wonValue !== undefined ? new Date() : undefined,
    },
    include: {
      owner: { select: { id: true, name: true, email: true, team: { select: { id: true, name: true } } } },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { user: { select: { id: true, name: true } } },
      },
      tasks: { orderBy: { dueAt: 'asc' }, take: 10 },
      stageChanges: {
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return updated;
}

export { findDuplicateLeads };
