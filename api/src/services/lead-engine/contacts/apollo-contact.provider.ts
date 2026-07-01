import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { config } from '../../../config.js';

const DECISION_TITLES = [
  'Purchasing Manager', 'Procurement Officer', 'Procurement Manager',
  'Supply Chain Manager', 'Operations Director', 'Operations Manager',
  'Managing Director', 'Chief Executive Officer', 'CEO', 'General Manager',
  'Director', 'Finance Manager', 'Finance Director', 'Chief Financial Officer',
  'CFO', 'IT Manager', 'Head of Finance', 'Head of Operations',
  'ERP Manager', 'Accounting Manager', 'Controller',
];

interface ApolloPhone { raw_number?: string }

interface ApolloPerson {
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone_numbers?: ApolloPhone[];
  linkedin_url?: string;
}

interface ApolloResponse {
  people?: ApolloPerson[];
  error?: string;
}

export class ApolloContactProvider extends ContactProvider {
  readonly name = 'apollo';

  async findContacts(
    companyName: string,
    domain: string | null,
    opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    if (!config.apolloApiKey) return [];

    const titles = opts?.positionHint
      ? [opts.positionHint, ...DECISION_TITLES]
      : DECISION_TITLES;

    const body: Record<string, unknown> = {
      person_titles: titles,
      per_page: 10,
      page: 1,
    };

    if (domain) {
      body.q_organization_domains = [domain];
    } else {
      body.q_organization_name = companyName;
    }

    try {
      const res = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apolloApiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[Apollo] HTTP ${res.status}: ${text.slice(0, 200)}`);
        return [];
      }

      const data = (await res.json()) as ApolloResponse;

      return (data.people ?? []).map((p) => {
        const fullName =
          p.name?.trim() ||
          [p.first_name, p.last_name].filter(Boolean).join(' ') ||
          null;

        return classifyContact({
          name: fullName,
          title: p.title ?? null,
          email: p.email ?? null,
          phone: p.phone_numbers?.[0]?.raw_number ?? null,
          linkedinUrl: p.linkedin_url ?? null,
          source: 'apollo',
        });
      });
    } catch (err) {
      console.error('[Apollo Contacts] failed:', err instanceof Error ? err.message : String(err));
      return [];
    }
  }
}
