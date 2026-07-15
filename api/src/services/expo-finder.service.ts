import type { Prisma } from '@prisma/client';
import type { ExpoRecommendation, ExpoTier } from '@wizcrm/shared';
import { EXPO_RECOMMENDATIONS, EXPO_TIERS } from '@wizcrm/shared';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { chatJson, createOpenAIClient } from './ai/openai.provider.js';
import { createCalendarEvent } from './calendar.service.js';
import { tavilySearch, type TavilyResult } from './lead-engine/heat-map/tavily.provider.js';
import { orgApiKeys } from '../lib/org-context.js';

export class ExpoFinderUnavailableError extends Error {
  readonly code = 'EXPO_FINDER_UNAVAILABLE';
}

export class ExpoNotDatedError extends Error {
  readonly code = 'EXPO_NOT_DATED';
}

/**
 * Search phrases per tier. Each is written to surface *event listings*, not
 * articles about events, and is anchored to WizAG's world: business software,
 * ERP/accounting, IT and the SME trade shows where those buyers gather.
 */
const TIER_QUERIES: Record<ExpoTier, string[]> = {
  LOCAL_KENYA: [
    'upcoming trade fair OR exhibition OR expo Nairobi Kenya business technology dates venue',
    'Kenya exhibition calendar upcoming expo KICC OR "Sarit Expo Centre" OR "Kenyatta International Convention Centre"',
    'Kenya upcoming SME OR manufacturing OR ICT OR accounting expo exhibition dates',
  ],
  EAST_AFRICA: [
    'upcoming trade expo OR exhibition Uganda OR Tanzania OR Rwanda business technology dates venue',
    'East Africa upcoming trade fair exhibition ICT OR manufacturing OR business software dates',
    'Ethiopia OR Kampala OR Dar es Salaam OR Kigali upcoming exhibition expo dates venue',
  ],
  MIDDLE_EAST_AFRICA: [
    'upcoming technology exhibition Dubai OR Abu Dhabi OR Riyadh GITEX dates venue',
    'upcoming business OR ICT exhibition South Africa OR Egypt OR Morocco dates venue',
    'Middle East Africa upcoming trade exhibition enterprise software ERP dates venue',
  ],
  ASIA: [
    'upcoming technology OR business exhibition India OR Singapore dates venue',
    'upcoming trade fair China OR Hong Kong OR Malaysia business technology dates venue',
    'Asia upcoming enterprise software OR ERP OR accounting technology exhibition dates',
  ],
  INTERNATIONAL: [
    'upcoming international technology exhibition Germany OR Netherlands OR United Kingdom dates venue',
    'upcoming global enterprise software OR ERP conference exhibition dates venue',
    'upcoming international business technology trade fair dates venue exhibitors',
  ],
};

/** What the model is allowed to return, before we validate any of it. */
type ExtractedExpo = {
  name?: unknown;
  brief?: unknown;
  positioning?: unknown;
  recommendation?: unknown;
  recommendationReason?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  dateText?: unknown;
  city?: unknown;
  country?: unknown;
  venue?: unknown;
  websiteUrl?: unknown;
  sourceUrl?: unknown;
  industryTags?: unknown;
};

