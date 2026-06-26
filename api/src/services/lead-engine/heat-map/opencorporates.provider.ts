import { createHash } from 'node:crypto';
import { config } from '../../../config.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';

// OpenCorporates — free REST API for company registrations.
// Kenya jurisdiction code: ke_ncr (Nairobi) OR ke (national).
// Unauthenticated: 100 req/day. With API key: 500 req/day (free tier).
// Docs: https://api.opencorporates.com/documentation/API-Reference
//
// Strategy: pull companies incorporated in the last 6 months in Kenya,
// filtered by industries likely to need ERP/management software.

const BASE_URL = 'https://api.opencorporates.com/v0.4';
const JURISDICTION = 'ke'; // Kenya national registry

// Company types / SIC codes most likely to buy ERP
const SEARCH_TERMS = [
  'manufacturing',
  'distribution',
  'logistics',
  'wholesale',
  'trading',
  'construction',
  'transport',
  'pharmaceutical',
  'food processing',
  'import export',
];

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

function guessCoords(address: string): { lat: number; lng: number } {
  const lower = address.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return CITY_COORDS.nairobi; // default: Nairobi
}

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dedupHash(companyNumber: string): string {
  return createHash('sha256').update('oc:ke:' + companyNumber).digest('hex').slice(0, 20);
}

interface OCCompany {
  company_number: string;
  name: string;
  jurisdiction_code: string;
  incorporation_date: string | null;
  registered_address?: {
    street_address?: string;
    locality?: string;
    region?: string;
    country?: string;
  };
  registered_address_in_full?: string;
  registry_url?: string;
  opencorporates_url: string;
  current_status?: string;
}

interface OCSearchResponse {
  results?: {
    companies?: Array<{ company: OCCompany }>;
    total_count?: number;
    page?: number;
  };
}

async function searchCompanies(
  query: string,
  incorporatedAfter: string,
): Promise<OCCompany[]> {
  const params = new URLSearchParams({
    q:                    query,
    jurisdiction_code:    JURISDICTION,
    incorporated_after:   incorporatedAfter,
    inactive:             'false',
    per_page:             '20',
    order:                'incorporation_date',
  });
  if (config.openCorporatesApiKey) {
    params.set('api_token', config.openCorporatesApiKey);
  }

  const url = `${BASE_URL}/companies/search?${params}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WizCRM/1.0 lead-intelligence (contact: pj@wizag.biz)' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error(`[OpenCorporates] HTTP ${res.status} for query="${query}"`);
    return [];
  }

  const data = (await res.json()) as OCSearchResponse;
  return (data.results?.companies ?? []).map((c) => c.company);
}

export class OpenCorporatesProvider extends SignalProvider {
  readonly name = 'opencorporates';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    const signals: IntentSignalRaw[] = [];
    const seen    = new Set<string>();
    const cutoff  = sixMonthsAgo();

    // Use campaign keywords + standard ERP-buyer industry terms
    const queries = [
      ...productKeywords.slice(0, 2),
      ...SEARCH_TERMS.slice(0, 3),
    ].slice(0, 4); // stay within free-tier rate limits

    for (const query of queries) {
      try {
        const companies = await searchCompanies(query, cutoff);

        for (const co of companies) {
          if (!co.company_number) continue;

          const hash = dedupHash(co.company_number);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const address = co.registered_address_in_full
            ?? [co.registered_address?.locality, co.registered_address?.region].filter(Boolean).join(', ')
            ?? '';

          // Skip if address is outside target locations (when locations are specified)
          if (locations.length > 0) {
            const addrLower = address.toLowerCase();
            const inTarget  = locations.some((loc) => addrLower.includes(loc.toLowerCase()));
            // If we can't confirm location, still include — OC data is sparse
            if (address && !inTarget && !addrLower.includes('kenya')) continue;
          }

          const coords = guessCoords(address);
          const incDate = co.incorporation_date ? new Date(co.incorporation_date) : undefined;
          const ageMonths = incDate
            ? (Date.now() - incDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
            : 99;

          // Newer companies = warmer — they're actively building their operational stack
          const intentStrength: IntentSignalRaw['intentStrength'] =
            ageMonths <= 1 ? 'HOT' : ageMonths <= 3 ? 'WARM' : 'MEDIUM';

          signals.push({
            source:          'SOCIAL',
            platform:        'opencorporates',
            title:           co.name,
            snippet:         address
              ? `Registered in Kenya${address ? ` · ${address}` : ''}${co.incorporation_date ? ` · Incorporated ${co.incorporation_date}` : ''}`
              : `Newly registered company in Kenya${co.incorporation_date ? ` (${co.incorporation_date})` : ''}`,
            url:             co.opencorporates_url,
            authorCompany:   co.name,
            location:        address || 'Kenya',
            lat:             coords.lat,
            lng:             coords.lng,
            publishedAt:     incDate,
            intentStrength,
            engagementScore: Math.max(0, Math.round(90 - ageMonths * 5)), // fresher = higher score
            dedupHash:       hash,
            raw:             {
              companyNumber:     co.company_number,
              jurisdictionCode:  co.jurisdiction_code,
              incorporationDate: co.incorporation_date ?? '',
              status:            co.current_status ?? '',
            },
          });
        }
      } catch (err) {
        console.error('[OpenCorporates] query failed:', err instanceof Error ? err.message : err);
      }

      // 1 second between calls — OpenCorporates is strict on rate limits
      await new Promise((r) => setTimeout(r, 1000));
    }

    return signals;
  }
}
