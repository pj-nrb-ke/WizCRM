import type { Prisma } from '@prisma/client';
import { isAllowedStageTransition } from '@wizcrm/shared';
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

export async function createLead(
  organizationId: string,
  ownerId: string,
  input: CreateLeadInput,
) {
  const extraPhones = sanitizeStringList(input.extraPhones);
  const extraEmails = sanitizeStringList(input.extraEmails);
  return prisma.lead.create({
    data: {
      organizationId,
      ownerId,
      name: input.name,
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
    if (!isAllowedStageTransition(existing.stage, input.stage)) {
      throw Object.assign(new Error('Invalid stage transition'), { statusCode: 400 });
    }
    data.stage = input.stage;
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
