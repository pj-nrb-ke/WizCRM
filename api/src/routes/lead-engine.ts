import { createHash } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { hasFeatureAccess } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings } from '../services/org-settings.service.js';
import { bindOrgContext } from '../lib/org-context.js';
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
import { runIcpPipeline } from '../services/lead-engine/icp-pipeline.service.js';
import { enrichCompany } from '../services/lead-engine/enrichment/enrichment.service.js';
import { purgePersonalData } from '../services/lead-engine/kdpa.js';
import { chatJson, createOpenAIClient } from '../services/ai/openai.provider.js';
import { config } from '../config.js';
import {
  sendSequenceStep,
  getEmailStats,
  countEligibleForStep,
  verifyUnsubToken,
} from '../services/lead-engine/email-sequence.service.js';
import {
  extractProspectsFromImport,
  commitProspectImport,
  ProspectImportUnavailableError,
} from '../services/lead-engine/prospect-import.service.js';
import { prospectImportExtractSchema, prospectImportCommitSchema } from '@wizcrm/shared';

/** Discovery/ICP runs spend web-search and LLM credits, so they are restricted to managers with the feature enabled. */
function requireLeadGeneratorAccess() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, organizationId } = request.user;
    if (role !== 'MANAGER' && role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Managers and admins only' });
    }
    const settings = await getOrgSettings(organizationId);
    if (!hasFeatureAccess(role, settings.rolePermissions, 'leadGenerator')) {
      return reply.status(403).send({ error: 'This feature has been disabled for your role by your admin.' });
    }
  };
}