const SYSTEM_PROMPT = `You extract upcoming trade expos and exhibitions from web search results for WizAG, a Kenyan company in Nairobi that sells business software: Sage ERP/accounting, WizCRM, and related IT services. Their buyers are Kenyan and East African SMEs and mid-market firms in manufacturing, distribution, retail and professional services.

You will be given SOURCES: numbered search results, each with a title, URL and snippet.

RULES — follow these exactly:
1. Only report an expo if it is described in the SOURCES. Never add an event from your own knowledge, however famous. If the sources contain no expos, return an empty array.
2. Every factual field (name, dates, city, country, venue) must come from the SOURCES. Do not guess, complete, or correct them.
3. "sourceUrl" MUST be copied verbatim from the URL of the source you took the event from.
4. Dates: if the source states a specific date, give "startDate" and "endDate" as "YYYY-MM-DD". If it only gives a month or is vague, leave both null and put the source's exact wording in "dateText". Never infer a year that the source does not state.
5. If a field is not stated in the source, use null. An empty field is correct; an invented one is not.
6. Skip anything that is not a real expo, exhibition, trade fair or trade show — no webinars, no news articles about events, no listicles, no past events.

JUDGEMENT — these two fields are your opinion, and should be:
- "positioning": one or two sentences on how WizAG should position itself at this event, given what they sell and who attends.
- "recommendation": one of "BOOTH" (worth the cost of a stand), "PARTICIPANT" (attend and network, do not pay for a stand), or "SKIP" (not worth it). "recommendationReason": one sentence saying why.
Weigh relevance to business software buyers, the likely cost of travel from Nairobi, and how well WizAG's buyers are represented.

Return JSON: {"expos":[{"name","brief","positioning","recommendation","recommendationReason","startDate","endDate","dateText","city","country","venue","websiteUrl","sourceUrl","industryTags":[]}]}`;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function asTrimmedString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === 'null' || t.toLowerCase() === 'unknown') return null;
  return t.slice(0, max);
}

