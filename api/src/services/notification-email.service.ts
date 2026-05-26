import { prisma } from '../lib/prisma.js';
import { EmailUnavailableError, sendTransactionalEmail } from './brevo-mail.js';

const APP_URL = (process.env.APP_URL ?? 'https://app.wizcrm.app').replace(/\/$/, '');

function leadDeepLink(leadId: string) {
  return `${APP_URL}/leads?open=${encodeURIComponent(leadId)}`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fire-and-forget email to a user; logs on failure, never throws to caller. */
export function notifyUserByEmail(input: {
  userId: string;
  subject: string;
  text: string;
  leadId?: string;
}): void {
  void notifyUserByEmailAsync(input).catch((e) => {
    console.warn('[notifyUserByEmail]', input.userId, e instanceof Error ? e.message : e);
  });
}

async function notifyUserByEmailAsync(input: {
  userId: string;
  subject: string;
  text: string;
  leadId?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  const link = input.leadId ? leadDeepLink(input.leadId) : APP_URL;
  const text = `${input.text}\n\nOpen in WizCRM: ${link}`;
  const html = `<p>${escapeHtml(input.text).replace(/\n/g, '<br/>')}</p><p><a href="${escapeHtml(link)}">Open in WizCRM</a></p>`;

  try {
    await sendTransactionalEmail({
      toEmail: user.email,
      toName: user.name,
      subject: input.subject,
      text,
      html,
    });
  } catch (e) {
    if (e instanceof EmailUnavailableError) return;
    throw e;
  }
}

export function notifyMentionedUsers(input: {
  actorUserId: string;
  actorName: string;
  leadId: string;
  leadName: string;
  mentionedUserIds: string[];
  excerpt: string;
}): void {
  const unique = [...new Set(input.mentionedUserIds)].filter((id) => id !== input.actorUserId);
  for (const userId of unique) {
    notifyUserByEmail({
      userId,
      leadId: input.leadId,
      subject: `${input.actorName} mentioned you on ${input.leadName}`,
      text: `${input.actorName} mentioned you on lead "${input.leadName}":\n\n${input.excerpt.slice(0, 500)}`,
    });
  }
}
