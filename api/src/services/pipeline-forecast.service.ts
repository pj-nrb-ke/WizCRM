import { prisma } from '../lib/prisma.js';

export type PipelineForecast = {
  weightedPipeline: number;
  openOpportunities: number;
  openLeads: number;
  byStage: { stage: string; count: number; weighted: number }[];
};

export async function loadPipelineForecast(organizationId: string): Promise<PipelineForecast> {
  const [opportunities, leads] = await Promise.all([
    prisma.salesOpportunity.findMany({
      where: { organizationId, isClosed: false },
      select: { forecastedExcl: true, probabilityPct: true, oppStage: true },
    }),
    prisma.lead.findMany({
      where: { organizationId, stage: { notIn: ['WON', 'LOST'] } },
      select: { stage: true, wonValue: true },
    }),
  ]);

  let weightedPipeline = 0;
  for (const o of opportunities) {
    const value = o.forecastedExcl ?? 0;
    weightedPipeline += value * (o.probabilityPct / 100);
  }

  const stageMap = new Map<string, { count: number; weighted: number }>();
  for (const lead of leads) {
    const prev = stageMap.get(lead.stage) ?? { count: 0, weighted: 0 };
    prev.count += 1;
    if (lead.wonValue && ['PROPOSAL', 'NEGOTIATION'].includes(lead.stage)) {
      prev.weighted += Number(lead.wonValue) * 0.25;
    }
    stageMap.set(lead.stage, prev);
  }

  weightedPipeline += [...stageMap.values()].reduce((s, v) => s + v.weighted, 0);

  return {
    weightedPipeline: Math.round(weightedPipeline * 100) / 100,
    openOpportunities: opportunities.length,
    openLeads: leads.length,
    byStage: [...stageMap.entries()].map(([stage, v]) => ({ stage, ...v })),
  };
}
