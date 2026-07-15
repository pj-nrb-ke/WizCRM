import type { Lead, Activity, Task, LeadStage } from '@prisma/client';
import type OpenAI from 'openai';
import { config } from '../../config.js';
import { prisma } from '../../lib/prisma.js';
import { createOpenAIClient, chatJson, transcribeAudio } from './openai.provider.js';
import { isAllowedStageTransition } from '@wizcrm/shared';
import { normalizeCardFields } from '../card-fields.service.js';
import { tavilySearch } from '../lead-engine/heat-map/tavily.provider.js';
import { orgApiKeys } from '../../lib/org-context.js';

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
  if (
    lead.stage === 'WON' ||
    !isAllowedStageTransition(lead.stage, result.suggestedStage)
  ) {
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
        'You read business card photos. Extract visible contact fields. Return JSON only: { "name", "company", "email", "phone", "phone2", "email2", "address" } using string or null. name = person name; company = employer; address = full postal address; include country code on phone when shown.',
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

const CAPTURE_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
];

export type VisitCaptureDraft = {
  outcome: string;
  whoMet?: string;
  competitor?: string;
  objection?: string;
  nextStep?: string;
  suggestedDueAt?: string;
  summary: string;
  suggestedStage?: LeadStage;
};

/**
 * The "self-writing CRM": turn a rep's raw post-visit voice transcript into a
 * structured Visit Report draft (outcome / who / competitor / objection / next
 * step) plus a guarded stage suggestion. The rep reviews and confirms before it
 * is saved — this only drafts, it never writes to the lead.
 */
export async function processVisitCapture(
  organizationId: string,
  userId: string,
  lead: LeadContext,
  transcript: string,
  nowIso: string,
): Promise<VisitCaptureDraft> {
  const client = ensureClient();
  const input = `${formatLeadContext(lead)}\n\nToday is ${nowIso}.\nRaw voice note dictated by the rep right after a field visit:\n${transcript}`;
  const raw = await chatJson<{
    outcome: string;
    whoMet: string | null;
    competitor: string | null;
    objection: string | null;
    nextStep: string | null;
    suggestedDueAt: string | null;
    summary: string;
    suggestedStage: string | null;
  }>(
    client,
    `You are a CRM assistant for field sales reps. Turn a rep's rough post-visit voice note into a structured visit report. Return JSON only:
{
  "outcome": string,            // short result of the visit, e.g. "Interested", "Requested quote", "Not now", "Closed-won"
  "whoMet": string|null,        // person and/or role they met
  "competitor": string|null,    // competitor named, else null
  "objection": string|null,     // main concern/objection raised, else null
  "nextStep": string|null,      // one concrete next action the rep should take, else null
  "suggestedDueAt": string|null,// ISO 8601 datetime for the next step if a timeframe is implied (e.g. "Thursday", "next week"), resolved against today's date; else null
  "summary": string,            // 1-3 sentence clean summary for the CRM note
  "suggestedStage": string|null // one of NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST if the visit clearly advances the deal, else null
}
Use only facts stated in the note; put null for anything not mentioned. Never invent names, competitors, or commitments. Preserve the rep's meaning. The lead's current stage is ${lead.stage}.`,
    input,
  );

  let suggestedStage: LeadStage | undefined;
  if (raw.suggestedStage && CAPTURE_STAGES.includes(raw.suggestedStage as LeadStage)) {
    const candidate = raw.suggestedStage as LeadStage;
    if (
      candidate !== lead.stage &&
      lead.stage !== 'WON' &&
      isAllowedStageTransition(lead.stage, candidate)
    ) {
      suggestedStage = candidate;
    }
  }

  await audit({
    organizationId,
    userId,
    feature: 'visit_capture',
    inputSummary: transcript.slice(0, 2000),
    outputSummary: JSON.stringify({
      outcome: raw.outcome,
      nextStep: raw.nextStep,
      suggestedStage: suggestedStage ?? null,
    }),
    approved: false,
  });

  return {
    outcome: raw.outcome,
    whoMet: raw.whoMet ?? undefined,
    competitor: raw.competitor ?? undefined,
    objection: raw.objection ?? undefined,
    nextStep: raw.nextStep ?? undefined,
    suggestedDueAt: raw.suggestedDueAt ?? undefined,
    summary: raw.summary,
    suggestedStage,
  };
}

