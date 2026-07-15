import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { orgApiKeys } from '../../../lib/org-context.js';

/** Generic role-based prefixes — not individual contacts */
const GENERIC_PREFIXES = new Set([
  'info', 'contact', 'admin', 'careers', 'hr', 'vacancy', 'vacancies',
  'recruitment', 'jobs', 'marketing', 'sales', 'support', 'hello',
  'general', 'enquiries', 'enquiry', 'office', 'accounts', 'finance',
  'billing', 'help', 'media', 're', 'security', 'legal', 'compliance',
  'ops', 'operations', 'logistics', 'training', 'newsletter', 'noreply',
  'no-reply', 'donotreply', 'webmaster', 'hostmaster', 'postmaster',
]);

function isGenericEmail(email: string): boolean {
  const prefix = email.split('@')[0]?.toLowerCase().replace(/[._-].*$/, '') ?? '';
  return GENERIC_PREFIXES.has(prefix);
}

interface HunterEmail {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  phone_number?: string;
  linkedin?: string;
  confidence?: number;
  type?: string;
}

interface HunterDomainSearchResponse {
  data?: { emails?: HunterEmail[] };
  errors?: Array<{ details?: string }>;
}

interface HunterDomainFinderEntry {
  domain?: string;
  company_name?: string;
  email_count?: number;
}

// Hunter returns either a single object or an array of candidates
type HunterDomainFinderResponse =
  | { data?: HunterDomainFinderEntry | HunterDomainFinderEntry[] }
  | HunterDomainFinderEntry[];

/** Country-keyword → preferred TLD (tie-breaker only, not primary criterion) */
const COUNTRY_TLDS: Record<string, string> = {
  kenya: '.co.ke',
  nigeria: '.com.ng',
  ghana: '.com.gh',
  uganda: '.co.ug',
  tanzania: '.co.tz',
  'south africa': '.co.za',
  ethiopia: '.com.et',
  rwanda: '.co.rw',
};

/** Words stripped before comparing company name to domain SLD */
const NOISE_WORDS = new Set([
  'kenya', 'nigeria', 'ghana', 'uganda', 'tanzania', 'south', 'africa',
  'ethiopia', 'rwanda', 'limited', 'ltd', 'company', 'co', 'bank', 'group',
  'holdings', 'east', 'west', 'north', 'international', 'services', 'the', 'and',
]);

function scoreDomain(domain: string, companyName: string): number {
  const lowerDomain = domain.toLowerCase();
  const lowerCompany = companyName.toLowerCase();
  const sld = lowerDomain.split('.')[0] ?? '';

  // Extract meaningful words from company name
  const words = lowerCompany
    .split(/[\s,.-]+/)
    .filter((w) => w.length > 1 && !NOISE_WORDS.has(w));
  const baseName = words.join('');

  // ── PRIMARY: name match (determines accept/reject) ──────────────────────
  let nameScore = 0;
  if (baseName && sld) {
    if (sld === baseName) {
      nameScore = 100;                          // exact: "kcb" === "kcb"
    } else if (sld.includes(baseName) || baseName.includes(sld)) {
      nameScore = 50;                           // substring: "kcbgroup" ⊃ "kcb"
    } else if (words.some((w) => w.length >= 3 && sld.includes(w))) {
      nameScore = 20;                           // word match: sld contains a key word
    } else {
      nameScore = -999;                         // NO match → reject this domain
    }
  }

  // ── SECONDARY: country TLD tie-breaker (only adds +15, cannot rescue a bad name) ──
  let countryBonus = 0;
  for (const [country, tld] of Object.entries(COUNTRY_TLDS)) {
    if (lowerCompany.includes(country) && lowerDomain.endsWith(tld)) {
      countryBonus = 15;
      break;
    }
  }

  return nameScore + countryBonus;
}

export class HunterContactProvider extends ContactProvider {
  readonly name = 'hunter';

  async findContacts(
    companyName: string,
    domain: string | null,
    _opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    if (!orgApiKeys.hunterApiKey()) return [];

    const resolvedDomain = domain ?? await this.findDomain(companyName);
    if (!resolvedDomain) return [];

    return this.searchByDomain(resolvedDomain);
  }

  private async findDomain(companyName: string): Promise<string | null> {
    try {
      const url = new URL('https://api.hunter.io/v2/domain-finder');
      url.searchParams.set('company', companyName);
      url.searchParams.set('api_key', orgApiKeys.hunterApiKey());

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return null;

      const raw = (await res.json()) as HunterDomainFinderResponse;

      // Normalise to an array of candidates
      let candidates: HunterDomainFinderEntry[] = [];
      if (Array.isArray(raw)) {
        candidates = raw;
      } else if (Array.isArray((raw as { data?: unknown }).data)) {
        candidates = (raw as { data: HunterDomainFinderEntry[] }).data;
      } else if ((raw as { data?: HunterDomainFinderEntry }).data?.domain) {
        candidates = [(raw as { data: HunterDomainFinderEntry }).data];
      }

      if (candidates.length === 0) return null;

      // Score each candidate and pick the best one
      const scored = candidates
        .filter((c) => c.domain)
        .map((c) => ({ domain: c.domain!, score: scoreDomain(c.domain!, companyName) }))
        .sort((a, b) => b.score - a.score);

      // Don't use a domain that scored very negatively (wrong country)
      const best = scored[0];
      if (!best || best.score < -10) {
        console.log(`[Hunter] No suitable domain for "${companyName}" (best: ${best?.domain} score ${best?.score})`);
        return null;
      }

      console.log(`[Hunter] Resolved "${companyName}" → ${best.domain} (score ${best.score})`);
      return best.domain;
    } catch {
      return null;
    }
  }

  private async searchByDomain(domain: string): Promise<ClassifiedContact[]> {
    try {
      const url = new URL('https://api.hunter.io/v2/domain-search');
      url.searchParams.set('domain', domain);
      url.searchParams.set('limit', '10');
      url.searchParams.set('api_key', orgApiKeys.hunterApiKey());

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Hunter] HTTP ${res.status}: ${text.slice(0, 200)}`);
        return [];
      }

      const data = (await res.json()) as HunterDomainSearchResponse;
      return (data.data?.emails ?? [])
        .filter((e) => e.value && !isGenericEmail(e.value) && (e.first_name || e.last_name))
        .map((e) =>
          classifyContact({
            name: [e.first_name, e.last_name].filter(Boolean).join(' ') || null,
            title: e.position ?? null,
            email: e.value ?? null,
            phone: e.phone_number ?? null,
            linkedinUrl: e.linkedin ?? null,
            source: 'hunter',
          }),
        );
    } catch (err) {
      console.error('[Hunter] failed:', err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}
