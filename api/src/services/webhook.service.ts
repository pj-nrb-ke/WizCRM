import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { WebhookLeadInput } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings, mergeOrgSettings } from './org-settings.service.js';
import { createLeadGuarded } from './lead.service.js';

export function generateWebhookSecret() {
  return randomBytes(24).toString('hex');
}

/** Constant-time secret comparison to avoid leaking the secret via timing. */
function secretsMatch(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function resolveOrgByWebhookSecret(secret: string) {
  const orgs = await prisma.organization.findMany({ select: { id: true, settings: true } });
  for (const org of orgs) {
    const settings = await getOrgSettings(org.id);
    if (settings.webhookEnabled && settings.webhookSecret && secretsMatch(settings.webhookSecret, secret)) {
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

  const lead = await createLeadGuarded(organizationId, ownerId, {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    source: input.source ?? 'Website webhook',
  });
  return lead;
}
