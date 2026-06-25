import type { CompanyCandidate, ScoringRules, ScoreResult } from './types.js';

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
  // Fallback: empty rules — everything scores 0 / tier null (dropped)
  return { signals: [], tierThresholds: { A: 60, B: 35, C: 15 } };
}
