import { prisma } from '../../lib/prisma.js';
import { normalizeName } from './discovery/google-places.provider.js';
import type { CompanyCandidate } from './types.js';

export interface DedupResult {
  isNew: boolean;
  existingLeadId: string | null;
  existingProspectId: string | null;
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`)
      .hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-9) : null; // last 9 digits
}

export async function dedupAgainstCrm(
  organizationId: string,
  candidate: CompanyCandidate,
): Promise<DedupResult> {
  const domain = extractDomain(candidate.website);
  const phone = normalizePhone(candidate.phone);
  const normName = candidate.normalizedName;
  const companyName = candidate.companyName;

  // ── 1. Check existing CRM Leads ──────────────────────────────────────────
  const leadOrClauses: object[] = [];
  if (domain) {
    leadOrClauses.push({ emailNormalized: { endsWith: `@${domain}` } });
  }
  if (phone) {
    leadOrClauses.push({ phoneNormalized: { endsWith: phone } });
  }
  if (companyName) {
    leadOrClauses.push({ company: { equals: companyName, mode: 'insensitive' } });
  }

  const existingLead = leadOrClauses.length
    ? await prisma.lead.findFirst({
        where: { organizationId, OR: leadOrClauses as any },
        select: { id: true },
      })
    : null;

  if (existingLead) {
    return { isNew: false, existingLeadId: existingLead.id, existingProspectId: null };
  }

  // ── 2. Check existing Prospects in this org ───────────────────────────────
  const prospectOrClauses: object[] = [];
  if (normName) {
    prospectOrClauses.push({ normalizedName: normName });
  }
  if (phone) {
    prospectOrClauses.push({ phone: { endsWith: phone.slice(-7) } });
  }
  if (domain) {
    prospectOrClauses.push({ website: { contains: domain } });
  }

  const existingProspect = prospectOrClauses.length
    ? await prisma.prospect.findFirst({
        where: { organizationId, OR: prospectOrClauses as any },
        select: { id: true },
      })
    : null;

  if (existingProspect) {
    return { isNew: false, existingLeadId: null, existingProspectId: existingProspect.id };
  }

  return { isNew: true, existingLeadId: null, existingProspectId: null };
}

export { normalizeName, extractDomain };
