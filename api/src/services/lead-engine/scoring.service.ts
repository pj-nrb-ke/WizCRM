import type { CompanyCandidate, ScoringRules, ScoreResult } from './types.js';
import { defaultScoringRules } from './campaign.service.js';

/** Reputation thresholds for built-in firmographic signals (Google Places data). */
const STRONG_RATING = 4.0;
const STRONG_REVIEWS = 20;
const ESTABLISHED_REVIEWS = 50;

/** Safely read a finite number from the candidate's raw discovery payload. */
function rawNumber(raw: Record<string, unknown>, key: string): number | null {
  const value = raw[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function scoreCandidate(
  candidate: CompanyCandidate,
  rules: ScoringRules,
  campaignKeywords: string[],
): ScoreResult {
  const thresholds = rules.tierThresholds ?? { A: 60, B: 35, C: 15 };
  let rawScore = 0;

  const breakdown = (rules.signals ?? []).map((signal) => {
    let detected = false;

    if (signal.builtIn === 'has_website') {
      detected = Boolean(candidate.website);
    } else if (signal.builtIn === 'has_phone') {
      detected = Boolean(candidate.phone);
    } else if (signal.builtIn === 'has_rating') {
      detected = rawNumber(candidate.raw, 'rating') !== null;
    } else if (signal.builtIn === 'strong_reputation') {
      const rating = rawNumber(candidate.raw, 'rating');
      const reviews = rawNumber(candidate.raw, 'reviewCount');
      detected =
        rating !== null && reviews !== null && rating >= STRONG_RATING && reviews >= STRONG_REVIEWS;
    } else if (signal.builtIn === 'established') {
      const reviews = rawNumber(candidate.raw, 'reviewCount');
      detected = reviews !== null && reviews >= ESTABLISHED_REVIEWS;
    } else {
      // Keyword matching: use signal-level keywords, fall back to campaign keywords
      const keywords = signal.matchKeywords?.length ? signal.matchKeywords : campaignKeywords;
      const haystack = [candidate.companyName, candidate.industry ?? '', ...candidate.sectorTags]
        .join(' ')
        .toLowerCase();

      detected = keywords.some((kw) => haystack.includes(kw.toLowerCase()));

      // Also check Google Places types
      if (!detected && signal.matchPlaceTypes?.length) {
        detected = signal.matchPlaceTypes.some((t) => candidate.sectorTags.includes(t));
      }
    }

    if (detected) rawScore += signal.points;
    return { key: signal.key, label: signal.label, points: signal.points, detected };
  });

  let tier: string | null = null;
  if (rawScore >= thresholds.A) tier = 'A';
  else if (rawScore >= thresholds.B) tier = 'B';
  else if (rawScore >= thresholds.C) tier = 'C';

  return { score: Math.max(0, rawScore), tier, breakdown };
}

export function parseScoringRules(raw: unknown): ScoringRules {
  if (raw && typeof raw === 'object' && 'signals' in raw) {
    return raw as ScoringRules;
  }
  return defaultScoringRules();
}
