import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { orgApiKeys } from '../../../lib/org-context.js';

interface TombaEmail {
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  linkedin?: string;
  phone_number?: string;
}

interface TombaResponse {
  data?: { emails?: TombaEmail[] };
}

export class TombaContactProvider extends ContactProvider {
  readonly name = 'tomba';

  async findContacts(
    _companyName: string,
    domain: string | null,
    _opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    const tombaApiKey = orgApiKeys.tombaApiKey();
    const tombaApiSecret = orgApiKeys.tombaApiSecret();
    if (!tombaApiKey || !tombaApiSecret || !domain) return [];

    try {
      const res = await fetch(
        `https://api.tomba.io/v1/domain-search/${encodeURIComponent(domain)}`,
        {
          headers: {
            'X-Tomba-Key': tombaApiKey,
            'X-Tomba-Secret': tombaApiSecret,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Tomba] HTTP ${res.status}: ${text.slice(0, 200)}`);
        return [];
      }

      const data = (await res.json()) as TombaResponse;
      return (data.data?.emails ?? []).map((e) =>
        classifyContact({
          name: e.full_name || [e.first_name, e.last_name].filter(Boolean).join(' ') || null,
          title: e.position ?? null,
          email: e.email ?? null,
          phone: e.phone_number ?? null,
          linkedinUrl: e.linkedin ?? null,
          source: 'tomba',
        }),
      );
    } catch (err) {
      console.error('[Tomba] failed:', err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}
