import { prisma } from '../../lib/prisma.js';
import { config } from '../../config.js';
import type { ClassifiedContact, FieldClass } from './types.js';

// ── Email prefix sets ─────────────────────────────────────────────────────────

const GENERIC_PREFIXES = new Set([
  'info', 'sales', 'admin', 'contact', 'hello', 'support', 'enquiries',
  'enquiry', 'office', 'mail', 'reception', 'general', 'orders', 'purchase',
  'purchasing', 'procurement', 'logistics', 'operations', 'noreply', 'no-reply',
  'webmaster', 'postmaster', 'accounts', 'billing', 'feedback', 'inquiry',
]);

const ROLE_PREFIXES = new Set([
  'hr', 'humanresources', 'cfo', 'finance', 'accounting', 'it', 'erp', 'legal',
  'compliance', 'director', 'md', 'ceo', 'gm', 'manager', 'head', 'coo', 'cto',
  'marketing', 'strategy', 'business', 'secretary', 'pa', 'ea',
]);

function emailLocalPart(email: string): string {
  return (email.split('@')[0] ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

export function classifyEmail(email: string | null): FieldClass {
  if (!email) return 'Firmographic';
  const local = emailLocalPart(email);
  if (GENERIC_PREFIXES.has(local)) return 'Firmographic';
  if (ROLE_PREFIXES.has(local)) return 'RoleBasedContact';
  return 'PersonalContact';
}

// ── Contact classifier ────────────────────────────────────────────────────────

export function classifyContact(raw: {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
}): ClassifiedContact {
  const emailClass = classifyEmail(raw.email);
  const hasNamedIndividual = Boolean(raw.name && raw.name !== 'Unknown' && raw.name.includes(' '));

  // Personal = named individual + non-generic/role email
  const fieldClass: FieldClass =
    emailClass === 'PersonalContact' && hasNamedIndividual
      ? 'PersonalContact'
      : emailClass === 'RoleBasedContact'
      ? 'RoleBasedContact'
      : 'Firmographic';

  return {
    name: raw.name,
    title: raw.title,
    email: raw.email,
    phone: raw.phone,
    linkedinUrl: raw.linkedinUrl,
    fieldClass,
    lawfulBasis: null,
    source: raw.source,
    retrievedAt: new Date().toISOString(),
  };
}

// ── KDPA gating ───────────────────────────────────────────────────────────────

export function gatePersonalData(contacts: ClassifiedContact[]): {
  allowed: ClassifiedContact[];
  gated: number;
} {
  const mode = config.kdpaMode;
  let gated = 0;

  const allowed = contacts
    .map((c) => {
      if (c.fieldClass !== 'PersonalContact') return c;
      if (c.lawfulBasis) return c; // explicitly unlocked by caller

      gated++;

      if (mode === 'block') return null; // exclude entirely

      // mode === 'gate': keep record but strip identifying fields
      return {
        ...c,
        name: null,
        linkedinUrl: null,
        phone: null, // direct dial is personal
      };
    })
    .filter((c): c is ClassifiedContact => c !== null);

  return { allowed, gated };
}

// ── Data-subject deletion (Kenya DPA Article 35) ──────────────────────────────

export async function purgePersonalData(
  organizationId: string,
  email: string,
): Promise<{ deletedContacts: number; suppressedProspects: number }> {
  const emailLower = email.toLowerCase();

  // 1. Find and delete all ProspectContact rows matching this email
  const contacts = await prisma.prospectContact.findMany({
    where: {
      email: { equals: emailLower, mode: 'insensitive' },
      prospect: { organizationId },
    },
    select: { id: true, prospectId: true },
  });

  const prospectIds = [...new Set(contacts.map((c) => c.prospectId))];

  await prisma.prospectContact.deleteMany({
    where: { id: { in: contacts.map((c) => c.id) } },
  });

  // 2. Suppress the parent prospects so they are never emailed
  if (prospectIds.length) {
    await prisma.prospect.updateMany({
      where: { id: { in: prospectIds }, organizationId },
      data: { status: 'SUPPRESSED' },
    });
  }

  // 3. Add email domain to suppression list so it is not re-discovered
  const domain = emailLower.split('@')[1];
  if (domain) {
    const admin = await prisma.user.findFirst({
      where: { organizationId, role: 'ADMIN' },
      select: { id: true },
    });
    if (admin) {
      await prisma.suppressionList
        .create({
          data: {
            organizationId,
            addedById: admin.id,
            domain,
            reason: `KDPA data-subject deletion request for ${emailLower}`,
          },
        })
        .catch(() => {}); // ignore if domain already suppressed
    }
  }

  return { deletedContacts: contacts.length, suppressedProspects: prospectIds.length };
}
