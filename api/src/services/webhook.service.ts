import { randomBytes } from 'node:crypto';
import type { WebhookLeadInput } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings, mergeOrgSettings } from './org-settings.service.js';
import { createLead } from './lead.service.js';

export function generateWebhookSecret() {
  return randomBytes(24).toString('hex');
}

export async function resolveOrgByWebhookSecret(secret: string) {
  const orgs = await prisma.organization.findMany({ select: { id: true, settings: true } });
  for (const org of orgs) {
    const settings = await getOrgSettings(org.id);
    if (settings.webhookEnabled && settings.webhookSecret === secret) {
      return org.id;
    }
  }
  return null;
}

export async function enableWebhook(organizationId: string) {
  const secret = generateWebhookSecret();
  await mergeOrgSettings(organizationId, {
    webhookSecret: secret,
    webhookEnabled: true,
  });
  return secret;
}

export async function disableWebhook(organizationId: string) {
  await mergeOrgSettings(organizationId, { webhookEnabled: false });
}

export async function ingestWebhookLead(organizationId: string, input: WebhookLeadInput) {
  let ownerId: string | undefined;
  if (input.ownerEmail) {
    const user = await prisma.user.findFirst({
      where: { organizationId, email: input.ownerEmail.trim().toLowerCase() },
    });
    ownerId = user?.id;
  }
  if (!ownerId) {
    const fallback = await prisma.user.findFirst({
      where: { organizationId, role: { in: ['MANAGER', 'ADMIN'] } },
      orderBy: { createdAt: 'asc' },
    });
    if (!fallback) {
      throw Object.assign(new Error('No user to assign lead'), { statusCode: 500 });
    }
    ownerId = fallback.id;
  }

  const lead = await createLead(organizationId, ownerId, {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    source: input.source ?? 'Website webhook',
  });
  return lead;
}
