import { createHash } from 'node:crypto';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';

const KENYA_COORDS: Record<string, { lat: number; lng: number }> = {
  nairobi:  { lat: -1.2921, lng: 36.8219 },
  mombasa:  { lat: -4.0435, lng: 39.6682 },
  nakuru:   { lat: -0.3031, lng: 36.0800 },
  kisumu:   { lat: -0.0917, lng: 34.7680 },
  eldoret:  { lat:  0.5143, lng: 35.2698 },
  thika:    { lat: -1.0332, lng: 37.0693 },
  machakos: { lat: -1.5177, lng: 37.2634 },
  nyeri:    { lat: -0.4167, lng: 36.9500 },
  kisii:    { lat: -0.6817, lng: 34.7667 },
  kenya:    { lat: -1.2921, lng: 36.8219 },
};

const INTENT_PHRASES = [
  'looking for', 'need a', 'need some', 'where can i', 'where to buy',
  'recommend', 'supplier', 'vendor', 'quote', 'price for', 'how much',
  'anyone know', 'sourcing', 'procurement', 'purchase',
];

const KENYA_SUBREDDITS = ['Kenya', 'nairobi', 'africa', 'entrepreneur', 'smallbusiness'];

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  subreddit: string;
  score: number;
  created_utc: number;
  permalink: string;
}

function intentScore(text: string): number {
  const lower = text.toLowerCase();
  return INTENT_PHRASES.filter((p) => lower.includes(p)).length;
}

function guessCoords(text: string): { lat: number; lng: number } {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(KENYA_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return KENYA_COORDS.kenya;
}

function dedupHash(id: string): string {
  return createHash('sha256').update('reddit:' + id).digest('hex').slice(0, 20);
}

export class RedditProvider extends SignalProvider {
  readonly name = 'reddit';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    const signals: IntentSignalRaw[] = [];
    const seen = new Set<string>();

    const locationTerms = locations.slice(0, 3).join(' OR ');
    const kwTerms = productKeywords.slice(0, 3).map((k) => `"${k}"`).join(' OR ');
    const query = `(${kwTerms}) (${locationTerms})`;

    const subredditQuery = KENYA_SUBREDDITS.join('+');
    const url = `https://www.reddit.com/r/${subredditQuery}/search.json?q=${encodeURIComponent(query)}&sort=new&t=month&limit=25&restrict_sr=1`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WizCRM/1.0 lead-intent-scanner' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return signals;

      const data = (await res.json()) as {
        data?: { children?: Array<{ data: RedditPost }> };
      };

      for (const child of data.data?.children ?? []) {
        const post = child.data;
        const fullText = post.title + ' ' + post.selftext;
        const score = intentScore(fullText);
        if (score === 0) continue;

        const hash = dedupHash(post.id);
        if (seen.has(hash)) continue;
        seen.add(hash);

        const coords = guessCoords(fullText);
        const strength: IntentSignalRaw['intentStrength'] = score >= 3 ? 'WARM' : 'MEDIUM';

        signals.push({
          source: 'SOCIAL',
          platform: 'reddit',
          title: post.title.slice(0, 200),
          snippet: post.selftext?.slice(0, 300) || undefined,
          url: `https://reddit.com${post.permalink}`,
          authorName: post.author,
          location: guessCoords(fullText) === KENYA_COORDS.kenya ? 'Kenya' : undefined,
          lat: coords.lat,
          lng: coords.lng,
          publishedAt: new Date(post.created_utc * 1000),
          intentStrength: strength,
          engagementScore: post.score,
          dedupHash: hash,
          raw: { subreddit: post.subreddit, score: post.score },
        });
      }
    } catch {
      // non-fatal
    }

    // Also search globally (no subreddit restriction) for higher coverage
    try {
      const globalUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query + ' Kenya')}&sort=new&t=month&limit=15`;
      const res = await fetch(globalUrl, {
        headers: { 'User-Agent': 'WizCRM/1.0 lead-intent-scanner' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          data?: { children?: Array<{ data: RedditPost }> };
        };
        for (const child of data.data?.children ?? []) {
          const post = child.data;
          const hash = dedupHash(post.id);
          if (seen.has(hash)) continue;
          const fullText = post.title + ' ' + post.selftext;
          const iScore = intentScore(fullText);
          if (iScore === 0) continue;
          seen.add(hash);
          const coords = guessCoords(fullText);
          signals.push({
            source: 'SOCIAL',
            platform: 'reddit',
            title: post.title.slice(0, 200),
            snippet: post.selftext?.slice(0, 300) || undefined,
            url: `https://reddit.com${post.permalink}`,
            authorName: post.author,
            lat: coords.lat,
            lng: coords.lng,
            publishedAt: new Date(post.created_utc * 1000),
            intentStrength: iScore >= 3 ? 'WARM' : 'MEDIUM',
            engagementScore: post.score,
            dedupHash: hash,
            raw: { subreddit: post.subreddit },
          });
        }
      }
    } catch {
      // non-fatal
    }

    return signals;
  }
}
