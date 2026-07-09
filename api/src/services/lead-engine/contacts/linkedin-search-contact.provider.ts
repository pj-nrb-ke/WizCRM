import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { config } from '../../../config.js';
import { tavilySearch } from '../heat-map/tavily.provider.js';

// Finds named decision-makers by searching the public web for their LinkedIn
// profiles (via Tavily) and reading the name + headline straight from the search
// result — no LinkedIn scraping, no paid contact-database credits. This is the
// free source that reliably surfaces Kenyan SME managers the global DBs miss.

// Decision-maker title groups we search for, one query each (keeps Tavily calls low).
const ROLE_QUERIES = [
  'CEO OR "Managing Director" OR "General Manager" OR Founder OR Director',
  'CFO OR "Finance Manager" OR "Finance Director" OR "Head of Finance" OR "Financial Controller" OR Accountant',
  '"IT Manager" OR "ICT Manager" OR "Head of IT" OR CTO OR "Systems Administrator" OR "IT Officer"',
];

const COMPANY_STOPWORDS = new Set([
  'ltd', 'limited', 'plc', 'llc', 'inc', 'incorporated', 'company', 'co', 'corp',
  'corporation', 'group', 'holdings', 'enterprises', 'enterprise', 'kenya', 'ke',
  'east', 'africa', 'international', 'the', 'and',
]);

/** Significant, matchable tokens of a company name (drops "Ltd", "Kenya", etc.). */
export function companyTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !COMPANY_STOPWORDS.has(t));
}

function cleanUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return (url.split('?')[0] ?? url).replace(/\/$/, '');
  }
}

function isLinkedinProfile(url: string): boolean {
  return /linkedin\.com\/(in|pub)\//i.test(url);
}

/** A plausible personal name: 2–4 alphabetic words. */
function looksLikeName(s: string): boolean {
  if (!s) return false;
  const words = s.trim().split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
}

/**
 * Parse a LinkedIn search-result title into { name, headline }, e.g.
 *   "Hassan Binott - Full-Stack Software Developer · IT… | LinkedIn"
 *   "Leonard Sang - Head of Business | Hermosa Paints Ltd"
 *   "Joseph Maina - Hermosa Paints Ltd | LinkedIn"
 */
export function parseTitle(rawTitle: string): { name: string | null; headline: string | null } {
  let t = rawTitle.trim().replace(/\s*[|\-–—]\s*linkedin.*$/i, '').trim();
  const sep = t.search(/\s[-–—]\s/);
  if (sep < 0) return { name: looksLikeName(t) ? t : null, headline: null };

  const name = t.slice(0, sep).trim();
  let rest = t.slice(sep).replace(/^\s*[-–—]\s*/, '').trim();
  const bar = rest.indexOf('|');
  if (bar >= 0) rest = rest.slice(0, bar).trim();

  return {
    name: looksLikeName(name) ? name : null,
    headline: rest.length > 1 ? rest.slice(0, 120) : null,
  };
}

export class LinkedinSearchContactProvider extends ContactProvider {
  readonly name = 'linkedin-search';

  async findContacts(
    companyName: string,
    _domain: string | null,
    _opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    if (!config.tavilyApiKey || !companyName.trim()) return [];

    const tokens = companyTokens(companyName);
    if (tokens.length === 0) return [];

    const seen = new Set<string>();
    const out: ClassifiedContact[] = [];

    for (const roles of ROLE_QUERIES) {
      let results;
      try {
        results = await tavilySearch(`"${companyName}" (${roles})`, {
          includeDomains: ['linkedin.com'],
          maxResults: 6,
        });
      } catch {
        continue;
      }

      for (const r of results) {
        if (!isLinkedinProfile(r.url)) continue;

        // Must plausibly be the RIGHT company — a company token in title/snippet/url.
        const haystack = `${r.title} ${r.content} ${r.url}`.toLowerCase();
        if (!tokens.some((tok) => haystack.includes(tok))) continue;

        const { name, headline } = parseTitle(r.title);
        if (!name) continue;

        // If the "headline" is really just the company name, treat title as unknown.
        const headlineTokens = headline ? companyTokens(headline) : [];
        const headlineIsCompany =
          headlineTokens.length > 0 && headlineTokens.every((tt) => tokens.includes(tt));
        const title = headlineIsCompany ? null : headline;

        const url = cleanUrl(r.url);
        const key = url.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        out.push(
          classifyContact({
            name,
            title,
            email: null,
            phone: null,
            linkedinUrl: url,
            source: 'linkedin-search',
          }),
        );
      }

      await new Promise((res) => setTimeout(res, 200));
      if (out.length >= 10) break;
    }

    return out;
  }
}
