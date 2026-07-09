import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  findBuyingCommittee,
  peekCommittee,
  type CommitteeResult,
} from '../services/contact-finder/buying-committee.service.js';

// Free webmail — never a usable company domain, so don't derive a website from it.
const FREE_EMAIL =
  /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|protonmail|proton|gmx|zoho|mail)\./i;

/** Best-effort company website from the lead's email domain (helps the finder match). */
function deriveWebsite(email: string | null | undefined): string | null {
  if (!email || FREE_EMAIL.test(email)) return null;
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.includes('.') ? `https://${domain}` : null;
}

const ROLE_LABELS: Array<[keyof CommitteeResult['committee'], string]> = [
  ['boss', 'Owner/MD'],
  ['finance', 'Finance'],
  ['it', 'IT'],
  ['other', 'Other'],
];

/** Human-readable summary for the activity-timeline note we drop on the lead. */
function summarize(r: CommitteeResult): string {
  const lines: string[] = [];
  for (const [slot, label] of ROLE_LABELS) {
    for (const c of r.committee[slot]) {
      const bits = [c.name ?? '(name unknown)', c.title ?? label];
      if (c.email) bits.push(c.email);
      if (c.phone) bits.push(c.phone);
      lines.push(`• [${label}] ${bits.join(' — ')} (${c.source})`);
    }
  }
  return lines.length
    ? `Decision-makers found (${r.coverage.filled}/3 core roles):\n${lines.join('\n')}`
    : 'No decision-makers found from current sources.';
}

export const leadDecisionMakerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // Read-only. Shows the last-known committee from cache — never calls a paid provider.
  app.get('/:id/decision-makers', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params as { id: string };

    const lead = await prisma.lead.findFirst({ where: { id, organizationId } });
    if (!lead) return reply.status(404).send({ error: 'Lead not found' });

    const company = (lead.company || lead.name || '').trim();
    if (!company) return reply.send({ fetched: false, company: null });

    const cached = await peekCommittee(organizationId, company);
    if (!cached) return reply.send({ fetched: false, company });
    return reply.send({ fetched: true, ...cached });
  });

  // The button. Cache-first — only spends credits on a miss or forced refresh.
  app.post(
    '/:id/find-decision-makers',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { organizationId, sub: userId } = request.user;
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { forceRefresh?: boolean };

      const lead = await prisma.lead.findFirst({ where: { id, organizationId } });
      if (!lead) return reply.status(404).send({ error: 'Lead not found' });

      const company = (lead.company || lead.name || '').trim();
      if (!company) {
        return reply.status(400).send({ error: 'Lead has no company name to search' });
      }

      const result = await findBuyingCommittee({
        organizationId,
        companyName: company,
        website: deriveWebsite(lead.email),
        forceRefresh: body.forceRefresh === true,
      });

      // Persist a permanent, visible record — only on a fresh fetch, so a cache
      // hit neither spams the timeline nor implies work that didn't happen.
      if (!result.fromCache && result.totalFound > 0) {
        await prisma.activity
          .create({
            data: {
              leadId: id,
              userId,
              type: 'NOTE',
              subject: `Decision-makers found — ${result.coverage.filled}/3 roles`,
              body: summarize(result),
              metadata: JSON.parse(JSON.stringify(result.committee)),
            },
          })
          .catch(() => {});
        await prisma.lead
          .update({ where: { id }, data: { lastActivityAt: new Date() } })
          .catch(() => {});
      }

      return reply.send({ fetched: true, ...result });
    },
  );
};
