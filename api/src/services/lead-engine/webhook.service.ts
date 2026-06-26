import { prisma } from '../../lib/prisma.js';
import { addSuppression } from './suppression.service.js';

// Brevo transactional webhook event payload
export type BrevoWebhookEvent = {
  event: string;
  email: string;
  'message-id'?: string;
  'ts_epoch'?: number;
  ts?: number;
  link?: string;
  subject?: string;
};

export type WebhookResult = {
  processed: boolean;
  action: string;
  detail?: string;
};

export async function handleBrevoEvent(event: BrevoWebhookEvent): Promise<WebhookResult> {
  const messageId = event['message-id'];

  if (!messageId) {
    return { processed: false, action: 'ignored', detail: 'no message-id' };
  }

  const send = await prisma.emailSend.findFirst({
    where: { brevoMessageId: messageId },
    include: {
      prospect: {
        include: {
          campaign: { select: { id: true, ownerId: true, name: true } },
          contacts: { where: { email: { not: null } }, take: 1 },
        },
      },
    },
  });

  if (!send) {
    return { processed: false, action: 'ignored', detail: 'message-id not found' };
  }

  const { prospect } = send;
  const eventTime = event.ts_epoch ? new Date(event.ts_epoch) : new Date();

  switch (event.event) {
    case 'opened': {
      if (!send.openedAt) {
        await prisma.emailSend.update({
          where: { id: send.id },
          data: { openedAt: eventTime },
        });
      }
      return { processed: true, action: 'opened' };
    }

    case 'clicked': {
      if (!send.clickedAt) {
        await prisma.emailSend.update({
          where: { id: send.id },
          data: { clickedAt: eventTime },
        });
      }
      return { processed: true, action: 'clicked' };
    }

    case 'replied': {
      // Mark the send as replied
      if (!send.repliedAt) {
        await prisma.emailSend.update({
          where: { id: send.id },
          data: { repliedAt: eventTime },
        });
      }

      // Update prospect status to REPLIED
      if (prospect.status !== 'REPLIED' && prospect.status !== 'IMPORTED') {
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { status: 'REPLIED' },
        });
      }

      // Auto-import to CRM pipeline if not already there
      if (!prospect.importedLeadId) {
        const contact = prospect.contacts[0];

        // Duplicate guard by email/phone
        const dupe = contact?.email || prospect.phone
          ? await prisma.lead.findFirst({
              where: {
                organizationId: prospect.organizationId,
                OR: [
                  ...(contact?.email ? [{ emailNormalized: contact.email.toLowerCase() }] : []),
                  ...(prospect.phone ? [{ phoneNormalized: prospect.phone.replace(/\D/g, '') }] : []),
                ],
              },
            })
          : null;

        if (!dupe) {
          const lead = await prisma.lead.create({
            data: {
              organizationId: prospect.organizationId,
              ownerId: prospect.campaign.ownerId,
              name: contact?.fullName ?? prospect.companyName,
              company: prospect.companyName,
              email: contact?.email ?? null,
              emailNormalized: contact?.email?.toLowerCase() ?? null,
              phone: prospect.phone ?? null,
              phoneNormalized: prospect.phone?.replace(/\D/g, '') ?? null,
              address: prospect.address ?? null,
              source: `lead_generator:${prospect.campaign.id}`,
              stage: 'NEW',
              tags: [
                ...(prospect.tier ? [`tier-${prospect.tier.toLowerCase()}`] : []),
                'replied-to-outreach',
              ],
            },
          });

          await prisma.prospect.update({
            where: { id: prospect.id },
            data: { status: 'IMPORTED', importedLeadId: lead.id },
          });

          return { processed: true, action: 'replied+imported', detail: lead.id };
        }

        // Dupe found — link it so we don't try again
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { importedLeadId: dupe.id },
        });
      }

      return { processed: true, action: 'replied' };
    }

    case 'unsubscribed': {
      // Add to suppression list — uses campaign owner as the "added by" user
      await addSuppression(
        prospect.organizationId,
        prospect.campaign.ownerId,
        {
          email: event.email,
          companyName: prospect.companyName,
          domain: prospect.website ? extractDomain(prospect.website) : undefined,
          reason: 'Unsubscribed via email link (Brevo webhook)',
        },
      );

      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { status: 'SUPPRESSED' },
      });

      return { processed: true, action: 'unsubscribed+suppressed' };
    }

    case 'hardBounce':
    case 'softBounce':
    case 'blocked':
    case 'spam': {
      // Mark the send as failed; flag the contact email as invalid
      await prisma.emailSend.update({
        where: { id: send.id },
        data: { status: 'FAILED' },
      });
      const contact = prospect.contacts[0];
      if (contact) {
        await prisma.prospectContact.update({
          where: { id: contact.id },
          data: { emailStatus: 'invalid' },
        });
      }
      return { processed: true, action: event.event };
    }

    default:
      return { processed: false, action: 'ignored', detail: `unknown event: ${event.event}` };
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
