import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '@wizcrm/shared';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findDuplicateLeads(
  organizationId: string,
  email?: string | null,
  phone?: string | null,
  excludeLeadId?: string,
) {
  const or: Array<{ emailNormalized?: string; phoneNormalized?: string }> = [];
  if (email) or.push({ emailNormalized: normalizeEmail(email) });
  if (phone) or.push({ phoneNormalized: normalizePhone(phone) });
  if (or.length === 0) return [];

  return prisma.lead.findMany({
    where: {
      organizationId,
      id: excludeLeadId ? { not: excludeLeadId } : undefined,
      OR: or,
    },
    select: { id: true, name: true, email: true, phone: true, stage: true },
    take: 5,
  });
}
