import { prisma } from '../../lib/prisma.js';
import type { ScoringRules } from './types.js';

export interface CreateCampaignInput {
  name: string;
  goal?: string;
  industryKeywords?: string[];
  locations?: string[];
  sizeMin?: number;
  sizeMax?: number;
  scoringRules?: ScoringRules;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'CLOSED';
}

export function defaultScoringRules(): ScoringRules {
  return {
    signals: [
      {
        key: 'industry_keyword_match',
        label: 'Matches target industry keywords',
        points: 50,
        matchKeywords: [], // empty = inherits campaign.industryKeywords at score time
      },
      { key: 'has_website', label: 'Has website', points: 15, builtIn: 'has_website' },
      { key: 'has_phone', label: 'Has phone number', points: 10, builtIn: 'has_phone' },
    ],
    tierThresholds: { A: 60, B: 35, C: 15 },
  };
}

const ownerSelect = { id: true, name: true, email: true } as const;

export async function listCampaigns(organizationId: string) {
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: ownerSelect },
      _count: { select: { prospects: true, runs: true } },
    },
  });

  return Promise.all(
    campaigns.map(async (c) => {
      const [replied, emailed] = await Promise.all([
        prisma.prospect.count({ where: { campaignId: c.id, status: 'REPLIED' } }),
        prisma.emailSend.count({ where: { prospect: { campaignId: c.id }, status: 'SENT' } }),
      ]);
      return {
        ...c,
        stats: { prospects: c._count.prospects, runs: c._count.runs, emailed, replied },
      };
    }),
  );
}

export async function getCampaign(id: string, organizationId: string) {
  return prisma.campaign.findFirst({
    where: { id, organizationId },
    include: {
      owner: { select: ownerSelect },
      runs: { orderBy: { startedAt: 'desc' }, take: 10 },
      sequences: {
        include: { template: { select: { id: true, name: true, subject: true } } },
        orderBy: { stepNumber: 'asc' },
      },
      _count: { select: { prospects: true } },
    },
  });
}

export async function createCampaign(
  organizationId: string,
  ownerId: string,
  data: CreateCampaignInput,
) {
  return prisma.campaign.create({
    data: {
      organizationId,
      ownerId,
      name: data.name,
      goal: data.goal ?? null,
      industryKeywords: data.industryKeywords ?? [],
      locations: data.locations ?? [],
      sizeMin: data.sizeMin ?? null,
      sizeMax: data.sizeMax ?? null,
      scoringRules: (data.scoringRules ?? defaultScoringRules()) as object,
      status: 'DRAFT',
    },
    include: { owner: { select: ownerSelect } },
  });
}

export async function updateCampaign(
  id: string,
  organizationId: string,
  data: UpdateCampaignInput,
) {
  const existing = await prisma.campaign.findFirst({ where: { id, organizationId } });
  if (!existing) return null;

  return prisma.campaign.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.goal !== undefined && { goal: data.goal }),
      ...(data.industryKeywords !== undefined && { industryKeywords: data.industryKeywords }),
      ...(data.locations !== undefined && { locations: data.locations }),
      ...(data.sizeMin !== undefined && { sizeMin: data.sizeMin }),
      ...(data.sizeMax !== undefined && { sizeMax: data.sizeMax }),
      ...(data.scoringRules !== undefined && { scoringRules: data.scoringRules as object }),
      ...(data.status !== undefined && { status: data.status }),
    },
    include: { owner: { select: ownerSelect } },
  });
}

export async function deleteCampaign(id: string, organizationId: string) {
  const existing = await prisma.campaign.findFirst({ where: { id, organizationId } });
  if (!existing) return null;
  // Soft-close to preserve history
  return prisma.campaign.update({ where: { id }, data: { status: 'CLOSED' } });
}
