import { createHash } from 'node:crypto';
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
  kisii:    { lat: -0.6817, lng: 34.7667 },
  machakos: { lat: -1.5177, lng: 37.2634 },
  kenya:    { lat: -1.2921, lng: 36.8219 },
};

function guessCoords(text: string): { lat: number; lng: number } | undefined {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return undefined;
}

function dedupHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 20);
}

function extractTextBetween(html: string, startTag: string, endTag: string): string[] {
  const results: string[] = [];
  let pos = 0;
  while (pos < html.length) {
    const start = html.indexOf(startTag, pos);
    if (start === -1) break;
    const contentStart = start + startTag.length;
    const end = html.indexOf(endTag, contentStart);
    if (end === -1) break;
    results.push(html.slice(contentStart, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    pos = end + endTag.length;
  }
  return results;
}

function extractLinks(html: string, baseUrl: string): Array<{ text: string; href: string }> {
  const links: Array<{ text: string; href: string }> = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].startsWith('http') ? m[1] : baseUrl + m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 10) links.push({ text, href });
  }
  return links;
}

async function scrapeTendersKenya(keywords: string[]): Promise<IntentSignalRaw[]> {
  const signals: IntentSignalRaw[] = [];
  const seen = new Set<string>();

  for (const kw of keywords.slice(0, 3)) {
    const url = `https://www.tenderskenya.co.ke/?s=${encodeURIComponent(kw)}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WizCRM/1.0; +https://wizcrm.app)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const links = extractLinks(html, 'https://www.tenderskenya.co.ke');
      for (const link of links) {
        if (!link.href.includes('tenderskenya.co.ke') || link.href === url) continue;
        if (link.text.length < 15 || link.text.toLowerCase().includes('home')) continue;
        const hash = dedupHash(link.href);
        if (seen.has(hash)) continue;
        seen.add(hash);
        const coords = guessCoords(link.text);
        signals.push({
          source: 'TENDER',
          platform: 'tenderskenya',
          title: link.text.slice(0, 200),
          url: link.href,
          location: coords ? undefined : 'Kenya',
          lat: coords?.lat,
          lng: coords?.lng ?? (coords ? undefined : KENYA_COORDS.nairobi.lng),
          intentStrength: 'HOT',
          engagementScore: 90,
          dedupHash: hash,
          raw: { query: kw },
        });
        if (signals.length >= 20) break;
      }
    } catch {
      // scrape failure is non-fatal
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return signals;
}

async function scrapePPRA(keywords: string[]): Promise<IntentSignalRaw[]> {
  const signals: IntentSignalRaw[] = [];
  const seen = new Set<string>();

  for (const kw of keywords.slice(0, 2)) {
    const url = `https://ppra.go.ke/web/tenders?search=${encodeURIComponent(kw)}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WizCRM/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const links = extractLinks(html, 'https://ppra.go.ke');
      for (const link of links) {
        if (!link.href.includes('ppra.go.ke/web/tenders')) continue;
        if (link.text.length < 15) continue;
        const hash = dedupHash(link.href);
        if (seen.has(hash)) continue;
        seen.add(hash);
        const coords = guessCoords(link.text);
        signals.push({
          source: 'TENDER',
          platform: 'ppra',
          title: link.text.slice(0, 200),
          url: link.href,
          location: 'Kenya',
          lat: coords?.lat ?? KENYA_COORDS.nairobi.lat,
          lng: coords?.lng ?? KENYA_COORDS.nairobi.lng,
          intentStrength: 'HOT',
          engagementScore: 95,
          dedupHash: hash,
          raw: { query: kw },
        });
        if (signals.length >= 15) break;
      }
    } catch {
      // non-fatal
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return signals;
}

export class TenderProvider extends SignalProvider {
  readonly name = 'tender';

  async search(productKeywords: string[], _locations: string[]): Promise<IntentSignalRaw[]> {
    const [fromTendersKenya, fromPPRA] = await Promise.all([
      scrapeTendersKenya(productKeywords),
      scrapePPRA(productKeywords),
    ]);
    return [...fromPPRA, ...fromTendersKenya];
  }
}
