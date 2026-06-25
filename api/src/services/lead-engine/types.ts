export interface CompanyCandidate {
  companyName: string;
  normalizedName: string;
  industry?: string;
  sectorTags: string[];
  address?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  source: string;
  sourceRef?: string;
  raw: Record<string, unknown>;
}

export interface ScoringSignal {
  key: string;
  label: string;
  points: number;
  matchKeywords?: string[];
  matchPlaceTypes?: string[];
  builtIn?: 'has_website' | 'has_phone';
}

export interface ScoringRules {
  signals: ScoringSignal[];
  tierThresholds: { A: number; B: number; C: number };
}

export interface ScoreResult {
  score: number;
  tier: string | null;
  breakdown: Array<{ key: string; label: string; points: number; detected: boolean }>;
}
