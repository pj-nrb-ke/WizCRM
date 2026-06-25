import { prisma } from '../../../lib/prisma.js';
import { GooglePlacesProvider } from './google-places.provider.js';
import { buildDedupHash } from './google-places.provider.js';
import { isSuppressed } from '../suppression.service.js';
import { scoreCandidate, parseScoringRules } from '../scoring.service.js';

const provider = new GooglePlacesProvider();

// In-process job registry — tracks active runs so they can be aborted
const activeRuns = new Map<string, { aborted: boolean }>();

export async function startDiscoveryRun(
  campaignId: string,
  organizationId: string,
): Promise<string> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) throw new Error('Campaign not found');

  const keywords = campaign.industryKeywords as string[];
  const locations = campaign.locations as string[];

  if (!keywords.length || !locations.length) {
    throw new Error('Campaign must have at least one industry keyword and one location');
  }

  const run = await prisma.discoveryRun.create({
    data: {
      campaignId,
      status: 'RUNNING',
      params: { keywords, locations },
    },
  });

  const ctrl = { aborted: false };
  activeRuns.set(run.id, ctrl);

  // Fire and forget — caller gets runId to poll
  setImmediate(() => {
    runJob(run.id, campaign, ctrl).catch(async (err) => {
      console.error(`[Discovery] run ${run.id} failed:`, err);
      await prisma.discoveryRun
        .update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            error: err instanceof Error ? err.message : String(err),
            finishedAt: new Date(),
          },
        })
        .catch(() => {});
      activeRuns.delete(run.id);
    });
  });

  return run.id;
}

async function runJob(
  runId: string,
  campaign: {
    id: string;
    organizationId: string;
    industryKeywords: unknown;
    locations: unknown;
    scoringRules: unknown;
  },
  ctrl: { aborted: boolean },
) {
  const keywords = campaign.industryKeywords as string[];
  const locations = campaign.locations as string[];
  const scoringRules = parseScoringRules(campaign.scoringRules);

  const candidates = await provider.search(keywords, locations, 20);

  let saved = 0;

  for (const candidate of candidates) {
    if (ctrl.aborted) break;

    const suppressed = await isSuppressed(
      campaign.organizationId,
      candidate.companyName,
      candidate.website,
    );
    if (suppressed) continue;

    const dedupHash = buildDedupHash(candidate.normalizedName, candidate.address, candidate.phone);
    const { score, tier, breakdown } = scoreCandidate(candidate, scoringRules, keywords);

    // Drop prospects that score below the lowest tier threshold
    if (tier === null) continue;

    try {
      await prisma.prospect.upsert({
        where: { campaignId_dedupHash: { campaignId: campaign.id, dedupHash } },
        create: {
          organizationId: campaign.organizationId,
          campaignId: campaign.id,
          discoveryRunId: runId,
          companyName: candidate.companyName,
          normalizedName: candidate.normalizedName,
          industry: candidate.industry ?? null,
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
          // Re-discovery: update score and source ref if re-found
          score,
          scoreBreakdown: breakdown as object[],
          tier,
          sourceRef: candidate.sourceRef ?? undefined,
        },
      });
      saved++;
    } catch {
      // Skip individual insert failures silently
    }
  }

  await prisma.discoveryRun.update({
    where: { id: runId },
    data: { status: 'COMPLETED', resultsCount: saved, finishedAt: new Date() },
  });

  activeRuns.delete(runId);
}

export async function getRunStatus(runId: string, organizationId: string) {
  return prisma.discoveryRun.findFirst({
    where: { id: runId, campaign: { organizationId } },
    include: { _count: { select: { prospects: true } } },
  });
}
