import { prisma } from '../lib/prisma.js';
import type { PhotoCaptureCategory } from './ai/orchestrator.js';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Has this event/company already been captured by someone in the org? Org-scoped
 * so any team member's capture blocks everyone else's, not just their own.
 * Matching is a case-insensitive exact match on the AI-extracted name — it
 * won't catch a differently-worded flyer for the same event, but reliably
 * catches the common case of two reps photographing the same flyer.
 */
export async function findDuplicateCapture(
  organizationId: string,
  category: PhotoCaptureCategory,
  fields: { eventName?: string; company?: string },
): Promise<string | null> {
  if (category === 'EXHIBITION_TENDER') {
    const eventName = fields.eventName?.trim();
    if (!eventName) return null;
    const existing = await prisma.calendarEvent.findFirst({
      where: { organizationId, title: { equals: eventName, mode: 'insensitive' } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) return null;
    return `"${eventName}" was already captured by ${existing.user.name} on ${formatDate(existing.createdAt)}.`;
  }

  const company = fields.company?.trim();
  if (!company) return null;
  const existing = await prisma.lead.findFirst({
    where: { organizationId, company: { equals: company, mode: 'insensitive' }, tags: { has: 'Billboard / Signboard' } },
    include: { owner: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing) return null;
  return `${company} was already captured by ${existing.owner.name} on ${formatDate(existing.createdAt)}.`;
}
