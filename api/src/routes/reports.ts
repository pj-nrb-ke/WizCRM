import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  type ReportDateRange,
  leadsToCsv,
  loadLeadsForExport,
  loadReportSummary,
} from '../services/report.service.js';
import { loadAdvancedAnalytics } from '../services/report-analytics.service.js';
import { loadSalesPacing } from '../services/sales-targets.service.js';
import { loadDataHygieneReport } from '../services/data-hygiene-report.service.js';
import { getOrganizationEntitlements } from '../services/entitlements.service.js';
import { buildManagerBrief } from '../services/manager-brief.service.js';
import { loadPipelineForecast } from '../services/pipeline-forecast.service.js';

function isManagerRole(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  const analyticsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const q = request.query as { teamId?: string; dateFrom?: string; dateTo?: string };
    const parsedRange = parseDateRange(q.dateFrom, q.dateTo);
    if (!parsedRange.ok) {
      return reply.status(400).send({ error: parsedRange.error });
    }
    const [summary, advanced] = await Promise.all([
      loadReportSummary(organizationId, q.teamId, parsedRange.range),
      loadAdvancedAnalytics(organizationId, q.teamId, parsedRange.range),
    ]);
    if (!summary || !advanced) return reply.status(404).send({ error: 'Team not found' });
    return {
      summary: {
        ...summary,
        conversionFunnel: advanced.conversionFunnel,
        timeInStage: advanced.timeInStage,
      },
    };
  };

  app.get('/summary', analyticsHandler);
  app.get('/analytics', analyticsHandler);

  app.get('/pacing', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.targetsPacing) {
      return reply.status(403).send({ error: 'Pro plan required for targets and pacing' });
    }
    const q = request.query as { year?: string; month?: string };
    const year = q.year ? Number(q.year) : undefined;
    const month = q.month ? Number(q.month) : undefined;
    if (year !== undefined && (!Number.isInteger(year) || year < 2000)) {
      return reply.status(400).send({ error: 'Invalid year' });
    }
    if (month !== undefined && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return reply.status(400).send({ error: 'Invalid month' });
    }
    return loadSalesPacing(organizationId, year, month);
  });

  app.get('/my-pacing', async (request, reply) => {
    const { organizationId, sub: userId } = request.user;
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.targetsPacing) {
      return reply.status(403).send({ error: 'Pro plan required for targets and pacing' });
    }
    const full = await loadSalesPacing(organizationId);
    const mine = full.reps.find((r) => r.userId === userId);
    if (!mine) {
      return {
        period: full.period,
        target: 0,
        wonRevenue: 0,
        wonDeals: 0,
        achievementPct: null,
        pacingLabel: 'No target set',
      };
    }
    return {
      period: full.period,
      target: mine.target,
      wonRevenue: mine.wonRevenue,
      wonDeals: mine.wonDeals,
      achievementPct: mine.achievementPct,
      pacingLabel: mine.pacingLabel,
    };
  });

  app.get('/data-hygiene', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.dataHygiene) {
      return reply.status(403).send({ error: 'Pro plan required for data hygiene report' });
    }
    return loadDataHygieneReport(organizationId);
  });

  app.get('/forecast', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.advancedReports) {
      return reply.status(403).send({ error: 'Pro plan required for pipeline forecast' });
    }
    return loadPipelineForecast(organizationId);
  });

  app.get('/manager-brief', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const ent = await getOrganizationEntitlements(organizationId);
    if (!ent.features.advancedReports) {
      return reply.status(403).send({ error: 'Pro plan required for manager brief' });
    }
    return buildManagerBrief(organizationId);
  });

  app.get('/export.csv', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const q = request.query as { teamId?: string; dateFrom?: string; dateTo?: string };
    const parsedRange = parseDateRange(q.dateFrom, q.dateTo);
    if (!parsedRange.ok) {
      return reply.status(400).send({ error: parsedRange.error });
    }
    const leads = await loadLeadsForExport(organizationId, q.teamId, parsedRange.range);
    if (!leads) return reply.status(404).send({ error: 'Team not found' });
    const csv = leadsToCsv(leads);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="wizcrm-leads.csv"')
      .send(csv);
  });
};

function parseDateRange(
  dateFromRaw?: string,
  dateToRaw?: string,
): { ok: true; range: ReportDateRange } | { ok: false; error: string } {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 90);

  const dateFrom = dateFromRaw ? parseIsoDate(dateFromRaw) : defaultFrom;
  if (!dateFrom) {
    return { ok: false, error: 'Invalid dateFrom. Expected ISO date string.' };
  }

  const dateTo = dateToRaw ? parseIsoDate(dateToRaw) : now;
  if (!dateTo) {
    return { ok: false, error: 'Invalid dateTo. Expected ISO date string.' };
  }

  if (dateFrom > dateTo) {
    return { ok: false, error: 'dateFrom must be before or equal to dateTo.' };
  }

  return { ok: true, range: { dateFrom, dateTo } };
}

function parseIsoDate(raw: string): Date | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
