import type { CompanyCandidate } from '../types.js';

export abstract class DiscoveryProvider {
  abstract readonly name: string;

  abstract search(
    industryKeywords: string[],
    locations: string[],
    maxPerQuery?: number,
  ): Promise<CompanyCandidate[]>;
}
