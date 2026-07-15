import { DiscoveryProvider } from './provider.interface.js';
import type { CompanyCandidate } from '../types.js';
import { normalizeName } from './google-places.provider.js';
import { config } from '../../../config.js';
import { orgApiKeys } from '../../../lib/org-context.js';

const APIFY_API = 'https://api.apify.com/v2';
const RUN_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 4_000;

interface ApifyPlace {
  title?: string;
  website?: string;
  phone?: string;
  address?: string;
  location?: { lat: number; lng: number };
  categoryName?: string;
  categories?: string[];
  url?: string;
  placeId?: string;
  totalScore?: number;
  reviewsCount?: number;
}

interface ApifyRunResponse {
  data: { id: string; status: string; defaultDatasetId: string };
}

export class ApifyDiscoveryProvider extends DiscoveryProvider {
  readonly name = 'apify_google_maps';

  async search(
    industryKeywords: string[],
    locations: string[],
    maxPerQuery = 10,
  ): Promise<CompanyCandidate[]> {
    if (!orgApiKeys.apifyToken()) {
      throw new Error('Apify is not configured for your organization — add your Apify token in Data Sources settings.');
    }

    const results: CompanyCandidate[] = [];
    const seen = new Set<string>();

    for (const keyword of industryKeywords) {
      for (const location of locations) {
        const query = `${keyword} in ${location}`;
        try {
          const places = await this.runActor(query, maxPerQuery);
          for (const place of places) {
            const name = place.title?.trim();
            if (!name) continue;
            const norm = normalizeName(name);
            if (seen.has(norm)) continue;
            seen.add(norm);
            const candidate = this.mapPlace(place, query);
            if (candidate) results.push(candidate);
          }
        } catch (err) {
          console.error(
            `[Apify] query "${query}" failed:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }

    return results;
  }

  private async runActor(query: string, maxItems: number): Promise<ApifyPlace[]> {
    const token = orgApiKeys.apifyToken();
    const actorId = config.apifyActorId;

    // Start actor run
    const startRes = await fetch(`${APIFY_API}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: [query],
        maxCrawledPlacesPerSearch: maxItems,
        language: 'en',
        countryCode: 'ke',
        maxImages: 0,
        maxReviews: 0,
        exportPlaceUrls: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!startRes.ok) {
      const body = await startRes.text().catch(() => '');
      throw new Error(`Apify start failed HTTP ${startRes.status}: ${body.slice(0, 200)}`);
    }

    const { data: run } = (await startRes.json()) as ApifyRunResponse;
    const runId = run.id;

    // Poll for completion
    const deadline = Date.now() + RUN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const statusRes = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${token}`, {
        signal: AbortSignal.timeout(8_000),
      });

      if (!statusRes.ok) continue;

      const { data: status } = (await statusRes.json()) as ApifyRunResponse;

      if (status.status === 'SUCCEEDED') {
        const itemsRes = await fetch(
          `${APIFY_API}/datasets/${status.defaultDatasetId}/items?token=${token}&limit=${maxItems}`,
          { signal: AbortSignal.timeout(15_000) },
        );
        if (!itemsRes.ok) return [];
        return (await itemsRes.json()) as ApifyPlace[];
      }

      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status.status)) {
        throw new Error(`Apify run ${runId} ended with status: ${status.status}`);
      }
    }

    throw new Error(`Apify run timed out after ${RUN_TIMEOUT_MS / 1000}s`);
  }

  private mapPlace(place: ApifyPlace, query: string): CompanyCandidate | null {
    const name = place.title?.trim();
    if (!name) return null;

    const sectorTags = (place.categories ?? []).filter(
      (t) => !['point_of_interest', 'establishment'].includes(t),
    );

    return {
      companyName: name,
      normalizedName: normalizeName(name),
      industry: place.categoryName ?? sectorTags[0] ?? undefined,
      sectorTags,
      address: place.address ?? undefined,
      lat: place.location?.lat,
      lng: place.location?.lng,
      phone: place.phone ?? undefined,
      website: place.website ?? undefined,
      source: 'apify_google_maps',
      sourceRef: place.placeId ?? query,
      raw: {
        query,
        placeId: place.placeId,
        mapsUrl: place.url,
        rating: place.totalScore,
        reviewCount: place.reviewsCount,
        retrievedAt: new Date().toISOString(),
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
