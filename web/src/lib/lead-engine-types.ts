export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
export type ProspectStatus =
  | 'NEW'
  | 'QUALIFIED'
  | 'ENRICHED'
  | 'EMAILED'
  | 'REPLIED'
  | 'IMPORTED'
  | 'REJECTED'
  | 'SUPPRESSED';

export interface Campaign {
  id: string;
  name: string;
  goal: string | null;
  status: CampaignStatus;
  industryKeywords: string[];
  locations: string[];
  sizeMin: number | null;
  sizeMax: number | null;
  scoringRules: object;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string };
  stats?: { prospects: number; runs: number; emailed: number; replied: number };
  sequences?: SequenceStep[];
  runs?: DiscoveryRun[];
  _count?: { prospects: number };
}

export interface DiscoveryRun {
  id: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  resultsCount: number;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  _count?: { prospects: number };
}

export interface Prospect {
  id: string;
  companyName: string;
  industry: string | null;
  sectorTags: string[];
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  source: string;
  score: number;
  scoreBreakdown: ScoreBreakdownItem[];
  tier: string | null;
  status: ProspectStatus;
  importedLeadId: string | null;
  createdAt: string;
  contacts?: ProspectContact[];
  enrichment?: ProspectEnrichment | null;
  campaign?: { id: string; name: string };
  _count?: { emailSends: number };
}

export interface ProspectContact {
  id: string;
  fullName: string | null;
  role: string | null;
  email: string | null;
  emailStatus: string;
  phone: string | null;
  source: string | null;
  confidence: number;
}

export interface ProspectEnrichment {
  websiteSummary: string | null;
  employeeEstimate: number | null;
  existingErpDetected: boolean;
  signals: Record<string, unknown>;
  enrichedAt: string;
}

export interface ScoreBreakdownItem {
  key: string;
  label: string;
  points: number;
  detected: boolean;
}

export interface SequenceStep {
  id: string;
  stepNumber: number;
  delayDays: number;
  template: { id: string; name: string; subject: string } | null;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  mergeFields: string[];
  createdAt: string;
  createdBy: { id: string; name: string };
}