/** Pick the best contact as a Lead's primary, and carry every other captured contact along as extras. */
function splitPrimaryAndExtraContacts(
  contacts: { email: string | null; phone: string | null; fullName: string | null }[],
  prospectPhone: string | null,
) {
  const primary = contacts.find((c) => c.email || c.phone) ?? contacts[0];
  const others = contacts.filter((c) => c !== primary);
  const extraEmails = [...new Set(others.map((c) => c.email).filter((e): e is string => Boolean(e)))].slice(0, 5);
  const extraPhones = [
    ...new Set(
      [prospectPhone, ...others.map((c) => c.phone)].filter((p): p is string => Boolean(p) && p !== primary?.phone),
    ),
  ].slice(0, 5);
  return { primary, extraEmails, extraPhones };
}

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
    preHandler: requireLeadGeneratorAccess(),
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

  // ── ICP Pipeline ──────────────────────────────────────────────────────────

  app.post('/campaigns/:id/icp-run', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
    preHandler: requireLeadGeneratorAccess(),
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      keywords?: string[];
      locations?: string[];
      limit?: number;
    };

    const campaign = await prisma.campaign.findFirst({
      where: { id, organizationId: request.user.organizationId },
      select: { id: true, industryKeywords: true, locations: true },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const keywords: string[] = body?.keywords ?? (campaign.industryKeywords as string[] | null) ?? [];
    const locs: string[] = body?.locations ?? (campaign.locations as string[] | null) ?? ['Nairobi'];
    const limit = Math.min(Number(body?.limit ?? 10), 50);

    if (!keywords.length) {
      return reply.status(400).send({ error: 'keywords are required (set on campaign or pass in body)' });
    }

    // Re-bind here: AsyncLocalStorage context set in the onRequest hook does not
    // reliably survive the extra async preHandler above, so rebind right before
    // the code that actually needs the org's own provider keys.
    const orgSettings = await getOrgSettings(request.user.organizationId);
    bindOrgContext(request.user.organizationId, orgSettings.apiKeys ?? {});

    try {
      const result = await runIcpPipeline({
        campaignId: id,
        organizationId: request.user.organizationId,
        keywords,
        locations: locs,
        limit,
      });
      return reply.status(200).send(result);
    } catch (err) {
      return reply.status(500).send({
        error: err instanceof Error ? err.message : 'ICP pipeline failed',
      });
    }
  });

  // ── Prospect on-demand enrichment ─────────────────────────────────────────

  app.post('/prospects/:id/enrich', async (request, reply) => {
    const { id } = request.params as { id: string };

    const prospect = await prisma.prospect.findFirst({
      where: { id, campaign: { organizationId: request.user.organizationId } },
      select: { id: true, website: true },
    });
    if (!prospect) return reply.status(404).send({ error: 'Prospect not found' });
    if (!prospect.website) return reply.status(400).send({ error: 'Prospect has no website to enrich' });

    const profile = await enrichCompany(prospect.website);
    if (!profile) return reply.status(200).send({ enriched: false, message: 'No data returned from enrichment' });

    const enrichment = await prisma.prospectEnrichment.upsert({
      where: { prospectId: id },
      create: {
        prospectId: id,
        websiteSummary: profile.websiteSummary,
        employeeEstimate: parseEmployeeBand(profile.estimatedEmployees),
        existingErpDetected: Boolean(profile.erpSoftware),
        signals: {
          sector: profile.sector,
          accountingSoftware: profile.accountingSoftware,
          servicesOrProducts: profile.servicesOrProducts,
          yearFounded: profile.yearFounded,
          provenance: { provider: profile.source, retrievedAt: profile.retrievedAt },
        },
      },
      update: {
        websiteSummary: profile.websiteSummary,
        employeeEstimate: parseEmployeeBand(profile.estimatedEmployees),
        existingErpDetected: Boolean(profile.erpSoftware),
      },
    });

    return { enriched: true, enrichment };
  });

  // ── KDPA data-subject deletion ─────────────────────────────────────────────

  app.delete('/data-subject', async (request, reply) => {
    const body = request.body as { email?: string };
    if (!body?.email?.trim()) {
      return reply.status(400).send({ error: 'email is required' });
    }
    const result = await purgePersonalData(request.user.organizationId, body.email.trim());
    return { ok: true, ...result };
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

  // ── Bulk prospect-list upload (file/paste, AI-extracted, previewed before commit) ──

  /** Step 1: extract + optionally research + dedupe-check a whole file. Nothing is saved yet. */
  app.post(
    '/prospects/import/extract',
    { preHandler: requireLeadGeneratorAccess(), config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { organizationId } = request.user;
      const parsed = prospectImportExtractSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      try {
        const result = await extractProspectsFromImport(
          parsed.data.fileName,
          parsed.data.mimeType,
          parsed.data.dataBase64,
          organizationId,
          parsed.data.research ?? false,
        );
        return result;
      } catch (e) {
        if (e instanceof ProspectImportUnavailableError) {
          return reply.status(503).send({ error: e.message, code: e.code });
        }
        return reply.status(500).send({
          error: e instanceof Error ? e.message : 'Could not extract prospects from this file.',
        });
      }
    },
  );

  /** Step 2: commit the (possibly edited) preview rows into a list as Prospects. */
  app.post(
    '/campaigns/:id/prospects/import',
    { preHandler: requireLeadGeneratorAccess() },
    async (request, reply) => {
      const { id: campaignId } = request.params as { id: string };
      const { organizationId } = request.user;
      const parsed = prospectImportCommitSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      try {
        const result = await commitProspectImport(organizationId, campaignId, parsed.data.rows);
        return reply.status(201).send(result);
      } catch (e) {
        const err = e as Error & { statusCode?: number };
        return reply.status(err.statusCode ?? 500).send({ error: err.message });
      }
    },
  );

  /** For prospect lists a rep already has (email exports, corporate directory) — not AI discovery. */
  app.post('/campaigns/:id/prospects/import-text', { preHandler: requireLeadGeneratorAccess() }, async (request, reply) => {
    const { id: campaignId } = request.params as { id: string };
    const { organizationId } = request.user;
    const body = request.body as { text?: string };
    const text = (body?.text ?? '').trim();
    if (text.length < 20) {
      return reply.status(400).send({ error: 'Paste more detail — at least a few contacts with names/companies.' });
    }
    if (text.length > 40000) {
      return reply.status(400).send({ error: 'Paste is too long — split into smaller batches.' });
    }

    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId } });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    if (!config.openaiApiKey) return reply.status(503).send({ error: 'OpenAI is not configured' });
    const client = createOpenAIClient();
    if (!client) return reply.status(503).send({ error: 'OpenAI is not configured' });

    let parsed: {
      contacts?: Array<{
        companyName?: unknown;
        contactName?: unknown;
        email?: unknown;
        phone?: unknown;
        title?: unknown;
        industry?: unknown;
      }>;
    };
    try {
      parsed = await chatJson(
        client,
        `You extract a list of business contacts from text a salesperson pasted in — an email export, a corporate directory listing, or a CSV. Each entry may span one or more lines. Extract only what the text actually states; never invent a company, name, email, or phone. Skip anything that isn't a person/company contact (headers, signatures-only, blank noise).

Return JSON: {"contacts":[{"companyName","contactName","email","phone","title","industry"}]}
- "companyName": the organization this person belongs to. If genuinely not stated, use null — do not guess from the email domain unless the text elsewhere confirms it.
- "contactName": the person's full name.
- Any field not stated is null.`,
        text.slice(0, 40000),
        { maxTokens: 8000 },
      );
    } catch (err) {
      return reply.status(502).send({
        error: err instanceof Error ? err.message : 'Could not read the pasted contacts',
      });
    }

    const rows = Array.isArray(parsed.contacts) ? parsed.contacts.slice(0, 500) : [];
    const str = (v: unknown, max: number) => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t && t.toLowerCase() !== 'null' ? t.slice(0, max) : null;
    };

    let imported = 0;
    let skipped = 0;
    const warnings: string[] = [];

    for (const row of rows) {
      const companyName = str(row.companyName, 300);
      const contactName = str(row.contactName, 200);
      const email = str(row.email, 300)?.toLowerCase() ?? null;
      const phone = str(row.phone, 40);

      if (!companyName) {
        skipped++;
        if (contactName) warnings.push(`${contactName}: no company stated — skipped`);
        continue;
      }

      const normalized = normalizeName(companyName);
      const dedupHash = createHash('sha256').update(`${normalized}|manual`).digest('hex').slice(0, 16);

      const prospect = await prisma.prospect.upsert({
        where: { campaignId_dedupHash: { campaignId, dedupHash } },
        create: {
          organizationId,
          campaignId,
          companyName,
          normalizedName: normalized,
          industry: str(row.industry, 120),
          sectorTags: [],
          phone,
          source: 'manual',
          score: 0,
          scoreBreakdown: [],
          dedupHash,
          status: 'NEW',
        },
        update: {
          phone: phone ?? undefined,
        },
      });

      if (contactName || email || phone) {
        const existingContact = email
          ? await prisma.prospectContact.findFirst({ where: { prospectId: prospect.id, email } })
          : null;
        if (!existingContact) {
          await prisma.prospectContact.create({
            data: {
              prospectId: prospect.id,
              fullName: contactName,
              role: str(row.title, 120),
              email,
              phone,
              source: 'manual',
              confidence: 90,
            },
          });
        }
      }

      imported++;
    }

    return reply.status(201).send({ imported, skipped, total: rows.length, warnings: warnings.slice(0, 20) });
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

  app.post('/prospects/:id/import', { preHandler: requireLeadGeneratorAccess() }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const prospect = await prisma.prospect.findFirst({
      where: { id, campaign: { organizationId: request.user.organizationId } },
      include: { contacts: true, campaign: { select: { id: true } } },
    });
    if (!prospect) return reply.status(404).send({ error: 'Prospect not found' });

    if (prospect.importedLeadId) {
      return reply.status(409).send({ error: 'Already imported', leadId: prospect.importedLeadId });
    }

    // Prefer the first named contact with a real email/phone as the lead's primary contact;
    // every other captured contact still rides along via extraEmails/extraPhones below.
    const { primary, extraEmails, extraPhones } = splitPrimaryAndExtraContacts(prospect.contacts, prospect.phone);

    // Duplicate guard
    if (primary?.email || prospect.phone || primary?.phone) {
      const dupe = await prisma.lead.findFirst({
        where: {
          organizationId: request.user.organizationId,
          OR: [
            ...(primary?.email ? [{ emailNormalized: primary.email.toLowerCase() }] : []),
            ...(prospect.phone ? [{ phoneNormalized: prospect.phone.replace(/\D/g, '') }] : []),
            ...(primary?.phone ? [{ phoneNormalized: primary.phone.replace(/\D/g, '') }] : []),
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
        name: primary?.fullName ?? prospect.companyName,
        company: prospect.companyName,
        email: primary?.email ?? null,
        emailNormalized: primary?.email?.toLowerCase() ?? null,
        phone: primary?.phone ?? prospect.phone ?? null,
        phoneNormalized: (primary?.phone ?? prospect.phone)?.replace(/\D/g, '') ?? null,
        extraEmails,
        extraPhones,
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

  app.post('/campaigns/:id/bulk-import', { preHandler: requireLeadGeneratorAccess() }, async (request, reply) => {
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
          include: { contacts: true },
        });
        if (!prospect) { result.skipped++; continue; }
        if (prospect.importedLeadId) { result.skipped++; continue; }

        const { primary, extraEmails, extraPhones } = splitPrimaryAndExtraContacts(prospect.contacts, prospect.phone);

        const dupe = primary?.email || prospect.phone || primary?.phone
          ? await prisma.lead.findFirst({
              where: {
                organizationId: request.user.organizationId,
                OR: [
                  ...(primary?.email ? [{ emailNormalized: primary.email.toLowerCase() }] : []),
                  ...(prospect.phone ? [{ phoneNormalized: prospect.phone.replace(/\D/g, '') }] : []),
                  ...(primary?.phone ? [{ phoneNormalized: primary.phone.replace(/\D/g, '') }] : []),
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
            name: primary?.fullName ?? prospect.companyName,
            company: prospect.companyName,
            email: primary?.email ?? null,
            emailNormalized: primary?.email?.toLowerCase() ?? null,
            phone: primary?.phone ?? prospect.phone ?? null,
            phoneNormalized: (primary?.phone ?? prospect.phone)?.replace(/\D/g, '') ?? null,
            extraEmails,
            extraPhones,
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

  // ── Heat Map ────────────────────────────────────────────────────────────

  app.post('/campaigns/:id/heat-map', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id: campaignId } = request.params as { id: string };
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: request.user.organizationId },
      select: { id: true, industryKeywords: true, locations: true, goal: true },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const keywords = (campaign.industryKeywords as string[]) ?? [];
    const locations = (campaign.locations as string[]) ?? [];
    if (keywords.length === 0) return reply.status(400).send({ error: 'Campaign has no industry keywords' });

    const { runHeatMapDiscovery } = await import('../services/lead-engine/heat-map/heat-map.service.js');
    const result = await runHeatMapDiscovery(campaignId, keywords, locations);
    return reply.send(result);
  });

  app.get('/campaigns/:id/heat-map', async (request, reply) => {
    const { id: campaignId } = request.params as { id: string };
    const { source, intentStrength } = request.query as { source?: string; intentStrength?: string };
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: request.user.organizationId },
      select: { id: true },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });

    const { getHeatMapSignals } = await import('../services/lead-engine/heat-map/heat-map.service.js');
    const signals = await getHeatMapSignals(campaignId, { source, intentStrength });
    return reply.send({ signals });
  });

  app.patch('/signals/:signalId/status', async (request, reply) => {
    const { signalId } = request.params as { signalId: string };
    const { status, campaignId } = request.body as { status: 'SAVED' | 'DISMISSED'; campaignId: string };
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: request.user.organizationId },
      select: { id: true },
    });
    if (!campaign) return reply.status(404).send({ error: 'Campaign not found' });
    const { updateSignalStatus } = await import('../services/lead-engine/heat-map/heat-map.service.js');
    await updateSignalStatus(signalId, campaignId, status);
    return reply.status(204).send();
  });

  // ── Apollo on-demand contact lookup (1 credit per call) ────────────────
  app.post('/signals/:signalId/contacts', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { signalId } = request.params as { signalId: string };
    const signal = await prisma.intentSignal.findFirst({
      where: { id: signalId, campaign: { organizationId: request.user.organizationId } },
      select: { id: true, title: true, url: true, authorCompany: true },
    });
    if (!signal) return reply.status(404).send({ error: 'Signal not found' });

    const { getApolloContact } = await import('../services/lead-engine/heat-map/apollo.service.js');
    const contact = await getApolloContact(signal.title, signal.url, signal.authorCompany);

    if (!contact) {
      return reply.status(404).send({ error: 'No contact found for this signal.' });
    }
    return reply.send({ contact });
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

function parseEmployeeBand(band: string | null | undefined): number | null {
  if (!band) return null;
  const match = band.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}
