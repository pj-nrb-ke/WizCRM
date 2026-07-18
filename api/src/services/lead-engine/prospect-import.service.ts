import { createHash } from 'node:crypto';
import type { ProspectCandidate, ProspectContactCandidate } from '@wizcrm/shared';
import { prisma } from '../../lib/prisma.js';
import { createOpenAIClient, chatJson } from '../ai/openai.provider.js';
import { buildExtractionText, chunkExtractionText } from '../import-file-text.js';
import { normalizeName } from './discovery/google-places.provider.js';
import { findContactsForCompanies } from '../contact-finder/contact-finder.service.js';

const MAX_CANDIDATES = 3000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ProspectImportUnavailableError extends Error {
  readonly code = 'PROSPECT_IMPORT_UNAVAILABLE';
}

// ── Extraction ────────────────────────────────────────────────────────────────

function sanitizeContact(item: Record<string, unknown>): ProspectContactCandidate {
  const str = (v: unknown, max: number): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
  };
  const email = str(item.email, 200);
  const phone = str(item.phone, 30);
  return {
    name: str(item.name, 200),
    title: str(item.title, 120),
    email: email && EMAIL_RE.test(email) ? email : undefined,
    phone: phone && phone.length >= 5 ? phone : undefined,
  };
}

function sanitizeCandidate(item: Record<string, unknown>): ProspectCandidate | null {
  const str = (v: unknown, max: number): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : undefined;
  };
  const companyName = str(item.companyName, 300);
  if (!companyName) return null;

  const contactsRaw = Array.isArray(item.contacts) ? item.contacts : [];
  const contacts = contactsRaw
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map(sanitizeContact)
    .filter((c) => c.name || c.email || c.phone)
    .slice(0, 10);

  return {
    companyName,
    industry: str(item.industry, 120),
    address: str(item.address, 500),
    website: str(item.website, 500),
    source: str(item.source, 100),
    contacts,
  };
}

const SYSTEM_PROMPT = `You extract a prospect list from a raw file dump (spreadsheet CSV export, JSON, or plain text) for a sales team to work through — these are cold contacts, not yet spoken to.

The source is often messy: multiple sheets, inconsistent headers, decision-makers listed in a
separate sheet from the company's other details (sector, size, tier). When rows across sheets
reference the same company (match by name, case-insensitive, tolerate minor spelling variation),
MERGE them into a single company record — do not create duplicate entries for the same company.

Crucially: a company may have MORE THAN ONE contact person (e.g. a Managing Director AND a Head
of Operations both listed). Capture every distinct named contact for that company as a separate
entry in its "contacts" array — do not collapse them into one.

For each company, produce:
- companyName: the organization's name.
- industry: sector/industry if stated (e.g. "FMCG manufacturing"), otherwise omit.
- address: physical address or location if present, otherwise omit.
- website: company website if present, otherwise omit.
- source: a short label for where this list came from (file name, sheet name, or context), or omit.
- contacts: an array, one entry per distinct named person found for this company:
  - name: the person's full name. Omit if not given.
  - title: their role/title if stated, otherwise omit.
  - email: prefer a named person's direct email over a generic one (info@, sales@). Omit
    entirely if the value is just instructional text like "Use website enquiry" rather than a
    real address.
  - phone: a real phone number only. Omit if the source only says something like "no reliable
    public number confirmed".
  If NO named contacts exist for a company at all, return an empty contacts array — the company
  can still be recorded, and its email/phone would then need separate research.

Skip rows that clearly aren't real companies (headers, blank rows, totals, notes-to-self).
Every entry needs a non-empty companyName. If literally nothing usable exists for a row, drop it
rather than inventing data.

Return strict JSON: { "companies": [...], "warnings": [...] }. "warnings" is a short list of
plain-English notes about anything you skipped, merged, or are unsure about.`;

export type ProspectExtractionResult = {
  candidates: ProspectCandidate[];
  warnings: string[];
  truncated: boolean;
  researchedCount: number;
};

