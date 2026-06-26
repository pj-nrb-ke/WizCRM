import { createHash } from 'node:crypto';
import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';

export const KENYA_COORDS: Record<string, { lat: number; lng: number }> = {
  nairobi:  { lat: -1.2921, lng: 36.8219 },
  mombasa:  { lat: -4.0435, lng: 39.6682 },
  nakuru:   { lat: -0.3031, lng: 36.0800 },
  kisumu:   { lat: -0.0917, lng: 34.7680 },
  eldoret:  { lat:  0.5143, lng: 35.2698 },
  thika:    { lat: -1.0332, lng: 37.0693 },
  machakos: { lat: -1.5177, lng: 37.2634 },
  nyeri:    { lat: -0.4167, lng: 36.9500 },
  malindi:  { lat: -3.2175, lng: 40.1169 },
  kisii:    { lat: -0.6817, lng: 34.7667 },
  kenya:    { lat: -1.2921, lng: 36.8219 },
};

const HOT_PHRASES  = ['tender', 'rfq', 'request for quotation', 'procurement', 'bid', 'supply contract', 'purchase order', 'request for proposal', 'rfp', 'lpo', 'local purchase order'];
const WARM_PHRASES = ['looking for', 'need a supplier', 'where to buy', 'recommend', 'sourcing', 'supplier needed', 'quote', 'need a vendor', 'comparing', 'evaluating', 'shortlisting'];

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  results?: TavilyResult[];
  error?: string;
}

export function guessCoords(text: string): { lat: number; lng: number } {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return KENYA_COORDS.kenya;
}

export function guessStrength(text: string): IntentSignalRaw['intentStrength'] {
  const lower = text.toLowerCase();
  if (HOT_PHRASES.some((p)  => lower.includes(p))) return 'HOT';
  if (WARM_PHRASES.some((p) => lower.includes(p))) return 'WARM';
  return 'MEDIUM';
}

export function dedupHashUrl(prefix: string, url: string): string {
  return createHash('sha256').update(prefix + url).digest('hex').slice(0, 20);
}

export function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url.slice(0, 40); }
}

export async function tavilySearch(
  query: string,
  opts: { includeDomains?: string[]; excludeDomains?: string[]; maxResults?: number } = {},
): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:              config.tavilyApiKey,
      query,
      search_depth:         'basic',
      max_results:          opts.maxResults ?? 5,
      include_answer:       false,
      include_raw_content:  false,
      ...(opts.includeDomains ? { include_domains: opts.includeDomains } : {}),
      ...(opts.excludeDomains ? { exclude_domains: opts.excludeDomains } : {}),
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    console.error(`[Tavily] HTTP ${res.status} for: "${query}"`);
    return [];
  }
  const data = (await res.json()) as TavilyResponse;
  return data.results ?? [];
}

function buildQueries(keywords: string[], locations: string[]): string[] {
  const locStr  = locations.slice(0, 3).join(' OR ');
  const kw1     = keywords[0] ?? '';
  const kw2     = keywords[1] ?? kw1;
  const kw3     = keywords[2] ?? kw1;
  const kwAll   = keywords.slice(0, 4).join(' OR ');

  return [
    // Intent-focused buyer signals
    `"${kw1}" supplier (${locStr}) "looking for" OR "need" OR "sourcing"`,
    `"${kw2}" OR "${kw3}" procurement tender Kenya 2025`,
    `${kw1} buyer (${locStr}) "request for quote" OR "rfq" OR "lpo"`,
    // ERP/software-specific switching signals
    `(${kwAll}) "ERP" OR "system upgrade" OR "accounting software" (${locStr}) 2025`,
    `"QuickBooks" OR "Sage" OR "Tally" OR "Excel" replace upgrade (${locStr}) ${kw1}`,
    // Company pain-point research signals
    `(${kwAll}) "manual process" OR "spreadsheet" OR "need system" Kenya`,
    // Forum / discussion discovery
    `${kw1} supplier review (${locStr}) site:reddit.com OR site:quora.com OR site:trustpilot.com`,
    // News: company expansion / investment (new ERP buyers)
    `"new factory" OR "expansion" OR "new office" (${locStr}) (${kwAll}) 2025`,
    // Industry-specific Kenya procurement news
    `(${kwAll}) Kenya procurement news 2025`,
    // Direct "looking to buy" signals
    `"${kw1}" (${locStr}) "we are looking" OR "company is looking" OR "seeking suppliers"`,
  ].slice(0, 10); // max 10 per scan
}

export class TavilyProvider extends SignalProvider {
  readonly name = 'tavily';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!config.tavilyApiKey) return [];

    const queries = buildQueries(productKeywords, locations);
    const signals: IntentSignalRaw[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const results = await tavilySearch(query);
        for (const r of results) {
          const hash = dedupHashUrl('tavily:', r.url);
          if (seen.has(hash)) continue;
          seen.add(hash);
          const fullText = r.title + ' ' + r.content;
          const coords   = guessCoords(fullText);
          signals.push({
            source:          'SOCIAL',
            platform:        'tavily',
            title:           r.title.slice(0, 200),
            snippet:         r.content.slice(0, 350),
            url:             r.url,
            authorCompany:   extractDomain(r.url),
            lat:             coords.lat,
            lng:             coords.lng,
            publishedAt:     r.published_date ? new Date(r.published_date) : undefined,
            intentStrength:  guessStrength(fullText),
            engagementScore: Math.round(r.score * 100),
            dedupHash:       hash,
            raw:             { query, tavilyScore: r.score },
          });
        }
      } catch (err) {
        console.error('[Tavily] query failed:', err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return signals;
  }
}
