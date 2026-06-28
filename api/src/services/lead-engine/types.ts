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

// ── Enrichment ────────────────────────────────────────────────────────────────

export interface CompanyProfile {
  websiteSummary: string | null;
  estimatedEmployees: string | null;
  sector: string | null;
  accountingSoftware: string | null;
  erpSoftware: string | null;
  genericEmails: string[];
  servicesOrProducts: string[];
  yearFounded: string | null;
  source: string;
  retrievedAt: string;
}

// ── KDPA ──────────────────────────────────────────────────────────────────────

export type FieldClass = 'Firmographic' | 'RoleBasedContact' | 'PersonalContact';

export interface ClassifiedContact {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  fieldClass: FieldClass;
  lawfulBasis: string | null;
  source: string;
  retrievedAt: string;
}

export interface ProvenanceRecord {
  provider: string;
  retrievedAt: string;
  query: string;
}

// ── ICP pipeline result ───────────────────────────────────────────────────────

export interface IcpRunResult {
  discovered: number;
  enriched: number;
  savedProspects: number;
  roleContacts: number;
  personalGated: number;
  dedupMerges: number;
  kdpaCompliant: true;
  prospectIds: string[];
  skippedReasons: string[];
}
