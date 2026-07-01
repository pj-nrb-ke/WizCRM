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

interface HunterDomainFinderResponse {
  data?: { domain?: string | null };
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

      const data = (await res.json()) as HunterDomainFinderResponse;
      return data.data?.domain ?? null;
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
