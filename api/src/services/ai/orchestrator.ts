import type { Lead, Activity, Task, LeadStage } from '@prisma/client';
import type OpenAI from 'openai';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { createOpenAIClient, chatJson } from './openai.provider.js';
import { isAllowedStageTransition } from '@wizcrm/shared';

type LeadContext = Lead & {
  activities: Pick<Activity, 'type' | 'subject' | 'body' | 'createdAt'>[];
  tasks: Pick<Task, 'title' | 'dueAt' | 'completedAt'>[];
};

async function audit(params: {
  organizationId: string;
  userId: string;
  feature: string;
  inputSummary: string;
  outputSummary: string;
  approved?: boolean;
}) {
  await prisma.aiAuditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      feature: params.feature,
      model: config.openaiModel,
      promptVersion: config.aiPromptVersion,
      inputSummary: params.inputSummary.slice(0, 2000),
      outputSummary: params.outputSummary.slice(0, 2000),
      approved: params.approved ?? null,
    },
  });
}

function ensureClient() {
  const client = createOpenAIClient();
  if (!client) {
    const err = new Error('AI_UNAVAILABLE') as Error & { statusCode: number };
    err.statusCode = 503;
    throw err;
  }
  return client;
}

function formatLeadContext(lead: LeadContext): string {
  const activities = lead.activities
    .map((a) => `- [${a.createdAt.toISOString()}] ${a.type}: ${a.subject ?? ''} ${a.body}`)
    .join('\n');
  const tasks = lead.tasks
    .map((t) => `- ${t.title} due=${t.dueAt?.toISOString() ?? 'none'} done=${Boolean(t.completedAt)}`)
    .join('\n');
  return JSON.stringify({
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    stage: lead.stage,
    source: lead.source,
    activities,
    tasks,
  });
}

export async function generateLeadSummary(lead: LeadContext, userId: string): Promise<string> {
  const client = ensureClient();
  const input = formatLeadContext(lead);
  const result = await chatJson<{ summary: string }>(
    client,
    'You are a CRM assistant. Return JSON: { "summary": string } with a plain-language 2-4 sentence status for the sales rep.',
    input,
  );
  await audit({
    organizationId: lead.organizationId,
    userId,
    feature: 'lead_summary',
    inputSummary: input,
    outputSummary: result.summary,
  });
  return result.summary;
}

export async function generateNextAction(lead: LeadContext, userId: string): Promise<{
  action: string;
  reason: string;
}> {
  const client = ensureClient();
  const input = formatLeadContext(lead);
  const result = await chatJson<{ action: string; reason: string }>(
    client,
    'You are a CRM assistant. Return JSON: { "action": string, "reason": string }. action is one clear next step (Call, Email, Follow up, Send proposal, etc.).',
    input,
  );
  await audit({
    organizationId: lead.organizationId,
    userId,
    feature: 'next_action',
    inputSummary: input,
    outputSummary: `${result.action}: ${result.reason}`,
  });
  return result;
}

export async function suggestStage(lead: LeadContext, userId: string): Promise<{
  suggestedStage: LeadStage;
  reason: string;
}> {
  const client = ensureClient();
  const input = formatLeadContext(lead);
  const result = await chatJson<{ suggestedStage: LeadStage; reason: string }>(
    client,
    `You are a CRM assistant. Return JSON: { "suggestedStage": string, "reason": string }. suggestedStage must be one of: NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST. Current stage is ${lead.stage}. Only suggest change if activity supports it.`,
    input,
  );
  if (!isAllowedStageTransition(lead.stage, result.suggestedStage)) {
    result.suggestedStage = lead.stage;
  }
  await audit({
    organizationId: lead.organizationId,
    userId,
    feature: 'stage_suggestion',
    inputSummary: input,
    outputSummary: `${result.suggestedStage}: ${result.reason}`,
    approved: false,
  });
  await prisma.aiSuggestion.create({
    data: {
      leadId: lead.id,
      kind: 'STAGE',
      payload: result,
      status: 'PENDING',
    },
  });
  return result;
}

