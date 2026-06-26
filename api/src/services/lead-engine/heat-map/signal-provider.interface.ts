export interface IntentSignalRaw {
  source: 'TENDER' | 'SOCIAL' | 'DISCUSSION';
  platform: string;
  title: string;
  snippet?: string;
  url: string;
  authorName?: string;
  authorCompany?: string;
  location?: string;
  lat?: number;
  lng?: number;
  publishedAt?: Date;
  intentStrength: 'HOT' | 'WARM' | 'MEDIUM';
  engagementScore?: number;
  dedupHash?: string;
  raw?: Record<string, unknown>;
}

export abstract class SignalProvider {
  abstract readonly name: string;
  abstract search(
    productKeywords: string[],
    locations: string[],
  ): Promise<IntentSignalRaw[]>;
}
