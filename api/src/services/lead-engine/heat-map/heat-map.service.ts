import { createHash } from 'node:crypto';
import { prisma } from '../../../lib/prisma.js';
import { TenderProvider } from './tender.provider.js';
import { RedditProvider } from './reddit.provider.js';
import { DiscussionProvider } from './discussion.provider.js';
import { TavilyProvider } from './tavily.provider.js';
import { LinkedInProvider } from './linkedin.provider.js';
import { NewBusinessProvider } from './new-business.provider.js';
import { OpenCorporatesProvider } from './opencorporates.provider.js';
import { RegistryLookupProvider } from './registry-lookup.provider.js';
import { JobSignalsProvider } from './job-signals.provider.js';
import type { IntentSignalRaw } from './signal-provider.interface.js';

const providers = [
  new TavilyProvider(),          // AI web search — 10 intent queries
  new LinkedInProvider(),        // LinkedIn buyer posts via Tavily
  new JobSignalsProvider(),      // hiring signals — HR/Finance/IT/Payroll roles = ERP buyers
  new OpenCorporatesProvider(),  // official registry — newly incorporated Kenya companies
  new RegistryLookupProvider(),  // registry-lookup.com — 521M entities, complements OpenCorporates
  new NewBusinessProvider(),     // Tavily — new business announcements & openings
  new TenderProvider(),          // PPRA Kenya + TendersKenya — government tenders
  new RedditProvider(),          // r/Kenya community discussions
  new DiscussionProvider(),      // Google Custom Search — forums & articles
];

export async function runHeatMapDiscovery(
  campaignId: string,
  productKeywords: string[],
  locations: string[],
): Promise<{ created: number; skipped: number; sources: Record<string, number> }> {
  const allSignals: IntentSignalRaw[] = [];

  await Promise.allSettled(
    providers.map(async (p) => {
      try {
        const results = await p.search(productKeywords, locations);
        allSignals.push(...results);
      } catch (err) {
        console.error(`[HeatMap] Provider ${p.name} failed:`, err instanceof Error ? err.message : err);
      }
    }),
  );

  let created = 0;
  let skipped = 0;
  const sources: Record<string, number> = {};

  for (const signal of allSignals) {
    const hash = signal.dedupHash ?? createHash('sha256').update(signal.url + signal.title).digest('hex').slice(0, 20);

    try {
      await prisma.intentSignal.upsert({
        where: { campaignId_dedupHash: { campaignId, dedupHash: hash } },
        create: {
          campaignId,
          source: signal.source,
          platform: signal.platform,
          title: signal.title,
          snippet: signal.snippet,
          url: signal.url,
          authorName: signal.authorName,
          authorCompany: signal.authorCompany,
          location: signal.location,
          lat: signal.lat,
          lng: signal.lng,
          publishedAt: signal.publishedAt,
          intentStrength: signal.intentStrength,
          engagementScore: signal.engagementScore ?? 0,
          dedupHash: hash,
          raw: (signal.raw ?? {}) as Record<string, string | number | boolean | null>,
        },
        update: {},
      });
      created++;
      sources[signal.platform] = (sources[signal.platform] ?? 0) + 1;
    } catch {
      skipped++;
    }
  }

  return { created, skipped, sources };
}

export async function getHeatMapSignals(
  campaignId: string,
  filters: { source?: string; intentStrength?: string } = {},
) {
  return prisma.intentSignal.findMany({
    where: {
      campaignId,
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.intentStrength ? { intentStrength: filters.intentStrength } : {}),
      status: { not: 'DISMISSED' },
    },
    orderBy: [{ intentStrength: 'asc' }, { engagementScore: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

export async function updateSignalStatus(
  signalId: string,
  campaignId: string,
  status: 'SAVED' | 'DISMISSED',
): Promise<void> {
  await prisma.intentSignal.updateMany({
    where: { id: signalId, campaignId },
    data: { status },
  });
}
