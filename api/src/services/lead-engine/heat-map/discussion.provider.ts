import { createHash } from 'node:crypto';
import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';

const KENYA_COORDS: Record<string, { lat: number; lng: number }> = {
  nairobi:  { lat: -1.2921, lng: 36.8219 },
  mombasa:  { lat: -4.0435, lng: 39.6682 },
  nakuru:   { lat: -0.3031, lng: 36.0800 },
  kisumu:   { lat: -0.0917, lng: 34.7680 },
  kenya:    { lat: -1.2921, lng: 36.8219 },
};

function guessCoords(text: string): { lat: number; lng: number } {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return KENYA_COORDS.kenya;
}

function dedupHash(url: string): string {
  return createHash('sha256').update('discussion:' + url).digest('hex').slice(0, 20);
}

interface GoogleCSEItem {
  title: string;
  link: string;
  snippet?: string;
  pagemap?: { metatags?: Array<{ 'article:published_time'?: string }> };
}

interface GoogleCSEResponse {
  items?: GoogleCSEItem[];
  error?: { message: string };
}

export class DiscussionProvider extends SignalProvider {
  readonly name = 'discussion';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!config.googleCustomSearchKey || !config.googleCustomSearchEngineId) {
      return [];
    }

    const signals: IntentSignalRaw[] = [];
    const seen = new Set<string>();
    const locationStr = locations.slice(0, 2).join(' OR ');
    const kwStr = productKeywords.slice(0, 2).join(' OR ');

    const queries = [
      `${kwStr} supplier (${locationStr}) (forum OR discussion OR "looking for" OR "need a")`,
      `${kwStr} procurement Kenya tender OR quote`,
    ];

    for (const q of queries) {
      const params = new URLSearchParams({
        key: config.googleCustomSearchKey,
        cx: config.googleCustomSearchEngineId,
        q,
        num: '10',
        dateRestrict: 'm3',
        lr: 'lang_en',
      });

      try {
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;

        const data = (await res.json()) as GoogleCSEResponse;
        for (const item of data.items ?? []) {
          const hash = dedupHash(item.link);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const fullText = item.title + ' ' + (item.snippet ?? '');
          const coords = guessCoords(fullText);
          const publishedStr = item.pagemap?.metatags?.[0]?.['article:published_time'];

          signals.push({
            source: 'DISCUSSION',
            platform: 'google_search',
            title: item.title.slice(0, 200),
            snippet: item.snippet?.slice(0, 300),
            url: item.link,
            lat: coords.lat,
            lng: coords.lng,
            publishedAt: publishedStr ? new Date(publishedStr) : undefined,
            intentStrength: 'MEDIUM',
            engagementScore: 50,
            dedupHash: hash,
            raw: { query: q },
          });
        }
      } catch {
        // non-fatal
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    return signals;
  }
}
