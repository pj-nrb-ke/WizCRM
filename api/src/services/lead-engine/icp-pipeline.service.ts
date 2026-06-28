import { prisma } from '../../lib/prisma.js';
import { ApifyDiscoveryProvider } from './discovery/apify.provider.js';
import { enrichCompany } from './enrichment/enrichment.service.js';
import { findContacts } from './contacts/contact.service.js';
import { gatePersonalData } from './kdpa.js';
import { dedupAgainstCrm } from './dedup.service.js';
import { scoreCandidate, parseScoringRules } from './scoring.service.js';
import { buildDedupHash } from './discovery/google-places.provider.js';
import { isSuppressed } from './suppression.service.js';
import { getLeadEngineConfig, isProviderEnabled } from './lead-engine-config.service.js';
import type { IcpRunResult, CompanyProfile, ClassifiedContact } from './types.js';

const apify = new ApifyDiscoveryProvider();

export interface IcpPipelineInput {
  campaignId: string;
  organizationId: string;
  keywords: string[];
  locations: string[];
  limit?: number;
}

export async function runIcpPipeline(input: IcpPipelineInput): Promise<IcpRunResult> {
  const { campaignId, organizationId, keywords, locations, limit = 10 } = input;

  // Load org provider config and campaign scoring rules in parallel
  const [leConfig, campaign] = await Promise.all([
    getLeadEngineConfig(organizationId),
    prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      select: { scoringRules: true },
    }),
  ]);
  const scoringRules = parseScoringRules(campaign?.scoringRules);

  // ── 1. Discover ─────────────────────────────────────────────────────────────
  if (!isProviderEnabled(leConfig, 'apify')) {
    return {
      discovered: 0, enriched: 0, savedProspects: 0, roleContacts: 0,
      personalGated: 0, dedupMerges: 0, kdpaCompliant: true,
      prospectIds: [], skippedReasons: ['Discovery skipped: no discovery provider enabled'],
    };
  }
  const perQuery = Math.min(limit, 20);
  const candidates = await apify.search(keywords, locations, perQuery);

  const result: IcpRunResult = {
    discovered: candidates.length,
    enriched: 0,
    savedProspects: 0,
    roleContacts: 0,
    personalGated: 0,
    dedupMerges: 0,
    kdpaCompliant: true,
    prospectIds: [],
    skippedReasons: [],
  };

  for (const candidate of candidates.slice(0, limit)) {
    // ── 2. Suppression check ──────────────────────────────────────────────────
    const suppressed = await isSuppressed(organizationId, candidate.companyName, candidate.website);
    if (suppressed) {
      result.skippedReasons.push(`${candidate.companyName}: suppressed`);
      continue;
    }

    // ── 3. Score (before DB work — drops non-ICP firms cheaply) ──────────────
    const { score, tier, breakdown } = scoreCandidate(candidate, scoringRules, keywords);
    if (tier === null) {
      result.skippedReasons.push(
        `${candidate.companyName}: score ${score} below minimum tier (C=${scoringRules.tierThresholds.C})`,
      );
      continue;
    }

    // ── 4. Dedup ──────────────────────────────────────────────────────────────
    const dedup = await dedupAgainstCrm(organizationId, candidate);
    if (!dedup.isNew) {
      result.dedupMerges++;
      result.skippedReasons.push(
        `${candidate.companyName}: duplicate — existing ${dedup.existingLeadId ? 'lead' : 'prospect'} ${dedup.existingLeadId ?? dedup.existingProspectId}`,
      );
      continue;
    }

    // ── 5. Enrich ─────────────────────────────────────────────────────────────
    let profile: CompanyProfile | null = null;
    if (candidate.website && isProviderEnabled(leConfig, 'firecrawl')) {
      profile = await enrichCompany(candidate.website);
      if (profile) result.enriched++;
    } else if (candidate.website) {
      result.skippedReasons.push(`${candidate.companyName}: enrichment skipped (Firecrawl disabled)`);
    }

    // ── 6. Contacts (role-based; KDPA gates personal) ─────────────────────────
    const contactEnabled = isProviderEnabled(leConfig, 'apollo') || isProviderEnabled(leConfig, 'hunter');
    const rawContacts = contactEnabled
      ? await findContacts(candidate.companyName, candidate.website)
      : [];
    const { allowed, gated } = gatePersonalData(rawContacts);
    result.personalGated += gated;
    const roleContacts = allowed.filter((c) => c.fieldClass !== 'PersonalContact');
    result.roleContacts += roleContacts.length;

    // ── 7. Persist prospect ───────────────────────────────────────────────────
    const dedupHash = buildDedupHash(candidate.normalizedName, candidate.address, candidate.phone);

    const prospect = await prisma.prospect.upsert({
      where: { campaignId_dedupHash: { campaignId, dedupHash } },
      create: {
        organizationId,
        campaignId,
        companyName: candidate.companyName,
        normalizedName: candidate.normalizedName,
        industry: profile?.sector ?? candidate.industry ?? null,
        sectorTags: candidate.sectorTags,
        address: candidate.address ?? null,
        lat: candidate.lat ?? null,
        lng: candidate.lng ?? null,
        phone: candidate.phone ?? null,
        website: candidate.website ?? null,
        source: candidate.source,
        sourceRef: candidate.sourceRef ?? null,
        score,
        scoreBreakdown: breakdown as object[],
        tier,
        dedupHash,
        status: 'NEW',
      },
      update: {
        score,
        tier,
        scoreBreakdown: breakdown as object[],
        ...(profile?.sector ? { industry: profile.sector } : {}),
      },
      select: { id: true },
    });

    result.prospectIds.push(prospect.id);

    // ── 8. Persist enrichment ─────────────────────────────────────────────────
    if (profile) {
      await prisma.prospectEnrichment.upsert({
        where: { prospectId: prospect.id },
        create: {
          prospectId: prospect.id,
          websiteSummary: profile.websiteSummary,
          employeeEstimate: parseEmployeeBand(profile.estimatedEmployees),
          existingErpDetected: Boolean(profile.erpSoftware),
          signals: {
            sector: profile.sector,
            accountingSoftware: profile.accountingSoftware,
            erpSoftware: profile.erpSoftware,
            servicesOrProducts: profile.servicesOrProducts,
            yearFounded: profile.yearFounded,
            genericEmails: profile.genericEmails,
            provenance: { provider: 'firecrawl', retrievedAt: profile.retrievedAt },
          },
        },
        update: {
          websiteSummary: profile.websiteSummary,
          employeeEstimate: parseEmployeeBand(profile.estimatedEmployees),
          existingErpDetected: Boolean(profile.erpSoftware),
        },
      });
    }

    // ── 9. Persist contacts (role-based + anonymised personal) ───────────────
    for (const contact of allowed) {
      if (!contact.email && !contact.phone) continue;
      await prisma.prospectContact
        .create({
          data: {
            prospectId: prospect.id,
            fullName: contact.name ?? null,
            role: contact.title ?? null,
            email: contact.email ?? null,
            emailStatus: inferEmailStatus(contact.email),
            phone: contact.phone ?? null,
            source: contact.source,
            confidence:
              contact.fieldClass === 'Firmographic' ? 90
              : contact.fieldClass === 'RoleBasedContact' ? 70
              : 50,
          },
        })
        .catch(() => {}); // tolerate unique constraint on email
    }

    result.savedProspects++;
  }

  return result;
}

function parseEmployeeBand(band: string | null): number | null {
  if (!band) return null;
  const match = band.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function inferEmailStatus(email: string | null): string {
  if (!email) return 'unverified';
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  const generics = ['info', 'sales', 'admin', 'contact', 'hello', 'support', 'office', 'enquiries'];
  return generics.some((p) => local.startsWith(p)) ? 'valid' : 'guessed';
}
