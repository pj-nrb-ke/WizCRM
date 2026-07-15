import { EnrichmentProvider } from './enrichment-provider.interface.js';
import type { CompanyProfile } from '../types.js';
import { orgApiKeys } from '../../../lib/org-context.js';

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    companyDescription: {
      type: 'string',
      description: 'One or two sentences describing what the company does',
    },
    estimatedEmployees: {
      type: 'string',
      description: 'Band estimate of staff count, e.g. "10–50", "200+"',
    },
    sector: {
      type: 'string',
      description: 'Primary industry sector, e.g. "FMCG distribution", "manufacturing"',
    },
    accountingSoftware: {
      type: 'string',
      description: 'Accounting or ERP software mentioned on the site (e.g. QuickBooks, Sage, SAP). Empty string if none.',
    },
    existingErpDetected: {
      type: 'boolean',
      description: 'True only when an ERP or named accounting system is explicitly mentioned.',
    },
    genericEmails: {
      type: 'array',
      items: { type: 'string' },
      description: 'Generic contact emails visible on the page (info@, sales@, etc.). Max 3.',
    },
    servicesOrProducts: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key services or products. Max 5 short labels.',
    },
    yearFounded: {
      type: 'string',
      description: 'Year the company was established, if visible. Empty string if unknown.',
    },
  },
};

interface FirecrawlExtract {
  companyDescription?: string;
  estimatedEmployees?: string;
  sector?: string;
  accountingSoftware?: string;
  existingErpDetected?: boolean;
  genericEmails?: string[];
  servicesOrProducts?: string[];
  yearFounded?: string;
}

interface FirecrawlResponse {
  success: boolean;
  data?: { extract?: FirecrawlExtract };
  error?: string;
}

export class FirecrawlEnrichmentProvider extends EnrichmentProvider {
  readonly name = 'firecrawl';

  async enrich(website: string): Promise<CompanyProfile | null> {
    if (!orgApiKeys.firecrawlApiKey()) return null;

    const url = website.startsWith('http') ? website : `https://${website}`;

    try {
      const res = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgApiKeys.firecrawlApiKey()}`,
        },
        body: JSON.stringify({
          url,
          formats: ['extract'],
          extract: { schema: EXTRACT_SCHEMA },
          timeout: 25_000,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[Firecrawl] HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
        return null;
      }

      const data = (await res.json()) as FirecrawlResponse;
      if (!data.success || !data.data?.extract) return null;

      const ext = data.data.extract;
      return {
        websiteSummary: ext.companyDescription ?? null,
        estimatedEmployees: ext.estimatedEmployees ?? null,
        sector: ext.sector ?? null,
        accountingSoftware: ext.accountingSoftware || null,
        erpSoftware: ext.existingErpDetected ? (ext.accountingSoftware || 'detected') : null,
        genericEmails: ext.genericEmails ?? [],
        servicesOrProducts: ext.servicesOrProducts ?? [],
        yearFounded: ext.yearFounded || null,
        source: 'firecrawl',
        retrievedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.error('[Firecrawl] request failed:', err instanceof Error ? err.message : String(err));
      return null;
    }
  }
}
