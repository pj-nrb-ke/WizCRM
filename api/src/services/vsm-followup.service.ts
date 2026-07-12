import { prisma } from '../lib/prisma.js';
import { createOpenAIClient, chatJson } from './ai/openai.provider.js';
import { notifyUser } from './notification.service.js';

const MAX_FOLLOWUP_QUESTION_LENGTH = 300;

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * VSM-SPEC §4.6: "VSM reads thread updates on its tasks; may ask one
 * clarifying question per task per day (cap prevents interrogation)."
 * Only fires on VSM-sourced tasks, only once someone actually replies, and
 * only once per task per calendar day. Grounded strictly in the task's own
 * evidence + the reply text — same no-invented-facts rule as the rest of
 * the module (§5.1). Best-effort: any failure here must never break the
 * staff member's own reply, so callers should swallow errors.
 */
export async function maybeAskFollowUp(organizationId: string, taskId: string, replyBody: string): Promise<{ asked: boolean; question?: string }> {
  const vsmConfig = await prisma.vsmConfig.findUnique({ where: { organizationId } });
  if (!vsmConfig || !vsmConfig.enabled) return { asked: false };

  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task || task.source !== 'VSM') return { asked: false };

  const alreadyAskedToday = await prisma.taskUpdate.findFirst({
    where: { taskId, isVsm: true, createdAt: { gte: todayStart() } },
  });
  if (alreadyAskedToday) return { asked: false };

  const client = createOpenAIClient();
  if (!client) return { asked: false };

  const result = await chatJson<{ shouldAsk: boolean; question?: string }>(
    client,
    `You are ${vsmConfig.personaName}, a ${vsmConfig.tone} sales manager persona inside a CRM, reading a staff reply on a task you assigned. Decide whether ONE short clarifying question is genuinely warranted — only if the reply leaves the outcome unclear (no next step, no date, vague result). If the reply is already clear and complete, do not ask anything; most replies need no follow-up. Never invent facts not present in the task or the reply. Keep any question under 25 words, warm, direct, never judgmental — you are a coach, not a supervisor. Return JSON: {"shouldAsk": boolean, "question": string | null}.`,
    JSON.stringify({ taskTitle: task.title, taskReason: task.reason, reply: replyBody }),
    { maxTokens: 150 },
  );

  if (!result.shouldAsk || !result.question) return { asked: false };
  const question = result.question.slice(0, MAX_FOLLOWUP_QUESTION_LENGTH);

  await prisma.taskUpdate.create({ data: { taskId, userId: null, isVsm: true, body: question } });
  await notifyUser({
    organizationId,
    userId: task.userId,
    kind: 'vsm_followup_question',
    title: `${vsmConfig.personaName} replied on "${task.title}"`,
    body: question,
    linkPath: '/',
  });
  return { asked: true, question };
}
