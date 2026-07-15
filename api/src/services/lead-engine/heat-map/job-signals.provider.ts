import { orgApiKeys } from '../../../lib/org-context.js';
import { SignalProvider, type IntentSignalRaw } from './signal-provider.interface.js';
import { tavilySearch, guessCoords, dedupHashUrl, extractDomain } from './tavily.provider.js';

// Job posting signals — companies actively hiring HR, Finance, IT, or Payroll roles
// are scaling fast and almost certainly need ERP/HRMS/Payroll software.
// This maps directly to the WIZLead AI scoring model signals:
//   Hiring HR Manager    → +25 pts
//   Hiring Finance Mgr   → +20 pts
//   Hiring Payroll       → +25 pts
//   Hiring IT Manager    → +15 pts

const JOB_QUERIES = [
  // Kenya job boards — BrighterMonday, MyJobMag, Fuzu are the main ones
  'site:brightermonday.co.ke "HR Manager" OR "Human Resources Manager" OR "Payroll Officer" 2025 2026',
  'site:myjobmag.co.ke "Finance Manager" OR "Finance Director" OR "Accountant" manufacturing OR distribution 2025',
  'site:fuzu.com Kenya "IT Manager" OR "ERP" OR "Systems Administrator" manufacturing 2025',
  // General Kenya job search for growing companies
  '"Nairobi" OR "Thika" OR "Machakos" hiring "HR Manager" OR "Finance Manager" OR "Operations Manager" 2025 2026',
];

export class JobSignalsProvider extends SignalProvider {
  readonly name = 'job_signals';

  async search(productKeywords: string[], locations: string[]): Promise<IntentSignalRaw[]> {
    if (!orgApiKeys.tavilyApiKey()) return [];

    const signals: IntentSignalRaw[] = [];
    const seen    = new Set<string>();
    const locStr  = locations.slice(0, 3).join(' OR ');

    // Location-specific job search tailored to the campaign
    const queries = [
      ...JOB_QUERIES,
      // Campaign-aware: company hiring in target location for relevant role
      `(${locStr}) hiring "HR Manager" OR "Finance Manager" OR "IT Manager" OR "Payroll" 2025 2026`,
    ];

    for (const query of queries) {
      try {
        const results = await tavilySearch(query, { maxResults: 5 });

        for (const r of results) {
          const hash = dedupHashUrl('job:', r.url);
          if (seen.has(hash)) continue;
          seen.add(hash);

          const fullText = r.title + ' ' + r.content;
          const coords   = guessCoords(fullText);

          // Determine which hiring signal was matched for scoring context
          const lower = fullText.toLowerCase();
          let strength: IntentSignalRaw['intentStrength'] = 'WARM';
          let score = 60;
          if (lower.includes('payroll') || lower.includes('hr manager') || lower.includes('human resources')) {
            strength = 'HOT'; score = 85; // +25 pts = strong ERP/HRMS signal
          } else if (lower.includes('finance manager') || lower.includes('finance director')) {
            strength = 'HOT'; score = 80; // +20 pts = ERP/accounting signal
          } else if (lower.includes('it manager') || lower.includes('systems') || lower.includes('erp')) {
            strength = 'WARM'; score = 70; // +15 pts
          }

          signals.push({
            source:          'SOCIAL',
            platform:        'job_signals',
            title:           r.title.slice(0, 200),
            snippet:         r.content.slice(0, 350),
            url:             r.url,
            authorCompany:   extractDomain(r.url),
            lat:             coords.lat,
            lng:             coords.lng,
            publishedAt:     r.published_date ? new Date(r.published_date) : undefined,
            intentStrength:  strength,
            engagementScore: score,
            dedupHash:       hash,
            raw:             { query, tavilyScore: r.score },
          });
        }
      } catch (err) {
        console.error('[JobSignals] query failed:', err instanceof Error ? err.message : err);
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return signals;
  }
}
