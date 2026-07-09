import { prisma } from '../../lib/prisma.js';
import { findContactsForCompanies } from './contact-finder.service.js';
import type { ClassifiedContact } from '../lead-engine/types.js';

// ── The "buying committee" we try to fill for every lead ────────────────────
// For a Sage Evolution ERP + WizCRM sale three roles decide: the owner/boss,
// finance (the economic buyer — ERP *is* the accounting system) and IT (owns
// the rollout). We match all the Kenyan title variants, not one fixed string.

export type DecisionRole = 'BOSS' | 'FINANCE' | 'IT' | 'OTHER';

const IT_RE =
  /\b(it|ict|i\.t\.|information tech\w*|systems?|sys ?admin|network|infrastructure|cto|chief technolog\w*|head of (it|ict|technolog\w*)|technolog\w*|software|developer|dev ?ops)\b/i;
const FINANCE_RE =
  /\b(cfo|chief financial|finance|financial|controller|account(s|ant|ing)?|cpa|bursar|treasur\w*|head of finance)\b/i;
const BOSS_RE =
  /\b(ceo|chief executive|managing director|md|general manager|gm|founder|co-?founder|proprietor|proprietress|owner|director|partner|principal)\b/i;

/** Classify a job title into one of the buying-committee slots. */
export function classifyRole(title: string | null | undefined): DecisionRole {
  const t = (title ?? '').trim();
  if (!t) return 'OTHER';
  // Order matters: an "IT Director" / "Finance Director" is IT / Finance, not BOSS.
  if (IT_RE.test(t)) return 'IT';
  if (FINANCE_RE.test(t)) return 'FINANCE';
  if (BOSS_RE.test(t)) return 'BOSS';
  return 'OTHER';
}

// ── Result shapes ───────────────────────────────────────────────────────────

export interface CommitteeContact {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  /** Heuristic 0..1 — richer records (name+email+phone) score higher. */
  confidence: number;
  role: DecisionRole;
}

export interface BuyingCommittee {
  boss: CommitteeContact[];
  finance: CommitteeContact[];
  it: CommitteeContact[];
  other: CommitteeContact[];
}

export interface Coverage {
  boss: boolean;
  finance: boolean;
  it: boolean;
  /** How many of the 3 core roles are filled. */
  filled: number;
  core: number;
}

export interface CommitteeResult {
  company: string;
  committee: BuyingCommittee;
  coverage: Coverage;
  providers: string[];
  fromCache: boolean;
  totalFound: number;
  cachedAt?: string;
}

function confidenceOf(c: ClassifiedContact): number {
  let score = 0.4;
  if (c.name) score += 0.2;
  if (c.email) score += 0.25;
  if (c.phone) score += 0.1;
  if (c.linkedinUrl) score += 0.05;
  return Math.min(1, Number(score.toFixed(2)));
}

function toCommitteeContact(c: ClassifiedContact): CommitteeContact {
  return {
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    source: c.source,
    confidence: confidenceOf(c),
    role: classifyRole(c.title),
  };
}

/** Group a flat contact list into the buying committee, best-first within each slot. */
export function bucketCommittee(contacts: ClassifiedContact[]): BuyingCommittee {
  const committee: BuyingCommittee = { boss: [], finance: [], it: [], other: [] };
  for (const raw of contacts) {
    const cc = toCommitteeContact(raw);
    if (cc.role === 'BOSS') committee.boss.push(cc);
    else if (cc.role === 'FINANCE') committee.finance.push(cc);
    else if (cc.role === 'IT') committee.it.push(cc);
    else committee.other.push(cc);
  }
  const hasEmail = (x: CommitteeContact) => (x.email ? 0 : 1);
  for (const slot of ['boss', 'finance', 'it', 'other'] as const) {
    committee[slot].sort((a, b) => hasEmail(a) - hasEmail(b) || b.confidence - a.confidence);
  }
  return committee;
}

export function coverageOf(committee: BuyingCommittee): Coverage {
  const boss = committee.boss.length > 0;
  const finance = committee.finance.length > 0;
  const it = committee.it.length > 0;
  return { boss, finance, it, filled: [boss, finance, it].filter(Boolean).length, core: 3 };
}

// Keep cache-key normalization byte-for-byte identical to contact-finder.service.ts
function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Read-only peek: return the last cached committee for a company WITHOUT calling
 * any paid provider. Used to show what we already know at zero credit cost.
 */
export async function peekCommittee(
  organizationId: string,
  companyName: string,
): Promise<CommitteeResult | null> {
  const normalizedName = normalizeName(companyName);
  const cached = await prisma.contactFinderCache.findUnique({
    where: { organizationId_normalizedName: { organizationId, normalizedName } },
    include: { contacts: true },
  });
  if (!cached) return null;

  const contacts: ClassifiedContact[] = cached.contacts.map((c) => ({
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    fieldClass: c.fieldClass as ClassifiedContact['fieldClass'],
    lawfulBasis: c.lawfulBasis,
    source: c.source,
    retrievedAt: c.retrievedAt.toISOString(),
  }));

  const committee = bucketCommittee(contacts);
  return {
    company: companyName,
    committee,
    coverage: coverageOf(committee),
    providers: cached.providers,
    fromCache: true,
    totalFound: contacts.length,
    cachedAt: cached.lastQueriedAt.toISOString(),
  };
}

/**
 * Full fetch: cache-first waterfall (may spend credits on a miss), grouped into
 * the buying committee. The underlying findContactsForCompanies already caches
 * results for 30 days per org+company, so re-runs are free until it goes stale.
 */
export async function findBuyingCommittee(params: {
  organizationId: string;
  companyName: string;
  website?: string | null;
  forceRefresh?: boolean;
}): Promise<CommitteeResult> {
  const { organizationId, companyName, website, forceRefresh } = params;

  const [result] = await findContactsForCompanies(
    [{ name: companyName, website: website ?? null }],
    { organizationId, threshold: 8, forceRefresh: forceRefresh === true },
  );

  const committee = bucketCommittee(result?.contacts ?? []);
  return {
    company: companyName,
    committee,
    coverage: coverageOf(committee),
    providers: result?.providers ?? [],
    fromCache: result?.fromCache ?? false,
    totalFound: result?.totalFound ?? 0,
    cachedAt: result?.cachedAt,
  };
}