export async function extractProspectsFromImport(
  fileName: string,
  mimeType: string,
  dataBase64: string,
  organizationId: string,
  research: boolean,
): Promise<ProspectExtractionResult> {
  const client = createOpenAIClient();
  if (!client) {
    throw new ProspectImportUnavailableError('AI extraction is not configured for this server.');
  }

  const text = buildExtractionText(fileName, mimeType, dataBase64);
  if (!text.trim()) {
    return { candidates: [], warnings: ['The file appeared to be empty.'], truncated: false, researchedCount: 0 };
  }

  // Chunked so a big file's AI reply can't get cut off mid-JSON (that truncation is what
  // used to throw "Expected property name or '}' in JSON" on 2,000+ row imports) — each
  // chunk is small enough to reliably finish in one response.
  const chunks = chunkExtractionText(text);
  const candidates: ProspectCandidate[] = [];
  const warnings: string[] = [];
  let dropped = 0;
  let itemsSeen = 0;
  let chunksFailed = 0;

  for (const chunk of chunks) {
    if (candidates.length >= MAX_CANDIDATES) break;
    let raw: { companies?: unknown[]; warnings?: unknown[] };
    try {
      raw = await chatJson<{ companies?: unknown[]; warnings?: unknown[] }>(
        client,
        SYSTEM_PROMPT,
        `File: ${fileName}\n\n${chunk}`,
        { temperature: 0.2, maxTokens: 16_000 },
      );
    } catch {
      chunksFailed++;
      continue;
    }

    const items = Array.isArray(raw.companies) ? raw.companies : [];
    itemsSeen += items.length;
    for (const item of items) {
      if (candidates.length >= MAX_CANDIDATES) break;
      if (typeof item !== 'object' || item === null) {
        dropped++;
        continue;
      }
      const sanitized = sanitizeCandidate(item as Record<string, unknown>);
      if (sanitized) candidates.push(sanitized);
      else dropped++;
    }
    warnings.push(...(raw.warnings ?? []).filter((w): w is string => typeof w === 'string'));
  }

  if (dropped > 0) {
    warnings.push(`${dropped} row${dropped === 1 ? '' : 's'} had no usable company name and were skipped.`);
  }
  if (chunksFailed > 0) {
    warnings.push(
      `${chunksFailed} section${chunksFailed === 1 ? '' : 's'} of the file could not be read by AI and ${chunksFailed === 1 ? 'was' : 'were'} skipped — try re-uploading if companies seem missing.`,
    );
  }
  const truncated = itemsSeen > MAX_CANDIDATES || candidates.length >= MAX_CANDIDATES;

  let researchedCount = 0;
  if (research) {
    researchedCount = await researchMissingContacts(candidates, organizationId);
    if (researchedCount > 0) {
      warnings.push(`Researched contact details for ${researchedCount} compan${researchedCount === 1 ? 'y' : 'ies'} with no contact in the file.`);
    }
  }

  await flagDuplicates(organizationId, candidates);

  return { candidates, warnings, truncated, researchedCount };
}

// ── Research (opt-in, capped) ───────────────────────────────────────────────────

const RESEARCH_CAP = 50;

/** For companies with zero usable contact, try Contact Finder. Mutates candidates in place. Returns count researched. */
async function researchMissingContacts(candidates: ProspectCandidate[], organizationId: string): Promise<number> {
  const needsResearch = candidates.filter(
    (c) => c.contacts.length === 0 || c.contacts.every((ct) => !ct.email && !ct.phone),
  );
  const toResearch = needsResearch.slice(0, RESEARCH_CAP);
  if (toResearch.length === 0) return 0;

  const results = await findContactsForCompanies(
    toResearch.map((c) => ({ name: c.companyName, website: c.website })),
    { organizationId, threshold: 3 },
  ).catch(() => []);

  let researched = 0;
  for (let i = 0; i < toResearch.length; i++) {
    const found = results[i];
    if (!found || found.contacts.length === 0) continue;
    const target = toResearch[i]!;
    const added: ProspectContactCandidate[] = found.contacts
      .filter((c) => c.email || c.phone)
      .slice(0, 5)
      .map((c) => ({
        name: c.name ?? undefined,
        title: c.title ?? undefined,
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
      }));
    if (added.length > 0) {
      target.contacts = [...target.contacts, ...added];
      researched++;
    }
  }
  return researched;
}

// ── Duplicate check (cross-file, cross-list, cross-lead) ───────────────────────

