import type { DeskItem } from './desk-rules.service.js';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings } from './org-settings.service.js';

/** PRO-002 / PRO-011: quotation follow-ups for sales desk. */
export async function buildQuotationDeskItems(
  organizationId: string,
  ownerId: string,
): Promise<DeskItem[]> {
  const settings = await getOrgSettings(organizationId);
  const days = settings.quoteFollowUpDays ?? 7;
  const defaultCutoff = new Date();
  defaultCutoff.setDate(defaultCutoff.getDate() - days);
  const now = new Date();

  const quotes = await prisma.quotation.findMany({
    where: {
      organizationId,
      ownerId,
      status: 'SENT',
      OR: [{ followUpAt: { lte: now } }, { followUpAt: null, updatedAt: { lte: defaultCutoff } }],
    },
    include: { lead: { select: { id: true, name: true } } },
    take: 10,
    orderBy: { updatedAt: 'asc' },
  });

  return quotes.map((q) => ({
    leadId: q.leadId,
    title: `Quote follow-up: ${q.lead.name}`,
    reason: `${q.referenceNumber} · ${Number(q.total).toLocaleString()} total`,
  }));
}
