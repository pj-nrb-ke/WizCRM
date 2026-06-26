import { createHash } from 'node:crypto';
import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';

const KENYA_COORDS: Record<string, { lat: number; lng: number }> = {
  nairobi:  { lat: -1.2921, lng: 36.8219 },
  mombasa:  { lat: -4.0435, lng: 39.6682 },
  nakuru:   { lat: -0.3031, lng: 36.0800 },
  kisumu:   { lat: -0.0917, lng: 34.7680 },
  eldoret:  { lat:  0.5143, lng: 35.2698 },
  thika:    { lat: -1.0332, lng: 37.0693 },
  nyeri:    { lat: -0.4167, lng: 36.9500 },
  malindi:  { lat: -3.2175, lng: 40.1169 },
  kenya:    { lat: -1.2921, lng: 36.8219 },
};

const HOT_PHRASES  = ['tender', 'rfq', 'request for quotation', 'procurement', 'bid', 'supply contract', 'purchase order'];
const WARM_PHRASES = ['looking for', 'need a supplier', 'where to buy', 'recommend', 'sourcing', 'supplier needed', 'quote'];

interface TavilyResult {
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

function guessCoords(text: string): { lat: number; lng: number } {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return KENYA_COORDS.kenya;
}

function guessStrength(text: string): IntentSignalRaw['intentStrength'] {
  const lower = text.toLowerCase();
  if (HOT_PHRASES.some((p) => lower.includes(p)))  return 'HOT';
  if (WARM_PHRASES.some((p) => lower.includes(p))) return 'WARM';
  return 'MEDIUM';
}

function dedupHash(url: string): string {
  return createHash('sha256').update('tavily:' + url).digest('hex').slice(0, 20);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 40);
  }
}

function buildQueries(keywords: string[], locations: string[]): string[] {
  const locStr  = locations.slice(0, 3).join(' OR ');
  const kwShort = keywords.slice(0, 3);
  const queries: string[] = [];

  for (const kw of kwShort) {
    queries.push(`"${kw}" supplier (${locStr}) "looking for" OR "need" OR procurement`);
  }
  queries.push(`${kwShort.join(' OR ')} tender procurement Kenya 2024`);
  queries.push(`${kwShort[0] ?? keywords[0]} buyer (${locStr}) sourcing OR "request for quote"`);

  // Keep within free-tier budget: max 5 queries per scan
  return queries.slice(0, 5);
}

export class TavilyProvider extends SignalProvider {
  readonly name = 'tavily';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!config.tavilyApiKey) return [];

    const queries  = buildQueries(productKeywords, locations);
    const signals: IntentSignalRaw[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key:             config.tavilyApiKey,
            query,
            search_depth:        'basic',
            max_results:         5,
            include_answer:      false,
            include_raw_content: false,
          }),
          signal: AbortSignal.timeout(12000),
        });

        if (!res.ok) {
          console.error(`[Tavily] HTTP ${res.status} for query: "${query}"`);
          continue;
        }

        const data = (await res.json()) as TavilyResponse;

        for (const r of data.results ?? []) {
          const hash = dedupHash(r.url);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const fullText  = r.title + ' ' + r.content;
          const coords    = guessCoords(fullText);
          const strength  = guessStrength(fullText);
          const domain    = extractDomain(r.url);

          signals.push({
            source:         'SOCIAL',
            platform:       'tavily',
            title:          r.title.slice(0, 200),
            snippet:        r.content.slice(0, 350),
            url:            r.url,
            authorCompany:  domain,
            lat:            coords.lat,
            lng:            coords.lng,
            publishedAt:    r.published_date ? new Date(r.published_date) : undefined,
            intentStrength: strength,
            engagementScore: Math.round(r.score * 100),
            dedupHash:      hash,
            raw:            { query, tavilyScore: r.score },
          });
        }
      } catch (err) {
        console.error('[Tavily] query failed:', err instanceof Error ? err.message : err);
      }

      // 200ms between calls — stay polite with the API
      await new Promise((r) => setTimeout(r, 200));
    }

    return signals;
  }
}
