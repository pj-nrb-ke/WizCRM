import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { orgApiKeys } from '../../../lib/org-context.js';

interface ProspeoEmail {
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  linkedin_url?: string;
  email_status?: string;
}

interface ProspeoResponse {
  error?: boolean;
  data?: { emails?: ProspeoEmail[] };
}

export class ProspeoContactProvider extends ContactProvider {
  readonly name = 'prospeo';

  async findContacts(
    _companyName: string,
    domain: string | null,
    _opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    if (!orgApiKeys.prospeoApiKey() || !domain) return [];

    // Company-name search has ~0.9% accuracy per benchmarks; domain search ~33%.
    // Skip entirely when domain is unknown.
    return this.searchByDomain(domain);
  }

  private async searchByDomain(domain: string): Promise<ClassifiedContact[]> {
    try {
      const res = await fetch('https://api.prospeo.io/domain-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': orgApiKeys.prospeoApiKey(),
        },
        body: JSON.stringify({ url: domain, limit: 20 }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Prospeo] HTTP ${res.status}: ${text.slice(0, 200)}`);
        return [];
      }

      const data = (await res.json()) as ProspeoResponse;
      if (data.error || !data.data?.emails) return [];

      return data.data.emails
        .filter((e) => e.email_status !== 'INVALID')
        .map((e) =>
          classifyContact({
            name: e.full_name || [e.first_name, e.last_name].filter(Boolean).join(' ') || null,
            title: e.title ?? null,
            email: e.email ?? null,
            phone: null,
            linkedinUrl: e.linkedin_url ?? null,
            source: 'prospeo',
          }),
        );
    } catch (err) {
      console.error('[Prospeo] failed:', err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}
