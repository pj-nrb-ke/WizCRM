import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { config } from '../../../config.js';

interface HunterEmail {
  value?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  phone_number?: string;
  linkedin?: string;
  confidence?: number;
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

/** Country-keyword → TLD mapping for domain scoring */
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

function scoreDomain(domain: string, companyName: string): number {
  const lowerDomain = domain.toLowerCase();
  const lowerCompany = companyName.toLowerCase();
  let score = 0;

  // Check if company name contains a country keyword
  for (const [country, tld] of Object.entries(COUNTRY_TLDS)) {
    if (lowerCompany.includes(country)) {
      if (lowerDomain.endsWith(tld)) score += 50;   // Perfect country match
      else score -= 20;                               // Wrong country TLD
    }
  }

  // Prefer domains where the SLD matches the company name (minus country words)
  const baseName = lowerCompany
    .replace(/\b(kenya|nigeria|ghana|uganda|tanzania|south africa|ethiopia|rwanda|limited|ltd|company|co)\b/g, '')
    .trim()
    .replace(/\s+/g, '');
  const sld = lowerDomain.split('.')[0] ?? '';
  if (sld === baseName) score += 30;
  else if (sld.includes(baseName) || baseName.includes(sld)) score += 10;

  return score;
}

export class HunterContactProvider extends ContactProvider {
  readonly name = 'hunter';

  async findContacts(
    companyName: string,
    domain: string | null,
    _opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    if (!config.hunterApiKey) return [];

    const resolvedDomain = domain ?? await this.findDomain(companyName);
    if (!resolvedDomain) return [];

    return this.searchByDomain(resolvedDomain);
  }

  private async findDomain(companyName: string): Promise<string | null> {
    try {
      const url = new URL('https://api.hunter.io/v2/domain-finder');
      url.searchParams.set('company', companyName);
      url.searchParams.set('api_key', config.hunterApiKey);

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
      url.searchParams.set('api_key', config.hunterApiKey);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Hunter] HTTP ${res.status}: ${text.slice(0, 200)}`);
        return [];
      }

      const data = (await res.json()) as HunterDomainSearchResponse;
      return (data.data?.emails ?? []).map((e) =>
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
