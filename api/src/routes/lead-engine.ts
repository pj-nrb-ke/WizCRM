import { createHash } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../services/lead-engine/campaign.service.js';
import {
  startDiscoveryRun,
  getRunStatus,
} from '../services/lead-engine/discovery/discovery.service.js';
import { addSuppression } from '../services/lead-engine/suppression.service.js';
import { normalizeName } from '../services/lead-engine/discovery/google-places.provider.js';
import {
  sendSequenceStep,
  getEmailStats,
  countEligibleForStep,
  verifyUnsubToken,
} from '../services/lead-engine/email-sequence.service.js';

export const leadEngineRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // ── Campaigns ──────────────────────────────────────────────────────────────

  app.get('/campaigns', async (request) => {
    return listCampaigns(request.user.organizationId);
  });

  app.post('/campaigns', async (request, reply) => {
    const body = request.body as {
      name: string;
      goal?: string;
      industryKeywords?: string[];
      locations?: string[];
      sizeMin?: number;
      sizeMax?: number;
      scoringRules?: object;
    };
    if (!body?.name?.trim()) return reply.status(400).send({ error: 'name is required' });
    const campaign = await createCampaign(request.user.organizationId, request.user.sub, body as any);
    return reply.status(201).send(campaign);
  });

  app.get('/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await getCampaign(id, request.user.organizationId);
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    return campaign;
  });

  app.put('/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await updateCampaign(id, request.user.organizationId, request.body as any);
    if (!result) return reply.status(404).send({ error: 'Campaign not found' });
    return result;
  });

  app.delete('/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deleteCampaign(id, request.user.organizationId);
    if (!result) return reply.status(404).send({ error: 'Campaign not found' });
    return { ok: true };
  });

  // ── Discovery ──────────────────────────────────────────────────────────────

  app.post('/campaigns/:id/discover', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const runId = await startDiscoveryRun(id, request.user.organizationId);
      return reply.status(202).send({ runId, status: 'RUNNING' });
    } catch (err) {
      return reply
        .status(400)
        .send({ error: err instanceof Error ? err.message : 'Discovery failed to start' });
    }
  });

  app.get('/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = await getRunStatus(runId, request.user.organizationId);
    if (!run) return reply.status(404).send({ error: 'Run not found' });
    return run;
  });

  // ── Prospects ──────────────────────────────────────────────────────────────

  app.get('/campaigns/:id/prospects', async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as {
      tier?: string;
      status?: string;
      search?: string;
      page?: string;
    };

    const page = Math.max(1, Number(q.page ?? 1));
    const take = 50;
    const skip = (page - 1) * take;

    const where: Record<string, unknown> = {
      campaignId: id,
      campaign: { organizationId: request.user.organizationId },
    };
    if (q.tier) where.tier = q.tier;
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { companyName: { contains: q.search, mode: 'insensitive' } },
        { industry: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        orderBy: [{ tier: 'asc' }, { score: 'desc' }],
        take,
        skip,
        include: {
          contacts: { take: 1 },
          _count: { select: { emailSends: true } },
        },
      }),
      prisma.prospect.count({ where }),
    ]);

    return { prospects, total, page, pages: Math.ceil(total / take) };
  });

  app.post('/campaigns/:id/prospects', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      companyName: string;
      phone?: string;
      website?: string;
      address?: string;
      industry?: string;
    };
    if (!body?.companyName?.trim()) {
      return reply.status(400).send({ error: 'companyName is required' });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const normalized = normalizeName(body.companyName);
    const dedupHash = createHash('sha256')
      .update(`${normalized}|manual`)
      .digest('hex')
      .slice(0, 16);

    const prospect = await prisma.prospect.upsert({
      where: { campaignId_dedupHash: { campaignId: id, dedupHash } },
      create: {
        organizationId: request.user.organizationId,
        campaignId: id,
        companyName: body.companyName.trim(),
        normalizedName: normalized,
        industry: body.industry ?? null,
        sectorTags: [],
        address: body.address ?? null,
        phone: body.phone ?? null,
        website: body.website ?? null,
        source: 'manual',
        score: 0,
        scoreBreakdown: [],
        dedupHash,
        status: 'NEW',
      },
      update: {
        phone: body.phone ?? undefined,
        website: body.website ?? undefined,
        address: body.address ?? undefined,
      },
    });

    return reply.status(201).send(prospect);
  });

  app.get('/prospects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prospect = await prisma.prospect.findFirst({
      where: { id, campaign: { organizationId: request.user.organizationId } },
      include: {
        contacts: true,
        enrichment: true,
        emailSends: { orderBy: { createdAt: 'desc' } },
        campaign: { select: { id: true, name: true } },
      },
    });
    if (!prospect) return reply.status(404).send({ error: 'Prospect not found' });
    return prospect;
  });

  app.patch('/prospects/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };
    const allowed = ['NEW', 'QUALIFIED', 'ENRICHED', 'EMAILED', 'REJECTED', 'SUPPRESSED'];
    if (!allowed.includes(status)) return reply.status(400).send({ error: 'Invalid status' });

    const count = await prisma.prospect.updateMany({
      where: { id, campaign: { organizationId: request.user.organizationId } },
      data: { status: status as any },
    });
    if (count.count === 0) return reply.status(404).send({ error: 'Prospect not found' });
    return { ok: true };
  });

  // ── Kenya DPA: hard-delete prospect PII on data-subject request ───────────
  // Cascade in schema removes ProspectContact, ProspectEnrichment, EmailSend.

  app.delete('/prospects/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prospect = await prisma.prospect.findFirst({
      where: { id, campaign: { organizationId: request.user.organizationId } },
      select: { id: true },
    });
    if (!prospect) return reply.status(404).send({ error: 'Prospect not found' });
    await prisma.prospect.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Import to pipeline ─────────────────────────────────────────────────────

  app.post('/prospects/:id/import', async (request, reply) => {
    const { id } = request.params as { id: string };

    const prospect = await prisma.prospect.findFirst({
      where: { id, campaign: { organizationId: request.user.organizationId } },
      include: { contacts: { take: 1 }, campaign: { select: { id: true } } },
    });
    if (!prospect) return reply.status(404).send({ error: 'Prospect not found' });

    if (prospect.importedLeadId) {
      return reply.status(409).send({ error: 'Already imported', leadId: prospect.importedLeadId });
    }

    const contact = prospect.contacts[0];

    // Duplicate guard
    if (contact?.email || prospect.phone) {
      const dupe = await prisma.lead.findFirst({
        where: {
          organizationId: request.user.organizationId,
          OR: [
            ...(contact?.email ? [{ emailNormalized: contact.email.toLowerCase() }] : []),
            ...(prospect.phone ? [{ phoneNormalized: prospect.phone.replace(/\D/g, '') }] : []),
          ],
        },
      });
      if (dupe) {
        return reply
          .status(409)
          .send({ error: 'Lead with this email/phone already exists', leadId: dupe.id });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        organizationId: request.user.organizationId,
        ownerId: request.user.sub,
        name: contact?.fullName ?? prospect.companyName,
        company: prospect.companyName,
        email: contact?.email ?? null,
        emailNormalized: contact?.email?.toLowerCase() ?? null,
        phone: prospect.phone ?? null,
        phoneNormalized: prospect.phone?.replace(/\D/g, '') ?? null,
        address: prospect.address ?? null,
        googleMapsUrl:
          prospect.lat && prospect.lng
            ? `https://maps.google.com/?q=${prospect.lat},${prospect.lng}`
            : null,
        source: `lead_generator:${prospect.campaign?.id ?? 'unknown'}`,
        stage: 'NEW',
        tags: prospect.tier ? [`tier-${prospect.tier.toLowerCase()}`] : [],
      },
    });

    await prisma.prospect.update({
      where: { id },
      data: { status: 'IMPORTED', importedLeadId: lead.id },
    });

    return reply.status(201).send({ leadId: lead.id, ok: true });
  });

  // ── Bulk import ────────────────────────────────────────────────────────────

  app.post('/campaigns/:id/bulk-import', async (request, reply) => {
    const { id: campaignId } = request.params as { id: string };
    const { prospectIds } = request.body as { prospectIds?: string[] };

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return reply.status(400).send({ error: 'prospectIds must be a non-empty array' });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: request.user.organizationId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const result = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const prospectId of prospectIds) {
      try {
        const prospect = await prisma.prospect.findFirst({
          where: { id: prospectId, campaignId, organizationId: request.user.organizationId },
          include: { contacts: { take: 1 } },
        });
        if (!prospect) { result.skipped++; continue; }
        if (prospect.importedLeadId) { result.skipped++; continue; }

        const contact = prospect.contacts[0];

        const dupe = contact?.email || prospect.phone
          ? await prisma.lead.findFirst({
              where: {
                organizationId: request.user.organizationId,
                OR: [
                  ...(contact?.email ? [{ emailNormalized: contact.email.toLowerCase() }] : []),
                  ...(prospect.phone ? [{ phoneNormalized: prospect.phone.replace(/\D/g, '') }] : []),
                ],
              },
            })
          : null;

        if (dupe) {
          await prisma.prospect.update({ where: { id: prospectId }, data: { importedLeadId: dupe.id, status: 'IMPORTED' } });
          result.skipped++;
          continue;
        }

        const lead = await prisma.lead.create({
          data: {
            organizationId: request.user.organizationId,
            ownerId: request.user.sub,
            name: contact?.fullName ?? prospect.companyName,
            company: prospect.companyName,
            email: contact?.email ?? null,
            emailNormalized: contact?.email?.toLowerCase() ?? null,
            phone: prospect.phone ?? null,
            phoneNormalized: prospect.phone?.replace(/\D/g, '') ?? null,
            address: prospect.address ?? null,
            googleMapsUrl: prospect.lat && prospect.lng
              ? `https://maps.google.com/?q=${prospect.lat},${prospect.lng}`
              : null,
            source: `lead_generator:${campaignId}`,
            stage: 'NEW',
            tags: prospect.tier ? [`tier-${prospect.tier.toLowerCase()}`] : [],
          },
        });

        await prisma.prospect.update({
          where: { id: prospectId },
          data: { status: 'IMPORTED', importedLeadId: lead.id },
        });

        result.imported++;
      } catch (err) {
        result.errors.push(`${prospectId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return result;
  });

  // ── Suppression ────────────────────────────────────────────────────────────

  app.post('/suppression', async (request, reply) => {
    const body = request.body as {
      companyName?: string;
      domain?: string;
      email?: string;
      reason?: string;
    };
    const entry = await addSuppression(request.user.organizationId, request.user.sub, body);
    return reply.status(201).send(entry);
  });

  // ── Email Templates ────────────────────────────────────────────────────────

  app.get('/email-templates', async (request) => {
    return prisma.emailTemplate.findMany({
      where: { organizationId: request.user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  });

  app.post('/email-templates', async (request, reply) => {
    const body = request.body as {
      name: string;
      subject: string;
      bodyHtml: string;
      campaignId?: string;
    };
    if (!body?.name || !body?.subject || !body?.bodyHtml) {
      return reply.status(400).send({ error: 'name, subject, and bodyHtml are required' });
    }

    const template = await prisma.emailTemplate.create({
      data: {
        organizationId: request.user.organizationId,
        createdById: request.user.sub,
        campaignId: body.campaignId ?? null,
        name: body.name,
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        mergeFields: extractMergeFields(body.bodyHtml),
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return reply.status(201).send(template);
  });

  app.put('/email-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; subject?: string; bodyHtml?: string };

    const existing = await prisma.emailTemplate.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: 'Template not found' });

    return prisma.emailTemplate.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.subject && { subject: body.subject }),
        ...(body.bodyHtml && {
          bodyHtml: body.bodyHtml,
          mergeFields: extractMergeFields(body.bodyHtml),
        }),
      },
    });
  });

  app.delete('/email-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.emailTemplate.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!existing) return reply.status(404).send({ error: 'Template not found' });
    await prisma.emailTemplate.delete({ where: { id } });
    return { ok: true };
  });

  // ── Sequences ──────────────────────────────────────────────────────────────

  app.get('/campaigns/:id/sequences', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    return prisma.emailSequence.findMany({
      where: { campaignId: id },
      orderBy: { stepNumber: 'asc' },
      include: { template: true },
    });
  });

  app.put('/campaigns/:id/sequences', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { steps } = request.body as {
      steps: Array<{ stepNumber: number; templateId: string; delayDays: number }>;
    };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    await prisma.emailSequence.deleteMany({ where: { campaignId: id } });
    const result = await prisma.emailSequence.createMany({
      data: steps.map((s) => ({
        campaignId: id,
        templateId: s.templateId,
        stepNumber: s.stepNumber,
        delayDays: s.delayDays,
      })),
    });

    return { ok: true, count: result.count };
  });

  // ── Email sending ──────────────────────────────────────────────────────────

  app.post('/campaigns/:id/send/:step', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id, step } = request.params as { id: string; step: string };
    const stepNum = Number(step);
    if (!Number.isInteger(stepNum) || stepNum < 1 || stepNum > 10) {
      return reply.status(400).send({ error: 'step must be 1–10' });
    }
    try {
      const result = await sendSequenceStep(id, stepNum, request.user.organizationId);
      return result;
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Send failed' });
    }
  });

  app.get('/campaigns/:id/email-stats', async (request, reply) => {
    const { id } = request.params as { id: string };
    return getEmailStats(id, request.user.organizationId);
  });

  app.get('/campaigns/:id/send-preview/:step', async (request, reply) => {
    const { id, step } = request.params as { id: string; step: string };
    const stepNum = Number(step);
    return countEligibleForStep(id, stepNum, request.user.organizationId);
  });
};

// Public unsubscribe handler — registered separately in app.ts so it has no auth hook
export async function handleUnsubscribe(
  prospectId: string,
  token: string,
): Promise<{ ok: boolean; message: string }> {
  if (!verifyUnsubToken(prospectId, token)) {
    return { ok: false, message: 'Invalid or expired unsubscribe link.' };
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId },
    select: { id: true, companyName: true, organizationId: true, status: true },
  });
  if (!prospect) return { ok: false, message: 'Prospect not found.' };
  if (prospect.status === 'SUPPRESSED') return { ok: true, message: 'Already unsubscribed.' };

  await Promise.all([
    prisma.prospect.update({ where: { id: prospectId }, data: { status: 'SUPPRESSED' } }),
    prisma.suppressionList.create({
      data: {
        organizationId: prospect.organizationId,
        companyName: prospect.companyName,
        reason: 'Unsubscribed via email link',
        // System-level — no user ID; use a sentinel. We skip addedById for now by using a raw insert
        addedById: await prisma.user
          .findFirst({ where: { organizationId: prospect.organizationId, role: 'ADMIN' }, select: { id: true } })
          .then((u) => u?.id ?? ''),
      },
    }).catch(() => {}),
  ]);

  return { ok: true, message: 'You have been unsubscribed and will not receive further emails.' };
}

function extractMergeFields(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}
