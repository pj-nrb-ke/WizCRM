import { FirecrawlEnrichmentProvider } from './firecrawl.provider.js';
import type { CompanyProfile } from '../types.js';

const provider = new FirecrawlEnrichmentProvider();

export async function enrichCompany(website: string | null | undefined): Promise<CompanyProfile | null> {
  if (!website) return null;
  return provider.enrich(website);
}