export async function transcribeVoiceNote(
  organizationId: string,
  userId: string,
  audioBase64: string,
  mimeType?: string,
): Promise<{ transcript: string }> {
  const client = ensureClient();
  const ext =
    mimeType?.includes('webm') ? 'webm' : mimeType?.includes('wav') ? 'wav' : 'm4a';
  const transcript = await transcribeAudio(client, audioBase64, ext);
  await audit({
    organizationId,
    userId,
    feature: 'voice_transcribe',
    inputSummary: `audio:${ext}`,
    outputSummary: transcript.slice(0, 200),
  });
  return { transcript };
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

/** PRO-001: suggest source + priority for new lead capture. */
export async function suggestLeadCapture(
  organizationId: string,
  userId: string,
  input: { name: string; company?: string; email?: string; phone?: string; notes?: string },
): Promise<{ source: string | null; priority: 'HOT' | 'WARM' | 'COLD' | null; reason: string }> {
  const hay = `${input.name} ${input.company ?? ''} ${input.notes ?? ''}`.toLowerCase();
  const rulesSource =
    hay.includes('referral') || hay.includes('partner')
      ? 'Partner referral'
      : hay.includes('web') || hay.includes('website')
        ? 'Website'
        : hay.includes('event') || hay.includes('expo')
          ? 'Event'
          : null;
  const rulesPriority =
    hay.includes('urgent') || hay.includes('hot') || hay.includes('asap')
      ? ('HOT' as const)
      : hay.includes('cold') || hay.includes('later')
        ? ('COLD' as const)
        : null;

  if (!config.aiEnabled) {
    return {
      source: rulesSource,
      priority: rulesPriority ?? 'WARM',
      reason: 'Rules-based suggestion (AI off).',
    };
  }

  try {
    const client = ensureClient();
    const result = await chatJson<{
      source: string | null;
      priority: 'HOT' | 'WARM' | 'COLD' | null;
      reason: string;
    }>(
      client,
      'Suggest CRM lead source and priority for a new lead. Return JSON: { "source": string|null, "priority": "HOT"|"WARM"|"COLD"|null, "reason": string }.',
      JSON.stringify(input),
    );
    await audit({
      organizationId,
      userId,
      feature: 'lead_capture_suggest',
      inputSummary: JSON.stringify(input),
      outputSummary: `${result.source}/${result.priority}`,
    });
    return result;
  } catch {
    return {
      source: rulesSource,
      priority: rulesPriority ?? 'WARM',
      reason: 'Fallback rules (AI unavailable).',
    };
  }
}

export type PhotoCaptureCategory = 'EXHIBITION_TENDER' | 'BILLBOARD_SIGNBOARD';

export type PhotoCaptureFields = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  eventName?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  venue?: string;
  whatFor?: string;
  /** Stall/registration/exhibitor fee mentioned on the flyer, verbatim (e.g. "KES 50,000 per stall"). */
  participationFee?: string;
  pitchNote: string;
};

const PHOTO_CAPTURE_PROMPTS: Record<PhotoCaptureCategory, string> = {
  EXHIBITION_TENDER:
    `You read photos of exhibition flyers, trade-show ads, and tender/procurement notices for a B2B sales team. ` +
    `Extract what a rep would need to follow up and attend. Return JSON only: ` +
    `{ "name": string, "company": string|null, "email": string|null, "phone": string|null, "address": string|null, ` +
    `"eventName": string|null, "eventStartDate": string|null, "eventEndDate": string|null, "venue": string|null, ` +
    `"whatFor": string|null, "participationFee": string|null, "pitchNote": string }. ` +
    `"name" is a contact/organizer name if visible, else use the event or company name. "company" is the organizing company/exhibitor if shown. ` +
    `eventStartDate/eventEndDate are ISO 8601 dates (date only, no time) if a date range is shown on the flyer — resolve into a specific year if the flyer states one, otherwise omit. ` +
    `"whatFor" is a one-line description of what the event/tender is about. ` +
    `"participationFee" is any stall booking, registration, exhibitor, or entry fee/cost mentioned on the flyer, written exactly as shown (amount + currency); null if no fee is mentioned. ` +
    `"pitchNote" is 2-4 sentences a sales rep can use: what to bring up, why this exhibition/tender is relevant, and a suggested opening approach. Use only what's visible in the photo — never invent contact details.`,
  BILLBOARD_SIGNBOARD:
    `You read photos of billboards and company signboards for a B2B sales team scouting prospects. ` +
    `Extract what's visible and draft a pitch angle. Return JSON only: ` +
    `{ "name": string, "company": string|null, "email": string|null, "phone": string|null, "address": string|null, ` +
    `"whatFor": string|null, "pitchNote": string }. ` +
    `"name" is a contact name if shown, else use the company name. "company" is the business named on the sign. ` +
    `"whatFor" is what the sign advertises or what the company does. ` +
    `"pitchNote" is 2-4 sentences: a suggested opening approach for a cold visit/call. Use only what's visible in the photo — never invent contact details.`,
};

