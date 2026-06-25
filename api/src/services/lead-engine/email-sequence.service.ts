import { createHmac } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { loadBrevoSecrets, getEmailSendMethod } from '../brevo-config.js';

// ── Merge-field injection ──────────────────────────────────────────────────

function inject(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

// ── Unsubscribe token ──────────────────────────────────────────────────────

function unsubToken(prospectId: string): string {
  const secret = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production';
  return createHmac('sha256', secret).update(prospectId).digest('hex').slice(0, 20);
}

export function verifyUnsubToken(prospectId: string, token: string): boolean {
  return unsubToken(prospectId) === token;
}

// ── HTML → plain text ──────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Brevo transactional send (returns message ID for tracking) ─────────────

async function sendViaBrTx(params: {
  toEmail: string;
  toName: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
}): Promise<string | null> {
  const secrets = loadBrevoSecrets();
  if (getEmailSendMethod(secrets) === 'none') {
    throw new Error('Email not configured — add Brevo credentials to brevo.local.txt or .env');
  }
  if (!secrets.MAIL_FROM) {
    throw new Error('MAIL_FROM is not set — add it to brevo.local.txt or .env');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': secrets.BREVO_API_KEY,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: secrets.MAIL_FROM_NAME || 'WizCRM', email: secrets.MAIL_FROM },
      to: [{ email: params.toEmail, name: params.toName }],
      subject: params.subject,
      htmlContent: params.bodyHtml,
      textContent: params.bodyText,
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${raw.slice(0, 300)}`);
  }

  const data = (await res.json()) as { messageId?: string };
  return data.messageId ?? null;
}

// ── Unsubscribe footer ─────────────────────────────────────────────────────

function appendUnsubFooter(bodyHtml: string, unsubLink: string): string {
  const footer = `
<div style="margin-top:40px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.5">
  You received this email because your business was identified as a potential fit for our services.
  If you'd prefer not to hear from us, <a href="${unsubLink}" style="color:#94a3b8">unsubscribe here</a>
  or reply with <strong>UNSUBSCRIBE</strong> in the subject line.
</div>`;
  return bodyHtml + footer;
}

// ── Main send function ─────────────────────────────────────────────────────

export type SendStepResult = {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export async function sendSequenceStep(
  campaignId: string,
  stepNumber: number,
  orgId: string,
): Promise<SendStepResult> {
  // 1. Validate campaign belongs to org
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId: orgId },
  });
  if (!campaign) throw new Error('Campaign not found');

  // 2. Load sequence step + template
  const seqStep = await prisma.emailSequence.findFirst({
    where: { campaignId, stepNumber },
    include: { template: true },
  });
  if (!seqStep) throw new Error(`Sequence step ${stepNumber} is not configured — set a template first`);

  const secrets = loadBrevoSecrets();
  const senderName = secrets.MAIL_FROM_NAME || 'WizCRM';
  const appUrl = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');

  // 3. Find prospects that haven't been sent this step yet
  const alreadySentRows = await prisma.emailSend.findMany({
    where: {
      sequenceStep: stepNumber,
      status: { in: ['SENT', 'PENDING'] },
      prospect: { campaignId, organizationId: orgId },
    },
    select: { prospectId: true },
  });
  const alreadySentIds = new Set(alreadySentRows.map((r) => r.prospectId));

  // 4. Eligible: not suppressed/rejected/replied, has at least one non-invalid email contact
  const prospects = await prisma.prospect.findMany({
    where: {
      campaignId,
      organizationId: orgId,
      status: { notIn: ['SUPPRESSED', 'REJECTED', 'REPLIED'] },
      contacts: {
        some: { email: { not: null }, emailStatus: { notIn: ['invalid'] } },
      },
    },
    include: {
      contacts: {
        where: { email: { not: null }, emailStatus: { notIn: ['invalid'] } },
        orderBy: { confidence: 'desc' },
        take: 1,
      },
    },
  });

  const eligible = prospects.filter(
    (p) => !alreadySentIds.has(p.id) && p.contacts.length > 0,
  );

  const skipped = prospects.length - eligible.length + alreadySentIds.size;
  const result: SendStepResult = { sent: 0, skipped, failed: 0, errors: [] };

  // 5. Send each
  for (const prospect of eligible) {
    const contact = prospect.contacts[0];
    if (!contact?.email) continue;

    const unsubLink = `${appUrl}/unsubscribe?p=${prospect.id}&t=${unsubToken(prospect.id)}`;

    const vars: Record<string, string> = {
      company_name: prospect.companyName,
      contact_name: contact.fullName ?? prospect.companyName,
      sender_name: senderName,
      campaign_name: campaign.name,
      unsubscribe_link: unsubLink,
    };

    const subject = inject(seqStep.template.subject, vars);
    const rawBody = inject(seqStep.template.bodyHtml, vars);
    const bodyHtml = appendUnsubFooter(rawBody, unsubLink);
    const bodyText = htmlToText(bodyHtml);

    // 200ms rate limit between sends to stay within Brevo free-tier limits
    if (result.sent + result.failed > 0) {
      await new Promise<void>((r) => setTimeout(r, 200));
    }

    try {
      const messageId = await sendViaBrTx({
        toEmail: contact.email,
        toName: contact.fullName ?? prospect.companyName,
        subject,
        bodyHtml,
        bodyText,
      });

      await prisma.emailSend.create({
        data: {
          prospectId: prospect.id,
          sequenceStep: stepNumber,
          brevoMessageId: messageId,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      if (prospect.status !== 'REPLIED') {
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { status: 'EMAILED' },
        });
      }

      result.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${prospect.companyName}: ${msg}`);
      result.failed++;

      await prisma.emailSend.create({
        data: {
          prospectId: prospect.id,
          sequenceStep: stepNumber,
          status: 'FAILED',
        },
      }).catch(() => {});
    }
  }

  return result;
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getEmailStats(campaignId: string, orgId: string) {
  const sends = await prisma.emailSend.findMany({
    where: { prospect: { campaignId, organizationId: orgId } },
    select: {
      status: true,
      openedAt: true,
      clickedAt: true,
      repliedAt: true,
      sequenceStep: true,
    },
  });

  const sent = sends.filter((s) => s.status === 'SENT').length;

  return {
    sent,
    opened: sends.filter((s) => s.openedAt != null).length,
    clicked: sends.filter((s) => s.clickedAt != null).length,
    replied: sends.filter((s) => s.repliedAt != null).length,
    failed: sends.filter((s) => s.status === 'FAILED').length,
    byStep: [1, 2, 3].map((step) => ({
      step,
      sent: sends.filter((s) => s.sequenceStep === step && s.status === 'SENT').length,
    })),
  };
}

// ── Prospect eligibility count (for UI preview) ────────────────────────────

export async function countEligibleForStep(
  campaignId: string,
  stepNumber: number,
  orgId: string,
): Promise<{ eligible: number; noEmail: number; alreadySent: number }> {
  const [allProspects, alreadySent, withEmail] = await Promise.all([
    prisma.prospect.count({
      where: {
        campaignId,
        organizationId: orgId,
        status: { notIn: ['SUPPRESSED', 'REJECTED', 'REPLIED'] },
      },
    }),
    prisma.emailSend.count({
      where: {
        sequenceStep: stepNumber,
        status: { in: ['SENT', 'PENDING'] },
        prospect: { campaignId, organizationId: orgId },
      },
    }),
    prisma.prospect.count({
      where: {
        campaignId,
        organizationId: orgId,
        status: { notIn: ['SUPPRESSED', 'REJECTED', 'REPLIED'] },
        contacts: { some: { email: { not: null }, emailStatus: { notIn: ['invalid'] } } },
      },
    }),
  ]);

  const eligible = Math.max(0, withEmail - alreadySent);
  const noEmail = allProspects - withEmail;

  return { eligible, noEmail, alreadySent };
}
