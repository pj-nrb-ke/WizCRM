import { ContactProvider, type ContactProviderOpts } from './contact-provider.interface.js';
import { classifyContact } from '../kdpa.js';
import type { ClassifiedContact } from '../types.js';
import { config } from '../../../config.js';

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    contacts: {
      type: 'array',
      description: 'Named individuals found on the page with their contact details',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name of the person' },
          title: { type: 'string', description: 'Job title or role' },
          email: { type: 'string', description: 'Email address' },
          phone: { type: 'string', description: 'Phone number' },
          linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
        },
      },
    },
  },
};

interface FirecrawlContact {
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
}

interface FirecrawlResponse {
  success?: boolean;
  data?: { extract?: { contacts?: FirecrawlContact[] } };
}

// Kenya SME fallback — scrapes company website for contact info when APIs return nothing.
export class FirecrawlContactProvider extends ContactProvider {
  readonly name = 'firecrawl';

  async findContacts(
    _companyName: string,
    domain: string | null,
    _opts?: ContactProviderOpts,
  ): Promise<ClassifiedContact[]> {
    if (!config.firecrawlApiKey || !domain) return [];

    const urlsToTry = [
      `https://${domain}`,
      `https://${domain}/contact`,
      `https://${domain}/about`,
    ];

    const results: ClassifiedContact[] = [];
    const seenEmails = new Set<string>();

    for (const url of urlsToTry) {
      const contacts = await this.scrapeUrl(url);
      for (const c of contacts) {
        const key = c.email?.toLowerCase() ?? '';
        if (key && seenEmails.has(key)) continue;
        if (key) seenEmails.add(key);
        results.push(c);
      }
      if (results.length >= 5) break;
    }

    return results;
  }

  private async scrapeUrl(url: string): Promise<ClassifiedContact[]> {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.firecrawlApiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['extract'],
          extract: { schema: EXTRACT_SCHEMA },
          timeout: 20_000,
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as FirecrawlResponse;
      if (!data.success || !data.data?.extract?.contacts) return [];

      return data.data.extract.contacts
        .filter((c) => c.name || c.email)
        .map((c) =>
          classifyContact({
            name: c.name ?? null,
            title: c.title ?? null,
            email: c.email ?? null,
            phone: c.phone ?? null,
            linkedinUrl: c.linkedin_url ?? null,
            source: 'firecrawl',
          }),
        );
    } catch {
      return [];
    }
  }
}
