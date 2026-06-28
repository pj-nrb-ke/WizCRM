import type { CompanyProfile } from '../types.js';

export abstract class EnrichmentProvider {
  abstract readonly name: string;
  abstract enrich(website: string): Promise<CompanyProfile | null>;
}
