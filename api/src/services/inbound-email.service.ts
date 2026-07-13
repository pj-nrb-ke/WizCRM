import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { sendMorningRun, skipMorningRun } from './vsm-execution.service.js';

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
const VSM_RUN_REPLY_PATTERN = /^vsmrun-([0-9a-f-]{36})@/i;

/** A CEO's reply carries the whole quoted thread below it — only look at
 * their own new text, not anything quoted back at them, so a forwarded
 * plan that happens to contain the word "skip" doesn't misfire. */
function ownReplyText(bodyText: string): string {
  return bodyText.split(/\n\s*On .+wrote:|\n\s*>|\n-{2,}\s*Original Message/i)[0] ?? bodyText;
}

function parseApprovalDecision(bodyText: string): 'approve' | 'skip' | 'unknown' {
  const text = ownReplyText(bodyText).trim().toLowerCase();
  const approveIdx = text.search(/\b(approve|approved|yes|send)\b/);
  const skipIdx = text.search(/\b(skip|hold|no)\b/);
  if (approveIdx === -1 && skipIdx === -1) return 'unknown';
  if (approveIdx === -1) return 'skip';
  if (skipIdx === -1) return 'approve';
  return approveIdx <= skipIdx ? 'approve' : 'skip';
}

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
    const vsmRunMatch = toEmail.match(VSM_RUN_REPLY_PATTERN);
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
    } else if (vsmRunMatch && fromEmail) {
      // A CEO approving/skipping a DRAFT morning plan by replying to the
      // "your plan is ready" email — no login required. Only a user listed
      // in that org's VsmConfig.ceoUserIds can trigger this; anyone else
      // replying (or forwarding) to that address is silently ignored, same
      // as an unmatched task reply.
      const runId = vsmRunMatch[1];
      const [run, user] = await Promise.all([
        prisma.vsmRun.findUnique({ where: { id: runId } }),
        prisma.user.findUnique({ where: { email: fromEmail } }),
      ]);
      if (run && run.status === 'DRAFT' && run.kind === 'MORNING' && user && user.organizationId === run.organizationId) {
        const vsmConfig = await prisma.vsmConfig.findUnique({ where: { organizationId: run.organizationId } });
        if (vsmConfig?.ceoUserIds.includes(user.id)) {
          const decision = parseApprovalDecision(bodyText);
          if (decision === 'approve') {
            await sendMorningRun(run.id, user.id);
            matchedUserId = user.id;
            organizationId = run.organizationId;
            matched += 1;
          } else if (decision === 'skip') {
            await skipMorningRun(run.id);
            matchedUserId = user.id;
            organizationId = run.organizationId;
            matched += 1;
          }
          // 'unknown' — logged below for the admin inbound-emails view, but
          // no action taken since we can't tell what the CEO meant.
        }
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
