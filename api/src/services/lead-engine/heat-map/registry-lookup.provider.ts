import { createHash } from 'node:crypto';
import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';

// Registry Lookup — https://registry-lookup.com
// 5,000 free API calls/month, X-API-Key header auth.
// 521M+ entities across 309 jurisdictions. Kenya = "ke".
// Complements OpenCorporates: different underlying registry feeds = wider coverage.

const BASE_URL = 'https://api.registry-lookup.com/v1';

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  nairobi:  { lat: -1.2921, lng: 36.8219 },
  mombasa:  { lat: -4.0435, lng: 39.6682 },
  thika:    { lat: -1.0332, lng: 37.0693 },
  machakos: { lat: -1.5177, lng: 37.2634 },
  nakuru:   { lat: -0.3031, lng: 36.0800 },
  kisumu:   { lat: -0.0917, lng: 34.7680 },
  eldoret:  { lat:  0.5143, lng: 35.2698 },
  nyeri:    { lat: -0.4167, lng: 36.9500 },
  kisii:    { lat: -0.6817, lng: 34.7667 },
};

// ERP-buyer industry search terms — same as OpenCorporates provider
const SEARCH_TERMS = [
  'manufacturing',
  'distribution',
  'logistics',
  'wholesale',
  'trading',
  'construction',
  'transport',
  'pharmaceutical',
];

function guessCoords(text: string): { lat: number; lng: number } {
  const lower = text.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return CITY_COORDS.nairobi;
}

function dedupHash(id: string): string {
  return createHash('sha256').update('rl:ke:' + id).digest('hex').slice(0, 20);
}

function monthsAgo(date: string | null): number {
  if (!date) return 99;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 30);
}

interface RLCompany {
  id: string;
  legal_name: string;
  jurisdiction_code: string;
  registry_number: string;
  status: string;
  is_active: boolean;
  incorporation_date: string | null;
  legal_form: string | null;
  registered_address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
}

interface RLResponse {
  data?: RLCompany[];
  pagination?: { total: number; page: number; per_page: number };
  error?: string;
}

async function searchCompanies(query: string): Promise<RLCompany[]> {
  if (!config.registryLookupApiKey) return [];

  const params = new URLSearchParams({
    q:            query,
    jurisdiction: 'ke',
    status:       'active',
    per_page:     '20',
  });

  const res = await fetch(`${BASE_URL}/companies/search?${params}`, {
    headers: {
      'X-API-Key':    config.registryLookupApiKey,
      'User-Agent':   'WizCRM/1.0 lead-intelligence (pj@wizag.biz)',
      'Accept':       'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error(`[RegistryLookup] HTTP ${res.status} for query="${query}"`);
    return [];
  }

  const data = (await res.json()) as RLResponse;
  return (data.data ?? []).filter((c) => c.is_active);
}

export class RegistryLookupProvider extends SignalProvider {
  readonly name = 'registry_lookup';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!config.registryLookupApiKey) return [];

    const signals: IntentSignalRaw[] = [];
    const seen    = new Set<string>();

    // Mix campaign-specific keywords with standard ERP-buyer industry terms
    const queries = [
      ...productKeywords.slice(0, 2),
      ...SEARCH_TERMS.slice(0, 3),
    ].slice(0, 4); // 4 queries × 20 results = 80 companies per scan, uses 4 of 5,000 free calls

    for (const query of queries) {
      try {
        const companies = await searchCompanies(query);

        for (const co of companies) {
          const hash = dedupHash(co.id ?? co.registry_number);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const address = [
            co.registered_address?.city,
            co.registered_address?.street,
          ].filter(Boolean).join(', ');

          // Filter to target locations when specified
          if (locations.length > 0 && address) {
            const addrLower = address.toLowerCase();
            const inTarget  = locations.some((l) => addrLower.includes(l.toLowerCase()));
            if (!inTarget && !addrLower.includes('kenya')) continue;
          }

          const coords  = guessCoords(address || 'nairobi');
          const age     = monthsAgo(co.incorporation_date);
          const incDate = co.incorporation_date ? new Date(co.incorporation_date) : undefined;

          const intentStrength: IntentSignalRaw['intentStrength'] =
            age <= 1 ? 'HOT' : age <= 3 ? 'WARM' : 'MEDIUM';

          signals.push({
            source:          'SOCIAL',
            platform:        'registry_lookup',
            title:           co.legal_name,
            snippet:         [
              address ? `Registered address: ${address}` : null,
              co.legal_form ? `Legal form: ${co.legal_form}` : null,
              co.incorporation_date ? `Incorporated: ${co.incorporation_date}` : null,
            ].filter(Boolean).join(' · ') || 'Newly registered company in Kenya',
            url:             `https://registry-lookup.com/companies/${co.jurisdiction_code}/${co.registry_number}`,
            authorCompany:   co.legal_name,
            location:        address || 'Kenya',
            lat:             coords.lat,
            lng:             coords.lng,
            publishedAt:     incDate,
            intentStrength,
            engagementScore: Math.max(0, Math.round(90 - age * 5)),
            dedupHash:       hash,
            raw:             {
              registryNumber:   co.registry_number,
              jurisdictionCode: co.jurisdiction_code,
              incorporationDate: co.incorporation_date ?? '',
              legalForm:        co.legal_form ?? '',
              status:           co.status,
            },
          });
        }
      } catch (err) {
        console.error('[RegistryLookup] query failed:', err instanceof Error ? err.message : err);
      }

      await new Promise((r) => setTimeout(r, 800));
    }

    return signals;
  }
}
