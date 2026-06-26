import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';
import { tavilySearch, guessCoords, guessStrength, dedupHashUrl, extractDomain } from './tavily.provider.js';

function buildLinkedInQueries(keywords: string[], locations: string[]): string[] {
  const locStr = locations.slice(0, 3).join(' OR ');
  const kw1    = keywords[0] ?? '';
  const kwAll  = keywords.slice(0, 3).join(' OR ');

  return [
    `${kw1} (${locStr}) "looking for" OR "seeking" OR "need a supplier" 2025`,
    `(${kwAll}) Kenya ERP OR "management system" OR "accounting software" decision maker`,
    `${kw1} procurement manager OR "supply chain" (${locStr}) sourcing 2025`,
  ];
}

export class LinkedInProvider extends SignalProvider {
  readonly name = 'linkedin';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!config.tavilyApiKey) return [];

    const queries  = buildLinkedInQueries(productKeywords, locations);
    const signals: IntentSignalRaw[] = [];
    const seen     = new Set<string>();

    for (const query of queries) {
      try {
        const results = await tavilySearch(query, {
          includeDomains: ['linkedin.com'],
          maxResults: 5,
        });
        for (const r of results) {
          const hash = dedupHashUrl('linkedin:', r.url);
          if (seen.has(hash)) continue;
          seen.add(hash);
          const fullText = r.title + ' ' + r.content;
          const coords   = guessCoords(fullText);
          signals.push({
            source:          'SOCIAL',
            platform:        'linkedin',
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
        console.error('[LinkedIn] query failed:', err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return signals;
  }
}
