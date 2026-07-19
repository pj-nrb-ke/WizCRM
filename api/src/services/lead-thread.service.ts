import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mergeMentionIds, stripMentionMarkup, type MentionableUser } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { notifyMentionedUsers } from './notification-email.service.js';
import { notifyUser } from './notification.service.js';
import { recomputeCommissionBasis, stampLpoCollectible } from './commission.service.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const userSelect = { id: true, name: true, email: true } as const;

export async function listLeadMessages(
  organizationId: string,
  leadId: string,
  limit = 100,
  opportunityId?: string,
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return null;

  const messages = await prisma.leadMessage.findMany({
    where: { leadId, ...(opportunityId ? { opportunityId } : {}) },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      user: { select: userSelect },
      attachments: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
    },
  });
  return messages;
}

export async function createLeadMessage(
  organizationId: string,
  leadId: string,
  userId: string,
  body: string,
  opportunityId?: string,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId },
    select: { id: true, name: true },
  });
  if (!lead) return null;

  if (opportunityId) {
    const opp = await prisma.salesOpportunity.findFirst({ where: { id: opportunityId, leadId } });
    if (!opp) return { error: 'OPPORTUNITY_NOT_FOUND' as const };
  }

  const orgUsers = await prisma.user.findMany({
    where: { organizationId },
    select: userSelect,
  });
  const mentionable: MentionableUser[] = orgUsers;
  const mentionedUserIds = mergeMentionIds(body, mentionable);

  const actor = orgUsers.find((u) => u.id === userId);
  const message = await prisma.leadMessage.create({
    data: {
      leadId,
      opportunityId,
      userId,
      body,
      mentionedUserIds,
    },
    include: {
      user: { select: userSelect },
      attachments: true,
    },
  });

  if (mentionedUserIds.length && actor) {
    const plainBody = stripMentionMarkup(body);

    notifyMentionedUsers({
      actorUserId: userId,
      actorName: actor.name,
      leadId,
      leadName: lead.name,
      mentionedUserIds,
      excerpt: plainBody,
    });

    const uniqueMentioned = [...new Set(mentionedUserIds)].filter((id) => id !== userId);
    for (const mentionedUserId of uniqueMentioned) {
      notifyUser({
        organizationId,
        userId: mentionedUserId,
        kind: 'LEAD_MENTION',
        title: `${actor.name} mentioned you on ${lead.name}`,
        body: plainBody.slice(0, 200),
        linkPath: `/leads?open=${leadId}`,
      }).catch((e) => {
        console.warn('[createLeadMessage] mention notification failed', mentionedUserId, e instanceof Error ? e.message : e);
      });
    }
  }

  return message;
}

export async function listLeadAttachments(
  organizationId: string,
  leadId: string,
  opportunityId?: string,
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return null;

  return prisma.leadAttachment.findMany({
    where: { leadId, ...(opportunityId ? { opportunityId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: userSelect } },
  });
}

export async function createLeadAttachment(
  organizationId: string,
  leadId: string,
  userId: string,
  input: {
    fileName: string;
    mimeType: string;
    dataBase64: string;
    messageId?: string;
    visitId?: string;
    opportunityId?: string;
    documentType?: string;
    amount?: number;
  },
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return null;

  if (input.messageId) {
    const msg = await prisma.leadMessage.findFirst({
      where: { id: input.messageId, leadId },
    });
    if (!msg) return { error: 'MESSAGE_NOT_FOUND' as const };
  }

  if (input.visitId) {
    const visit = await prisma.leadVisit.findFirst({ where: { id: input.visitId, leadId } });
    if (!visit) return { error: 'VISIT_NOT_FOUND' as const };
  }

  let opportunity: { id: string; referenceNumber: string } | null = null;
  if (input.opportunityId) {
    opportunity = await prisma.salesOpportunity.findFirst({
      where: { id: input.opportunityId, leadId },
      select: { id: true, referenceNumber: true },
    });
    if (!opportunity) return { error: 'OPPORTUNITY_NOT_FOUND' as const };
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(input.dataBase64, 'base64');
  } catch {
    return { error: 'INVALID_BASE64' as const };
  }
  if (buf.length === 0 || buf.length > MAX_ATTACHMENT_BYTES) {
    return { error: 'FILE_TOO_LARGE' as const };
  }

  const safeName = input.fileName.replace(/[^\w.\-()+ ]/g, '_').slice(0, 200);
  const storageName = `${randomUUID()}-${safeName}`;
  const dir = path.join(UPLOAD_DIR, organizationId, leadId);
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, storageName);
  await writeFile(storagePath, buf);

  const amountEligible = ['QUOTATION', 'PROFORMA_INVOICE', 'INVOICE'].includes(
    input.documentType ?? '',
  );

  const attachment = await prisma.leadAttachment.create({
    data: {
      leadId,
      messageId: input.messageId,
      visitId: input.visitId,
      opportunityId: input.opportunityId,
      documentType: (input.documentType as any) ?? 'GENERAL',
      amount: amountEligible && input.amount !== undefined ? input.amount : undefined,
      userId,
      fileName: safeName,
      mimeType: input.mimeType,
      sizeBytes: buf.length,
      storagePath,
    },
    include: { user: { select: userSelect } },
  });

  if (opportunity && input.documentType === 'LPO') {
    const uploader = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const recipients = await prisma.user.findMany({
      where: { organizationId, isActive: true, role: { in: ['MANAGER', 'ADMIN'] } },
      select: { id: true },
    });
    for (const recipient of recipients) {
      notifyUser({
        organizationId,
        userId: recipient.id,
        kind: 'OPPORTUNITY_LPO_UPLOADED',
        title: `LPO uploaded for ${opportunity.referenceNumber}`,
        body: `${uploader?.name ?? 'A salesperson'} uploaded a customer LPO on "${lead.name}" — the customer has committed, review the opportunity.`,
        linkPath: `/leads?open=${leadId}&opportunity=${opportunity.id}`,
      }).catch((e) => {
        console.warn('[createLeadAttachment] LPO notification failed', recipient.id, e instanceof Error ? e.message : e);
      });
    }
    stampLpoCollectible(opportunity.id, organizationId).catch((e) => {
      console.warn('[createLeadAttachment] LPO commission stamp failed', opportunity.id, e instanceof Error ? e.message : e);
    });
  }

  if (opportunity && amountEligible && input.amount !== undefined) {
    recomputeCommissionBasis(opportunity.id, organizationId).catch((e) => {
      console.warn('[createLeadAttachment] commission recompute failed', opportunity.id, e instanceof Error ? e.message : e);
    });
  }

  return { attachment };
}

export async function getLeadAttachmentFile(
  organizationId: string,
  leadId: string,
  attachmentId: string,
) {
  const row = await prisma.leadAttachment.findFirst({
    where: { id: attachmentId, leadId, lead: { organizationId } },
  });
  if (!row) return null;
  return row;
}
