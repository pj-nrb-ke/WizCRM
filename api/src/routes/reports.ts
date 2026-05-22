import type { FastifyPluginAsync } from 'fastify';
import {
  leadsToCsv,
  loadLeadsForExport,
  loadReportSummary,
} from '../services/report.service.js';

function isManagerRole(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.get('/summary', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManagerRole(role)) {
      return reply.status(403).send({ error: 'Managers only' });
    }
    const q = request.query as { teamId?: string };
    const summary = await loadReportSummary(organizationId, q.teamId);
    if (!summary) return reply.status(404).send({ error: 'Team not found' });
    return { summary };
  });

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