/** Accepts only a full, unambiguous calendar date. Anything looser is treated as absent. */
export function parseIsoDate(v: unknown): Date | null {
  const s = asTrimmedString(v, 10);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Confidence is computed from the evidence, not asked of the model — an LLM's
 * self-reported certainty tells you nothing about whether the source said it.
 */
export function scoreConfidence(input: {
  startDate: Date | null;
  venue: string | null;
  websiteUrl: string | null;
  sourcePublishedAt: Date | null;
  now?: Date;
}): number {
  let score = 40;
  if (input.startDate) score += 25;
  if (input.venue) score += 15;
  if (input.websiteUrl) score += 10;
  if (input.sourcePublishedAt) {
    const now = input.now ?? new Date();
    const ageMonths = (now.getTime() - input.sourcePublishedAt.getTime()) / (30 * 86400000);
    if (ageMonths <= 12) score += 10;
  }
  return Math.max(0, Math.min(100, score));
}

/** An expo is upcoming if it has not finished yet. Undated ones stay in, flagged low-confidence. */
export function isUpcoming(startDate: Date | null, endDate: Date | null, now: Date): boolean {
  const last = endDate ?? startDate;
  if (!last) return true;
  return last.getTime() >= now.getTime() - 86400000;
}

/**
 * Catch a stale listing whose date was too loosely worded to parse — "4th-6th
 * September 2025" yields no Date, so the upcoming check would wave it through.
 * If every year named in the text is already behind us, the event is over.
 * No year named means genuinely unknown, which we keep.
 */
export function dateTextLooksPast(dateText: string | null, now: Date): boolean {
  if (!dateText) return false;
  const years = [...dateText.matchAll(/\b(20\d{2})\b/g)].map((m) => Number(m[1]));
  if (years.length === 0) return false;
  return Math.max(...years) < now.getUTCFullYear();
}

export function buildDedupKey(name: string, startDate: Date | null): string {
  const month = startDate ? startDate.toISOString().slice(0, 7) : 'tbd';
  return `${slugify(name)}|${month}`;
}

/**
 * Turn one model row into a database row, or null if it fails validation.
 * `allowedUrls` is the set of URLs actually returned by search — a sourceUrl
 * outside it means the model invented the citation, and the row is discarded.
 */
export function validateExtracted(
  raw: ExtractedExpo,
  tier: ExpoTier,
  allowedUrls: Map<string, TavilyResult>,
  now: Date,
): Omit<Prisma.ExpoCreateManyInput, 'organizationId'> | null {
  const name = asTrimmedString(raw.name, 300);
  if (!name) return null;

  const sourceUrl = asTrimmedString(raw.sourceUrl, 1000);
  if (!sourceUrl) return null;
  const source = allowedUrls.get(sourceUrl);
  if (!source) return null;

  const startDate = parseIsoDate(raw.startDate);
  const endDate = parseIsoDate(raw.endDate);
  if (startDate && endDate && endDate < startDate) return null;
  if (!isUpcoming(startDate, endDate, now)) return null;

  const dateText = startDate ? null : asTrimmedString(raw.dateText, 200);
  if (dateTextLooksPast(dateText, now)) return null;

  const recRaw = asTrimmedString(raw.recommendation, 20)?.toUpperCase();
  const recommendation = EXPO_RECOMMENDATIONS.includes(recRaw as ExpoRecommendation)
    ? (recRaw as ExpoRecommendation)
    : null;

  const venue = asTrimmedString(raw.venue, 300);
  const websiteUrl = asTrimmedString(raw.websiteUrl, 1000);
  const sourcePublishedAt = source.published_date ? new Date(source.published_date) : null;

  const tags = Array.isArray(raw.industryTags)
    ? raw.industryTags
        .map((t) => asTrimmedString(t, 40))
        .filter((t): t is string => !!t)
        .slice(0, 8)
    : [];

  return {
    name,
    dedupKey: buildDedupKey(name, startDate),
    tier,
    brief: asTrimmedString(raw.brief, 2000),
    positioning: asTrimmedString(raw.positioning, 2000),
    recommendation,
    recommendationReason: asTrimmedString(raw.recommendationReason, 1000),
    startDate,
    endDate,
    dateText,
    city: asTrimmedString(raw.city, 120),
    country: asTrimmedString(raw.country, 120),
    venue,
    websiteUrl,
    sourceUrl,
    sourceTitle: source.title.slice(0, 300),
    confidence: scoreConfidence({
      startDate,
      venue,
      websiteUrl,
      sourcePublishedAt: sourcePublishedAt && !Number.isNaN(sourcePublishedAt.getTime())
        ? sourcePublishedAt
        : null,
      now,
    }),
    industryTags: tags,
  };
}

function renderSources(results: TavilyResult[]): string {
  return results
    .map(
      (r, i) =>
        `[${i + 1}] TITLE: ${r.title}\nURL: ${r.url}\n${
          r.published_date ? `PUBLISHED: ${r.published_date}\n` : ''
        }SNIPPET: ${r.content.slice(0, 700)}`,
    )
    .join('\n\n');
}

async function discoverTier(tier: ExpoTier, now: Date) {
  const results: TavilyResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of TIER_QUERIES[tier]) {
    let batch: TavilyResult[] = [];
    try {
      batch = await tavilySearch(query, { maxResults: 6 });
    } catch {
      continue;
    }
    for (const r of batch) {
      if (seenUrls.has(r.url)) continue;
      seenUrls.add(r.url);
      results.push(r);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (results.length === 0) return [];

  const client = createOpenAIClient();
  if (!client) throw new ExpoFinderUnavailableError('OpenAI is not configured');

  const allowedUrls = new Map(results.map((r) => [r.url, r]));
  let parsed: { expos?: ExtractedExpo[] };
  try {
    parsed = await chatJson<{ expos?: ExtractedExpo[] }>(
      client,
      SYSTEM_PROMPT,
      `Today is ${now.toISOString().slice(0, 10)}. Tier: ${tier}.\n\nSOURCES:\n\n${renderSources(results)}`,
    );
  } catch (err) {
    console.error(`[ExpoFinder] extraction failed for ${tier}:`, err instanceof Error ? err.message : err);
    return [];
  }

  const rows = Array.isArray(parsed.expos) ? parsed.expos : [];
  const valid = rows
    .map((r) => validateExtracted(r, tier, allowedUrls, now))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const dropped = rows.length - valid.length;
  if (dropped > 0) {
    console.log(`[ExpoFinder] ${tier}: dropped ${dropped}/${rows.length} rows (past, unsourced or malformed)`);
  }
  return valid;
}

export type DiscoverSummary = {
  tiersSearched: ExpoTier[];
  found: number;
  added: number;
  updated: number;
};

export async function discoverExpos(
  organizationId: string,
  tier?: ExpoTier,
): Promise<DiscoverSummary> {
  if (!orgApiKeys.tavilyApiKey()) throw new ExpoFinderUnavailableError('Web search is not configured');
  if (!config.openaiApiKey) throw new ExpoFinderUnavailableError('OpenAI is not configured');

  const now = new Date();
  const tiers = tier ? [tier] : [...EXPO_TIERS];
  let added = 0;
  let updated = 0;
  let found = 0;

  for (const t of tiers) {
    const rows = await discoverTier(t, now);
    found += rows.length;

    for (const row of rows) {
      const existing = await prisma.expo.findUnique({
        where: { organizationId_dedupKey: { organizationId, dedupKey: row.dedupKey } },
        select: { id: true },
      });

      if (existing) {
        // Refresh the facts, but never clobber what a person decided:
        // whether it is on the calendar, and whether they dismissed it.
        await prisma.expo.update({ where: { id: existing.id }, data: row });
        updated++;
      } else {
        await prisma.expo.create({ data: { ...row, organizationId } });
        added++;
      }
    }
  }

  return { tiersSearched: tiers, found, added, updated };
}

export async function listExpos(
  organizationId: string,
  query: { tier?: ExpoTier; includePast?: boolean; includeDismissed?: boolean },
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 86400000);

  return prisma.expo.findMany({
    where: {
      organizationId,
      ...(query.tier ? { tier: query.tier } : {}),
      ...(query.includeDismissed ? {} : { dismissedAt: null }),
      ...(query.includePast
        ? {}
        : {
            // Undated expos have no end to compare against, so they always show.
            OR: [{ endDate: { gte: cutoff } }, { endDate: null, startDate: { gte: cutoff } }, { startDate: null }],
          }),
    },
    orderBy: [{ startDate: 'asc' }, { confidence: 'desc' }, { name: 'asc' }],
  });
}

/** Everything worth carrying from the expo card onto the calendar event. */
function expoNotes(expo: {
  brief: string | null;
  positioning: string | null;
  recommendation: string | null;
  recommendationReason: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
}): string {
  const parts = [expo.brief];
  if (expo.positioning) parts.push(`Positioning: ${expo.positioning}`);
  if (expo.recommendation) {
    parts.push(
      `Recommendation: ${expo.recommendation}${
        expo.recommendationReason ? ` — ${expo.recommendationReason}` : ''
      }`,
    );
  }
  if (expo.websiteUrl) parts.push(`Website: ${expo.websiteUrl}`);
  parts.push(`Source: ${expo.sourceUrl}`);
  return parts.filter(Boolean).join('\n\n').slice(0, 5000);
}

/**
 * Put an expo on the shared calendar as an all-day EXPO event, optionally
 * inviting colleagues. Calling twice returns the event already created rather
 * than adding a duplicate.
 */
export async function addExpoToCalendar(
  organizationId: string,
  userId: string,
  expoId: string,
  attendeeIds?: string[],
) {
  const expo = await prisma.expo.findFirst({ where: { id: expoId, organizationId } });
  if (!expo) return null;

  if (expo.calendarEventId) {
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: expo.calendarEventId, organizationId },
    });
    if (existing) return { event: existing, alreadyOnCalendar: true };
  }

  if (!expo.startDate) {
    throw new ExpoNotDatedError('This expo has no confirmed date yet, so it cannot be scheduled.');
  }

  const start = new Date(expo.startDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(expo.endDate ?? expo.startDate);
  end.setUTCHours(23, 59, 59, 999);

  const location = [expo.venue, expo.city, expo.country].filter(Boolean).join(', ');

  const event = await createCalendarEvent(organizationId, userId, {
    title: expo.name,
    notes: expoNotes(expo),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay: true,
    eventType: 'EXPO',
    meetingMode: 'IN_PERSON',
    ...(location ? { meetingAddress: location } : {}),
    ...(attendeeIds?.length ? { attendeeIds } : {}),
  });
  if (!event) return null;

  await prisma.expo.update({ where: { id: expo.id }, data: { calendarEventId: event.id } });
  return { event, alreadyOnCalendar: false };
}

export async function dismissExpo(id: string, organizationId: string) {
  const existing = await prisma.expo.findFirst({ where: { id, organizationId } });
  if (!existing) return null;
  return prisma.expo.update({
    where: { id },
    data: { dismissedAt: existing.dismissedAt ? null : new Date() },
  });
}