export async function generateSalesDesk(
  organizationId: string,
  userId: string,
  leads: LeadContext[],
): Promise<Array<{ leadId: string; title: string; reason: string }>> {
  const client = ensureClient();
  const compact = leads.map((l) => ({
    id: l.id,
    name: l.name,
    stage: l.stage,
    lastActivityAt: l.lastActivityAt,
    openTasks: l.tasks.filter((t) => !t.completedAt).length,
  }));
  const result = await chatJson<{ items: Array<{ leadId: string; title: string; reason: string }> }>(
    client,
    'You are a CRM sales desk. Return JSON: { "items": [{ "leadId", "title", "reason" }] } with 3-5 highest priority actions for today. Prefer due follow-ups and stale hot leads.',
    JSON.stringify(compact),
  );
  await audit({
    organizationId,
    userId,
    feature: 'sales_desk',
    inputSummary: JSON.stringify(compact),
    outputSummary: JSON.stringify(result.items),
  });
  return result.items.slice(0, 5);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeCardFields(parsed: Record<string, unknown>) {
  return {
    name: pickString(parsed, ['name', 'fullName', 'full_name', 'contactName', 'contact_name']),
    company: pickString(parsed, [
      'company',
      'organization',
      'organisation',
      'employer',
      'business',
      'companyName',
      'company_name',
    ]),
    email: pickString(parsed, ['email', 'emailAddress', 'email_address']),
    phone: pickString(parsed, ['phone', 'phoneNumber', 'phone_number', 'mobile', 'telephone', 'tel']),
  };
}

export async function parseBusinessCard(
  organizationId: string,
  userId: string,
  input: { imageBase64?: string; imageMimeType?: string; ocrText?: string },
): Promise<{ name?: string; company?: string; email?: string; phone?: string }> {
  const client = ensureClient();
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        'You read business card photos. Extract visible contact fields. Return JSON only: { "name", "company", "email", "phone" } using string or null. name = person name; company = employer or bank/organization on the card; include country code on phone when shown.',
    },
  ];

  if (input.imageBase64) {
    const raw = input.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');
    const mime = input.imageMimeType ?? 'image/jpeg';
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Extract name, company, email, and phone from this business card image.',
        },
        {
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${raw}`, detail: 'high' },
        },
      ],
    } as OpenAI.Chat.ChatCompletionMessageParam);
  } else if (input.ocrText) {
    messages.push({
      role: 'user',
      content: `Extract fields from this OCR text:\n${input.ocrText}`,
    });
  }

  const res = await client.chat.completions.create({
    model: config.openaiModel,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  const text = res.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const fields = normalizeCardFields(parsed);
  await audit({
    organizationId,
    userId,
    feature: 'card_parse',
    inputSummary: input.ocrText?.slice(0, 500) ?? '[image]',
    outputSummary: text,
  });
  return fields;
}

export async function processPostCall(
  organizationId: string,
  userId: string,
  lead: LeadContext,
  roughNote: string,
): Promise<{
  summary: string;
  suggestedTask: { title: string; dueAt?: string };
  suggestedStage?: LeadStage;
}> {
  const client = ensureClient();
  const input = `${formatLeadContext(lead)}\n\nRough call note:\n${roughNote}`;
  const result = await chatJson<{
    summary: string;
    suggestedTask: { title: string; dueAt?: string };
    suggestedStage?: LeadStage;
  }>(
    client,
    'Structure a sales call note. Return JSON: { "summary", "suggestedTask": { "title", "dueAt"?: ISO date }, "suggestedStage"?: stage enum }.',
    input,
  );
  await audit({
    organizationId,
    userId,
    feature: 'post_call',
    inputSummary: roughNote,
    outputSummary: result.summary,
    approved: false,
  });
  return result;
}

export async function cleanVoiceNote(
  organizationId: string,
  userId: string,
  transcript: string,
): Promise<{ cleanedBody: string; subject?: string }> {
  const client = ensureClient();
  const result = await chatJson<{ cleanedBody: string; subject?: string }>(
    client,
    'Clean a rough voice transcript into a professional CRM note. Return JSON: { "cleanedBody", "subject"? }.',
    transcript,
  );
  await audit({
    organizationId,
    userId,
    feature: 'voice_note',
    inputSummary: transcript,
    outputSummary: result.cleanedBody,
  });
  return result;
}
