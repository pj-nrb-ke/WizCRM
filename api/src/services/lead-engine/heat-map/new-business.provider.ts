import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';
import { tavilySearch, guessCoords, dedupHashUrl, extractDomain } from './tavily.provider.js';

// Newly registered companies are prime ERP targets — setting up systems from scratch.
// We search Kenya Gazette notices, BRS announcements, and business news for new registrations
// in the target industry/location.

function buildQueries(keywords: string[], locations: string[]): string[] {
  const locStr = locations.slice(0, 3).join(' OR ');
  const kwAll  = keywords.slice(0, 3).join(' OR ');

  return [
    `"new company" OR "newly incorporated" (${kwAll}) (${locStr}) 2025`,
    `"business registration" OR "company registered" Kenya (${kwAll}) ${locations[0] ?? 'Nairobi'} 2025`,
    `"opened" OR "launched" OR "new branch" (${kwAll}) (${locStr}) 2025`,
  ];
}

export class NewBusinessProvider extends SignalProvider {
  readonly name = 'new_business';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!config.tavilyApiKey) return [];

    const queries  = buildQueries(productKeywords, locations);
    const signals: IntentSignalRaw[] = [];
    const seen     = new Set<string>();

    for (const query of queries) {
      try {
        const results = await tavilySearch(query, { maxResults: 5 });
        for (const r of results) {
          const hash = dedupHashUrl('newbiz:', r.url);
          if (seen.has(hash)) continue;
          seen.add(hash);
          const fullText = r.title + ' ' + r.content;
          const coords   = guessCoords(fullText);
          signals.push({
            source:          'SOCIAL',
            platform:        'new_business',
            title:           r.title.slice(0, 200),
            snippet:         r.content.slice(0, 350),
            url:             r.url,
            authorCompany:   extractDomain(r.url),
            lat:             coords.lat,
            lng:             coords.lng,
            publishedAt:     r.published_date ? new Date(r.published_date) : undefined,
            // Newly registered = WARM — they will need systems but haven't asked yet
            intentStrength:  'WARM',
            engagementScore: Math.round(r.score * 80),
            dedupHash:       hash,
            raw:             { query, tavilyScore: r.score },
          });
        }
      } catch (err) {
        console.error('[NewBusiness] query failed:', err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    return signals;
  }
}
