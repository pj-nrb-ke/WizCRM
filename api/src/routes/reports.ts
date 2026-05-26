import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  type ReportDateRange,
  leadsToCsv,
  loadLeadsForExport,
  loadReportSummary,
} from '../services/report.service.js';
import { loadAdvancedAnalytics } from '../services/report-analytics.service.js';

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

  app.get('/export.csv', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const q = request.query as { teamId?: string };
    const leads = await loadLeadsForExport(organizationId, q.teamId);
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
