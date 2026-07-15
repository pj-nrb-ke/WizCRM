import type { FastifyPluginAsync } from 'fastify';
import { hasFeatureAccess } from '@wizcrm/shared';
import {
  findContactsForCompanies,
  type CompanyInput,
} from '../services/contact-finder/contact-finder.service.js';
import { getOrgSettings } from '../services/org-settings.service.js';

export const contactFinderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.post('/', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { organizationId, role } = request.user;

    const settings = await getOrgSettings(organizationId);
    if (!hasFeatureAccess(role, settings.rolePermissions, 'contactFinder')) {
      return reply.status(403).send({ error: 'This feature has been disabled for your role by your admin.' });
    }

    const body = request.body as {
      companies?: Array<string | { name: string; website?: string }>;
      position?: string;
      threshold?: number;
      forceRefresh?: boolean;
    };

    if (!Array.isArray(body?.companies) || body.companies.length === 0) {
      return reply.status(400).send({ error: 'companies must be a non-empty array' });
    }

    if (body.companies.length > 50) {
      return reply.status(400).send({ error: 'Maximum 50 companies per request' });
    }

    const companies: CompanyInput[] = body.companies.map((c) =>
      typeof c === 'string' ? { name: c.trim() } : { name: c.name?.trim() ?? '', website: c.website },
    ).filter((c) => c.name.length > 0);

    const threshold = typeof body.threshold === 'number'
      ? Math.max(1, Math.min(body.threshold, 20))
      : 3;

    const results = await findContactsForCompanies(companies, {
      position: body.position?.trim() || undefined,
      threshold,
      organizationId,
      forceRefresh: body.forceRefresh === true,
    });

    const totalContacts = results.reduce((sum, r) => sum + r.totalFound, 0);
    const fromCacheCount = results.filter((r) => r.fromCache).length;

    return reply.send({
      results,
      summary: {
        totalCompanies: results.length,
        totalContacts,
        coverage: results.filter((r) => r.totalFound > 0).length,
        fromCache: fromCacheCount,
        apiCalls: results.length - fromCacheCount,
      },
    });
  });
};
