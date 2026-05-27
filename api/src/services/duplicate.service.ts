import { prisma } from '../lib/prisma.js';
import { normalizePhone } from '@wizcrm/shared';
import type { Prisma } from '@prisma/client';

export type PrismaTx = Prisma.TransactionClient;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findDuplicateLeads(
  organizationId: string,
  email?: string | null,
  phone?: string | null,
  excludeLeadId?: string,
  tx: PrismaTx = prisma,
) {
  const or: Array<{ emailNormalized?: string; phoneNormalized?: string }> = [];
  if (email) or.push({ emailNormalized: normalizeEmail(email) });
  if (phone) or.push({ phoneNormalized: normalizePhone(phone) });
  if (or.length === 0) return [];

  return tx.lead.findMany({
    where: {
      organizationId,
      id: excludeLeadId ? { not: excludeLeadId } : undefined,
      OR: or,
    },
    select: { id: true, name: true, email: true, phone: true, stage: true },
    take: 5,
  });
}

async function lockLeadCreateKeys(
  tx: PrismaTx,
  organizationId: string,
  email?: string | null,
  phone?: string | null,
) {
  const keys: string[] = [];
  if (phone) keys.push(`p:${normalizePhone(phone)}`);
  if (email) keys.push(`e:${normalizeEmail(email)}`);
  keys.sort();
  for (const key of keys) {
    const lockKey = `${organizationId}:${key}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  }
}

export class DuplicateLeadError extends Error {
  statusCode = 409;
  duplicates: Awaited<ReturnType<typeof findDuplicateLeads>>;

  constructor(duplicates: Awaited<ReturnType<typeof findDuplicateLeads>>) {
    super('DUPLICATE');
    this.name = 'DuplicateLeadError';
    this.duplicates = duplicates;
  }
}

/** Atomic duplicate check + create (fixes concurrent double-create race). */
export async function runWithDuplicateGuard<T>(
  organizationId: string,
  email: string | null | undefined,
  phone: string | null | undefined,
  force: boolean,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lockLeadCreateKeys(tx, organizationId, email, phone);
    const duplicates = await findDuplicateLeads(organizationId, email, phone, undefined, tx);
    if (duplicates.length > 0 && !force) {
      throw new DuplicateLeadError(duplicates);
    }
    return fn(tx);
  });
}
