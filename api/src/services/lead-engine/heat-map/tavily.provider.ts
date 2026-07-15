import { createHash } from 'node:crypto';
import { orgApiKeys } from '../../../lib/org-context.js';
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

// ── Layer 1: Buyer-side intent phrases ─────────────────────────────────────
// These are things BUYERS say — not what vendors or writers say.

const HOT_PHRASES = [
  'tender', 'rfq', 'request for quotation', 'request for proposal', 'rfp',
  'procurement notice', 'bid', 'supply contract', 'purchase order', 'lpo',
  'local purchase order', 'expression of interest', 'eoi',
];

const WARM_PHRASES = [
  'looking for', 'we need', 'need a supplier', 'need a vendor', 'where to buy',
  'recommend', 'sourcing', 'supplier needed', 'quote', 'evaluating',
  'shortlisting', 'seeking suppliers', 'open to suggestions', 'any advice',
  'which software', 'which erp', 'which system',
];

// ── Layer 2: Garbage domains — review sites, vendor comparison, tech media ─
// Tavily exclude_domains blocks these before results even return.

const EXCLUDE_DOMAINS = [
  // Software review / comparison sites
  'g2.com', 'capterra.com', 'getapp.com', 'softwareadvice.com',
  'trustradius.com', 'selecthub.com', 'financesonline.com', 'sourceforge.net',
  'slashdot.org', 'alternativeto.net', 'producthunt.com',
  // Tech media / guides
  'techradar.com', 'pcmag.com', 'tomsguide.com', 'zdnet.com', 'cnet.com',
  'techrepublic.com', 'computerworld.com', 'infoworld.com', 'itprotoday.com',
  // Generic "best of" / listicle sites
  'businessnewsdaily.com', 'forbes.com', 'entrepreneur.com', 'inc.com',
  'investopedia.com', 'nerdwallet.com',
  // ERP vendor own sites (we want buyers, not sellers)
  'sap.com', 'oracle.com', 'netsuite.com', 'microsoft.com', 'sage.com',
  'odoo.com', 'focussoftnet.com', 'tally.com', 'quickbooks.intuit.com',
];

// ── Layer 3: Title garbage patterns — discard before saving ────────────────
// If a title matches any of these, the result is noise, not a buyer signal.

const GARBAGE_TITLE_PATTERNS = [
  /\btop\s+\d+\b/i,                        // "Top 10 ERP systems"
  /\bbest\b.{0,30}\b(erp|software|system)/i,// "Best ERP for..."
  /\bcomplete\s+guide\b/i,                  // "Complete Guide to ERP"
  /\bguide\s+to\b/i,                        // "Guide to ERP"
  /\bhow\s+to\s+choose\b/i,                 // "How to choose ERP"
  /\bwhat\s+is\s+an?\b/i,                   // "What is an ERP?"
  /\b(erp|software|system)\s+review/i,      // "ERP Review 2025"
  /\bcomparison\b/i,                         // "ERP Comparison"
  /\bvs\.?\s+\w/i,                           // "SAP vs Oracle"
  /\b\d{4}\s+guide\b/i,                      // "2025 Guide"
  /\bbuyer'?s?\s+guide\b/i,                  // "Buyer's Guide"
  /\bfeatures?\s+and\s+pricing\b/i,          // "Features and Pricing"
  /\bpricing\s+plans?\b/i,                   // "Pricing Plans"
  /^\[?pdf\]?/i,                             // "[PDF] document"
];

// ── Query builder — buyer-intent only ─────────────────────────────────────
// Every query is written from the BUYER's perspective, not the vendor's.
// We search for companies EXPRESSING a need, not articles ABOUT a need.

