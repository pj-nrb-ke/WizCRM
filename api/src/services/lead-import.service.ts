import type { CreateLeadInput } from '@wizcrm/shared';
import { prisma } from '../lib/prisma.js';
import { createLead } from './lead.service.js';

export async function bulkImportLeads(
  organizationId: string,
  defaultOwnerId: string,
  rows: CreateLeadInput[],
  ownerId?: string,
) {
  const owner = ownerId ?? defaultOwnerId;
  if (ownerId) {
    const user = await prisma.user.findFirst({
      where: { id: ownerId, organizationId },
    });
    if (!user) {
      throw Object.assign(new Error('Owner not found in organization'), { statusCode: 400 });
    }
  }

  const created: { id: string; name: string }[] = [];
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    try {
      const lead = await createLead(organizationId, owner, rows[i]!);
      created.push({ id: lead.id, name: lead.name });
    } catch (e) {
      errors.push({
        row: i + 1,
        message: e instanceof Error ? e.message : 'Import failed',
      });
    }
  }

  return { created, errors, imported: created.length, failed: errors.length };
}