/** Flags each candidate that matches an existing Lead, an existing Prospect in ANY list, or an earlier row in this same batch. Mutates candidates in place. */
async function flagDuplicates(organizationId: string, candidates: ProspectCandidate[]): Promise<void> {
  const seenInBatch = new Set<string>();

  const allEmails = candidates.flatMap((c) => c.contacts.map((ct) => ct.email?.toLowerCase()).filter(Boolean)) as string[];
  const allPhones = candidates.flatMap((c) => c.contacts.map((ct) => ct.phone?.replace(/\D/g, '')).filter(Boolean)) as string[];

  const [existingLeads, existingProspects] = await Promise.all([
    allEmails.length || allPhones.length
      ? prisma.lead.findMany({
          where: {
            organizationId,
            OR: [
              ...(allEmails.length ? [{ emailNormalized: { in: allEmails } }] : []),
              ...(allPhones.length ? [{ phoneNormalized: { in: allPhones } }] : []),
            ],
          },
          select: { id: true, name: true, emailNormalized: true, phoneNormalized: true },
        })
      : Promise.resolve([]),
    prisma.prospect.findMany({
      where: { organizationId },
      select: {
        id: true,
        companyName: true,
        normalizedName: true,
        campaign: { select: { name: true } },
        contacts: { select: { email: true, phone: true } },
      },
    }),
  ]);

  const leadByEmail = new Map(existingLeads.filter((l) => l.emailNormalized).map((l) => [l.emailNormalized!, l]));
  const leadByPhone = new Map(existingLeads.filter((l) => l.phoneNormalized).map((l) => [l.phoneNormalized!, l]));
  const prospectByName = new Map(existingProspects.map((p) => [p.normalizedName, p]));
  const prospectByEmail = new Map(
    existingProspects.flatMap((p) => p.contacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), p] as const)),
  );

  for (const candidate of candidates) {
    const normalized = normalizeName(candidate.companyName);
    const emails = candidate.contacts.map((c) => c.email?.toLowerCase()).filter(Boolean) as string[];
    const phones = candidate.contacts.map((c) => c.phone?.replace(/\D/g, '')).filter(Boolean) as string[];

    // Within-batch duplicate (same company appears twice in this upload).
    if (seenInBatch.has(normalized)) {
      candidate.duplicate = { type: 'batch', label: `Duplicate of another row in this file (${candidate.companyName})` };
      continue;
    }
    seenInBatch.add(normalized);

    // Existing Lead, by email or phone.
    const leadMatch = emails.map((e) => leadByEmail.get(e)).find(Boolean) ?? phones.map((p) => leadByPhone.get(p)).find(Boolean);
    if (leadMatch) {
      candidate.duplicate = { type: 'lead', label: `Already a lead: ${leadMatch.name}`, leadId: leadMatch.id };
      continue;
    }

    // Existing Prospect, by company name or contact email, in ANY list.
    const prospectMatch = prospectByName.get(normalized) ?? emails.map((e) => prospectByEmail.get(e)).find(Boolean);
    if (prospectMatch) {
      candidate.duplicate = {
        type: 'prospect',
        label: `Already on list "${prospectMatch.campaign?.name ?? 'Unknown'}"`,
        prospectId: prospectMatch.id,
      };
    }
  }
}

// ── Commit ───────────────────────────────────────────────────────────────────

export type ProspectImportCommitResult = {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export async function commitProspectImport(
  organizationId: string,
  campaignId: string,
  rows: ProspectCandidate[],
): Promise<ProspectImportCommitResult> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, organizationId } });
  if (!campaign) {
    throw Object.assign(new Error('List not found'), { statusCode: 404 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const normalized = normalizeName(row.companyName);
      const dedupHash = createHash('sha256').update(`${normalized}|manual`).digest('hex').slice(0, 16);

      const prospect = await prisma.prospect.upsert({
        where: { campaignId_dedupHash: { campaignId, dedupHash } },
        create: {
          organizationId,
          campaignId,
          companyName: row.companyName,
          normalizedName: normalized,
          industry: row.industry ?? null,
          sectorTags: [],
          address: row.address ?? null,
          website: row.website ?? null,
          source: row.source ?? 'manual',
          score: 0,
          scoreBreakdown: [],
          dedupHash,
          status: 'NEW',
        },
        update: {
          industry: row.industry ?? undefined,
          address: row.address ?? undefined,
          website: row.website ?? undefined,
        },
      });

      for (const contact of row.contacts) {
        if (!contact.name && !contact.email && !contact.phone) continue;
        const existing = contact.email
          ? await prisma.prospectContact.findFirst({ where: { prospectId: prospect.id, email: contact.email } })
          : null;
        if (existing) continue;
        await prisma.prospectContact.create({
          data: {
            prospectId: prospect.id,
            fullName: contact.name ?? null,
            role: contact.title ?? null,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            source: 'manual',
            confidence: 90,
          },
        });
      }

      imported++;
    } catch (e) {
      skipped++;
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : 'Import failed' });
    }
  }

  return { imported, skipped, errors };
}