function buildQueries(keywords: string[], locations: string[]): string[] {
  const locStr = locations.slice(0, 3).join(' OR ');
  const kw1    = keywords[0] ?? '';
  const kw2    = keywords[1] ?? kw1;
  const kwAll  = keywords.slice(0, 3).join(' OR ');

  return [
    // Formal procurement requests — HOT signals
    `"request for proposal" OR "rfq" OR "expression of interest" software system (${locStr}) 2025 2026`,
    `ERP OR "management system" tender procurement (${locStr}) Kenya 2025 2026`,

    // Companies explicitly saying they need something — WARM signals
    `"${kw1}" business (${locStr}) "looking for" OR "we need" OR "seeking" software system`,
    `"${kw2}" company Kenya "need" OR "want to automate" OR "going digital" OR "digitise" 2025 2026`,

    // Community posts — people asking peers for advice
    `site:reddit.com OR site:quora.com (${kwAll}) Kenya "recommend" OR "which" OR "need help"`,
    `(${locStr}) forum OR community "${kw1}" "which system" OR "recommend software" OR "ERP advice"`,

    // Switching / replacement signals
    `(${locStr}) "${kw1}" company "replace" OR "upgrade from" OR "moving away from" Excel OR QuickBooks OR Sage`,

    // Business growth signals — expanding companies need new systems
    `"${kw1}" company (${locStr}) "opened" OR "new branch" OR "expansion" OR "hired" 2025 2026`,

    // Procurement / supplier listing notices
    `"${kwAll}" "supplier" (${locStr}) "registration" OR "prequalification" OR "approved vendor" 2025`,

    // Pain point expressions
    `(${kwAll}) business Kenya "our records" OR "our books" OR "inventory problem" OR "manual" "need solution"`,
  ].slice(0, 10);
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function isGarbage(title: string, url: string): boolean {
  // Block PDF documents — not buyer signals
  if (/\.pdf($|\?)/i.test(url)) return true;
  // Block title patterns that indicate guides/reviews/vendor content
  return GARBAGE_TITLE_PATTERNS.some((p) => p.test(title));
}

function hasBuyerSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    HOT_PHRASES.some((p)  => lower.includes(p)) ||
    WARM_PHRASES.some((p) => lower.includes(p))
  );
}

export interface TavilyResult {
  title: string; url: string; content: string;
  score: number; published_date?: string;
}

interface TavilyResponse { results?: TavilyResult[]; error?: string; }

export async function tavilySearch(
  query: string,
  opts: { includeDomains?: string[]; excludeDomains?: string[]; maxResults?: number } = {},
): Promise<TavilyResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:             orgApiKeys.tavilyApiKey(),
      query,
      search_depth:        'basic',
      max_results:         opts.maxResults ?? 5,
      include_answer:      false,
      include_raw_content: false,
      // Always exclude garbage domains; caller can add more
      exclude_domains: [...EXCLUDE_DOMAINS, ...(opts.excludeDomains ?? [])],
      ...(opts.includeDomains ? { include_domains: opts.includeDomains } : {}),
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

// ── Provider ───────────────────────────────────────────────────────────────

export class TavilyProvider extends SignalProvider {
  readonly name = 'tavily';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!orgApiKeys.tavilyApiKey()) return [];

    const queries  = buildQueries(productKeywords, locations);
    const signals: IntentSignalRaw[] = [];
    const seen     = new Set<string>();
    let   dropped  = 0;

    for (const query of queries) {
      try {
        const results = await tavilySearch(query);

        for (const r of results) {
          // Layer 2 & 3: discard garbage titles / PDFs
          if (isGarbage(r.title, r.url)) { dropped++; continue; }

          const fullText = r.title + ' ' + r.content;

          // Layer 3: require at least one buyer-side phrase in title+snippet
          // Exception: tender/procurement queries — those are always HOT
          const isTenderQuery = query.includes('tender') || query.includes('rfq') || query.includes('rfp');
          if (!isTenderQuery && !hasBuyerSignal(fullText)) { dropped++; continue; }

          const hash = dedupHashUrl('tavily:', r.url);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const coords = guessCoords(fullText);
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

    if (dropped > 0) console.log(`[Tavily] Filtered out ${dropped} guide/review/vendor results`);
    return signals;
  }
}
