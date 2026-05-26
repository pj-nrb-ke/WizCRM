import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';
import { loadDataHygieneReport } from './data-hygiene-report.service.js';
import { loadSalesPacing } from './sales-targets.service.js';
import { loadOrganizationTeamContext } from './team.service.js';
import { createOpenAIClient, chatJson } from './ai/openai.provider.js';

export type ManagerBrief = {
  generatedAt: string;
  bullets: string[];
  aiSummary: string | null;
};

export async function buildManagerBrief(organizationId: string): Promise<ManagerBrief> {
  const [pacing, hygiene, ctx] = await Promise.all([
    loadSalesPacing(organizationId).catch(() => null),
    loadDataHygieneReport(organizationId).catch(() => null),
    loadOrganizationTeamContext(organizationId),
  ]);

  const bullets: string[] = [];
  const org = ctx.teams.reduce(
    (acc, t) => ({
      open: acc.open + t.stats.openLeads,
      stale: acc.stale + t.stats.staleLeads,
      overdue: acc.overdue + t.stats.overdueTasks,
    }),
    { open: 0, stale: 0, overdue: 0 },
  );
  bullets.push(`${org.open} open leads across ${ctx.teams.length} team(s).`);
  if (org.stale > 0) bullets.push(`${org.stale} stale lead(s) need follow-up.`);
  if (org.overdue > 0) bullets.push(`${org.overdue} overdue task(s) on the roster.`);

  if (pacing) {
    bullets.push(
      `Month ${pacing.period}: ${pacing.orgWonRevenue.toLocaleString()} won of ${pacing.orgTarget.toLocaleString()} target (${pacing.orgPacingLabel}).`,
    );
  }
  if (hygiene) {
    const issues =
      hygiene.summary.missingContact +
      hygiene.summary.stale +
      hygiene.summary.duplicateEmailGroups;
    if (issues > 0) {
      bullets.push(`Data hygiene: ${issues}+ issue categories on open leads.`);
    }
  }

  const dueQuotes = await prisma.quotation.count({
    where: {
      organizationId,
      status: 'SENT',
      OR: [{ followUpAt: { lte: new Date() } }, { followUpAt: null }],
    },
  });
  if (dueQuotes > 0) {
    bullets.push(`${dueQuotes} sent quotation(s) due for follow-up.`);
  }

  let aiSummary: string | null = null;
  if (config.aiEnabled && bullets.length > 0) {
    const client = createOpenAIClient();
    if (client) {
      try {
        const result = await chatJson<{ summary: string }>(
          client,
          'Return JSON { "summary": string } — one short paragraph for a sales manager morning brief.',
          bullets.join('\n'),
        );
        aiSummary = result.summary;
      } catch {
        aiSummary = null;
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    bullets,
    aiSummary,
  };
}
