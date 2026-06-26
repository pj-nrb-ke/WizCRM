import { config } from '../../../config.js';

export interface ApolloContact {
  name:        string;
  title:       string;
  email:       string | null;
  phone:       string | null;
  linkedinUrl: string | null;
  company:     string | null;
  companySize: string | null;
  industry:    string | null;
}

interface ApolloPersonRaw {
  name?:          string;
  first_name?:    string;
  last_name?:     string;
  title?:         string;
  email?:         string;
  phone_numbers?: { raw_number?: string }[];
  linkedin_url?:  string;
  organization?: {
    name?:                    string;
    estimated_num_employees?: number;
    industry?:                string;
  };
}

interface ApolloResponse {
  people?: ApolloPersonRaw[];
  error?:  string;
}

const DECISION_TITLES = [
  'Purchasing Manager',
  'Procurement Officer',
  'Procurement Manager',
  'Supply Chain Manager',
  'Operations Director',
  'Operations Manager',
  'Managing Director',
  'Chief Executive Officer',
  'CEO',
  'General Manager',
  'Director',
];

function employeeBand(n?: number): string | null {
  if (!n) return null;
  if (n < 10)   return '1–10';
  if (n < 50)   return '10–50';
  if (n < 200)  return '50–200';
  if (n < 1000) return '200–1,000';
  return '1,000+';
}

function extractCompanyHint(signalTitle: string, signalUrl: string, authorCompany?: string | null): string {
  if (authorCompany && authorCompany.length > 3 && !authorCompany.includes('.')) {
    return authorCompany;
  }
  // Try stripping domain extension to get company name
  try {
    const hostname = new URL(signalUrl).hostname.replace(/^www\./, '');
    const parts    = hostname.split('.');
    if (parts.length >= 2 && parts[0].length > 3) return parts[0];
  } catch { /* ignore */ }
  // Fall back to first 5 words of title
  return signalTitle.split(' ').slice(0, 5).join(' ');
}

export async function getApolloContact(
  signalTitle:   string,
  signalUrl:     string,
  authorCompany: string | null | undefined,
): Promise<ApolloContact | null> {
  if (!config.apolloApiKey) return null;

  const companyHint = extractCompanyHint(signalTitle, signalUrl, authorCompany);

  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_people_search', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    config.apolloApiKey,
      },
      body: JSON.stringify({
        q_organization_name: companyHint,
        person_titles:       DECISION_TITLES,
        per_page:            1,   // exactly 1 credit per call
        page:                1,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[Apollo] HTTP ${res.status}: ${body.slice(0, 200)}`);
      return null;
    }

    const data = (await res.json()) as ApolloResponse;
    const person = data.people?.[0];
    if (!person) return null;

    return {
      name:        (person.name ?? [person.first_name, person.last_name].filter(Boolean).join(' ')) || 'Unknown',
      title:       person.title ?? 'N/A',
      email:       person.email ?? null,
      phone:       person.phone_numbers?.[0]?.raw_number ?? null,
      linkedinUrl: person.linkedin_url ?? null,
      company:     person.organization?.name ?? null,
      companySize: employeeBand(person.organization?.estimated_num_employees),
      industry:    person.organization?.industry ?? null,
    };
  } catch (err) {
    console.error('[Apollo] request failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
