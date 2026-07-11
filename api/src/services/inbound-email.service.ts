import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

/** Verbatim shape of Brevo's inbound-parse payload — field names and casing
 * confirmed against developers.brevo.com/docs/inbound-parse-webhooks, not
 * guessed. Only the fields we actually use are typed. */
export type BrevoInboundPayload = {
  items?: BrevoInboundItem[];
};

type BrevoInboundItem = {
  MessageId?: string;
  From?: { Name?: string; Address?: string };
  To?: { Name?: string; Address?: string }[];
  Recipients?: string[];
  Subject?: string;
  ExtractedMarkdownMessage?: string;
  RawTextBody?: string;
};

const TASK_REPLY_PATTERN = /^task-([0-9a-f-]{36})@/i;

/** The envelope recipient that actually triggered delivery — prefer
 * `Recipients` (plain strings, the real RCPT TO) over `To` (the visible
 * header, which can differ, e.g. when CC'd or forwarded). */
function pickTriggeringAddress(item: BrevoInboundItem): string | null {
  const domain = config.brevoInboundDomain.toLowerCase();
  const candidates = [
    ...(item.Recipients ?? []),
    ...(item.To ?? []).map((t) => t.Address ?? ''),
  ].filter(Boolean);
  return candidates.find((addr) => addr.toLowerCase().endsWith(`@${domain}`)) ?? candidates[0] ?? null;
}

export type ProcessInboundResult = {
  processed: number;
  matched: number;
};

export async function processBrevoInboundPayload(payload: BrevoInboundPayload): Promise<ProcessInboundResult> {
  const items = payload.items ?? [];
  let matched = 0;

  for (const item of items) {
    const toEmail = pickTriggeringAddress(item) ?? '';
    const fromEmail = (item.From?.Address ?? '').toLowerCase().trim();
    const bodyText = item.ExtractedMarkdownMessage || item.RawTextBody || '';

    const taskMatch = toEmail.match(TASK_REPLY_PATTERN);
    let matchedTaskId: string | null = null;
    let matchedUserId: string | null = null;
    let createdUpdateId: string | null = null;
    let organizationId: string | null = null;

    if (taskMatch && fromEmail) {
      const taskId = taskMatch[1];
      const [task, user] = await Promise.all([
        prisma.task.findUnique({ where: { id: taskId } }),
        prisma.user.findUnique({ where: { email: fromEmail } }),
      ]);
      if (task && user && task.organizationId === user.organizationId) {
        matchedTaskId = task.id;
        matchedUserId = user.id;
        organizationId = task.organizationId;
        const update = await prisma.taskUpdate.create({
          data: {
            taskId: task.id,
            userId: user.id,
            body: bodyText || '(no message body)',
          },
        });
        createdUpdateId = update.id;
        matched += 1;
      }
    }

    await prisma.inboundEmail.create({
      data: {
        organizationId,
        fromEmail: fromEmail || '(unknown)',
        fromName: item.From?.Name ?? null,
        toEmail: toEmail || '(unknown)',
        subject: item.Subject ?? null,
        bodyText: bodyText || null,
        rawPayload: item as object,
        matchedTaskId,
        matchedUserId,
        createdUpdateId,
      },
    });
  }

  return { processed: items.length, matched };
}
