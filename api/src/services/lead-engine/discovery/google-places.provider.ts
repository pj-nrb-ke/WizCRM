import { createHash } from 'node:crypto';
import { config } from '../../../config.js';
import type { CompanyCandidate } from '../types.js';
import { DiscoveryProvider } from './provider.interface.js';

interface PlaceResult {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  businessStatus?: string;
  rating?: number;
  userRatingCount?: number;
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.location',
  'places.types',
  'places.businessStatus',
  'places.rating',
  'places.userRatingCount',
].join(',');

// Types that carry no useful sector signal
const GENERIC_TYPES = new Set([
  'point_of_interest',
  'establishment',
  'premise',
  'street_address',
  'geocode',
]);

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const QUERY_DELAY_MS = 350;

export class GooglePlacesProvider extends DiscoveryProvider {
  readonly name = 'google_places';

  async search(
    industryKeywords: string[],
    locations: string[],
    maxPerQuery = 20,
  ): Promise<CompanyCandidate[]> {
    if (!config.googlePlacesApiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY is not configured');
    }

    const results: CompanyCandidate[] = [];
    const seenIds = new Set<string>();

    for (const keyword of industryKeywords) {
      for (const location of locations) {
        const query = `${keyword} in ${location}`;
        try {
          const places = await this.searchText(query, maxPerQuery);
          for (const place of places) {
            const key = place.id ?? place.displayName?.text ?? '';
            if (!key || seenIds.has(key)) continue;
            seenIds.add(key);
            const candidate = this.mapPlace(place, query);
            if (candidate) results.push(candidate);
          }
        } catch (err) {
          console.error(
            `[GooglePlaces] query failed: "${query}"`,
            err instanceof Error ? err.message : err,
          );
        }
        await sleep(QUERY_DELAY_MS);
      }
    }

    return results;
  }

  private async searchText(query: string, maxResultCount: number): Promise<PlaceResult[]> {
    const res = await fetch(PLACES_URL, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': config.googlePlacesApiKey,
        'X-Goog-FieldMask': FIELD_MASK,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ textQuery: query, maxResultCount }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Places API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { places?: PlaceResult[] };
    return data.places ?? [];
  }

  private mapPlace(place: PlaceResult, queryRef: string): CompanyCandidate | null {
    const name = place.displayName?.text;
    if (!name) return null;

    const sectorTags = (place.types ?? []).filter((t) => !GENERIC_TYPES.has(t));

    return {
      companyName: name,
      normalizedName: normalizeName(name),
      industry: sectorTags[0] ?? undefined,
      sectorTags,
      address: place.formattedAddress ?? place.shortFormattedAddress ?? undefined,
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? undefined,
      website: place.websiteUri ?? undefined,
      source: 'google_places',
      sourceRef: place.id ?? queryRef,
      raw: {
        placeId: place.id,
        query: queryRef,
        businessStatus: place.businessStatus,
        rating: place.rating,
        userRatingCount: place.userRatingCount,
        types: place.types,
      },
    };
  }
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(
      /\b(limited|ltd|inc|llc|plc|pvt|private|company|co\b|corp|corporation|group|holdings|kenya|nairobi|africa|east)\b/gi,
      '',
    )
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function buildDedupHash(normalizedName: string, address?: string, phone?: string): string {
  const locality = (address ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  const phoneFragment = (phone ?? '').replace(/\D/g, '').slice(-4);
  return createHash('sha256')
    .update(`${normalizedName}|${locality}|${phoneFragment}`)
    .digest('hex')
    .slice(0, 16);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