/**
 * Photo-capture lead generation: read a photo of an exhibition flyer, tender
 * notice, billboard, or company signboard and extract lead-ready fields plus a
 * drafted pitch note. Review-before-save, like parseBusinessCard — this only
 * extracts, it never creates the lead.
 */
export async function parsePhotoCapture(
  organizationId: string,
  userId: string,
  input: { imageBase64: string; imageMimeType: string; category: PhotoCaptureCategory },
): Promise<PhotoCaptureFields> {
  const client = ensureClient();
  const raw = input.imageBase64.replace(/^data:image\/[a-z+]+;base64,/, '');
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: PHOTO_CAPTURE_PROMPTS[input.category] },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Extract the fields from this photo.' },
        {
          type: 'image_url',
          image_url: { url: `data:${input.imageMimeType};base64,${raw}`, detail: 'high' },
        },
      ],
    } as OpenAI.Chat.ChatCompletionMessageParam,
  ];

  const res = await client.chat.completions.create({
    model: config.openaiModel,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });
  const text = res.choices[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

  const participationFee = str(parsed.participationFee);
  const basePitchNote = str(parsed.pitchNote) ?? 'Review the attached photo for context before reaching out.';

  const fields: PhotoCaptureFields = {
    name: str(parsed.name) ?? str(parsed.company) ?? str(parsed.eventName) ?? 'Unknown contact',
    company: str(parsed.company),
    email: str(parsed.email),
    phone: str(parsed.phone),
    address: str(parsed.address),
    eventName: str(parsed.eventName),
    eventStartDate: str(parsed.eventStartDate),
    eventEndDate: str(parsed.eventEndDate),
    venue: str(parsed.venue),
    whatFor: str(parsed.whatFor),
    participationFee,
    // Highlighted up top so it's the first thing seen on the lead note, not buried in prose.
    pitchNote: participationFee ? `⚠️ Participation fee: ${participationFee}\n\n${basePitchNote}` : basePitchNote,
  };

  await audit({
    organizationId,
    userId,
    feature: 'photo_capture',
    inputSummary: `[image:${input.category}]`,
    outputSummary: text,
  });
  return fields;
}

/**
 * Has the flyer's own date range already passed? Date-only comparison against
 * today — a show that ends today still counts as current. Billboards/
 * signboards have no dates, so this is always false for them.
 */
export function isPastEvent(fields: Pick<PhotoCaptureFields, 'eventEndDate' | 'eventStartDate'>): string | null {
  const dateStr = fields.eventEndDate ?? fields.eventStartDate;
  if (!dateStr) return null;
  const end = new Date(dateStr);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (endDateOnly >= todayDateOnly) return null;
  return `This event already ended on ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`;
}

/**
 * Billboard/signboard only: a lightweight web-search pass to see what the
 * company might currently need, merged into the pitch note. Best-effort — if
 * Tavily is unconfigured or returns nothing, callers should fall back to the
 * photo-only pitch note rather than fail the whole capture.
 */
export async function researchCompanyForPitch(
  organizationId: string,
  userId: string,
  companyName: string,
  extractedText: string,
): Promise<string | null> {
  if (!orgApiKeys.tavilyApiKey() || !companyName) return null;
  try {
    const results = await tavilySearch(
      `"${companyName}" Kenya "looking for" OR "need" OR procurement OR tender OR "pain point" OR expansion`,
      { maxResults: 3 },
    );
    if (results.length === 0) return null;

    const client = ensureClient();
    const snippets = results
      .map((r) => `- ${r.title}: ${r.content.slice(0, 300)} (${r.url})`)
      .join('\n');
    const result = await chatJson<{ summary: string }>(
      client,
      'You are a B2B sales researcher. Given a company name, what a sign/photo revealed about them, and some web search snippets, write a short (2-3 sentence) note on what this company might currently need or be struggling with, useful for a sales pitch. Return JSON: { "summary": string }. If the snippets are not clearly about this company, say so briefly rather than guessing.',
      JSON.stringify({ companyName, extractedText, snippets }),
    );
    await audit({
      organizationId,
      userId,
      feature: 'photo_capture_research',
      inputSummary: `${companyName}\n${snippets}`,
      outputSummary: result.summary,
    });
    return result.summary;
  } catch (err) {
    console.error('[photo_capture_research] failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
