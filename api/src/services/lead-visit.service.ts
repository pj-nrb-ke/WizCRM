import { prisma } from '../lib/prisma.js';

const userSelect = { id: true, name: true, email: true } as const;

export async function listLeadVisits(organizationId: string, leadId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return null;

  return prisma.leadVisit.findMany({
    where: { leadId },
    orderBy: { visitNumber: 'desc' },
    include: {
      user: { select: userSelect },
      _count: { select: { attachments: true } },
    },
  });
}

export async function createLeadVisit(
  organizationId: string,
  leadId: string,
  userId: string,
  input: { checkInLat?: number; checkInLng?: number; calendarEventId?: string },
) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) return null;

  const last = await prisma.leadVisit.findFirst({
    where: { leadId },
    orderBy: { visitNumber: 'desc' },
    select: { visitNumber: true },
  });

  return prisma.leadVisit.create({
    data: {
      organizationId,
      leadId,
      userId,
      visitNumber: (last?.visitNumber ?? 0) + 1,
      checkInLat: input.checkInLat,
      checkInLng: input.checkInLng,
      calendarEventId: input.calendarEventId,
    },
    include: { user: { select: userSelect } },
  });
}

/** The most recent visit for this lead still awaiting a report, if any — used so filing a
 * report defaults to "finish the visit I already logged" instead of always creating a new one. */
export async function findOpenVisit(leadId: string) {
  return prisma.leadVisit.findFirst({
    where: { leadId, hasReport: false },
    orderBy: { visitNumber: 'desc' },
  });
}

export async function fileVisitReport(
  organizationId: string,
  leadId: string,
  userId: string,
  input: {
    visitId?: string;
    activityId: string;
    outcome: string;
    whoMet?: string;
    nextStep?: string;
  },
) {
  let visit = input.visitId
    ? await prisma.leadVisit.findFirst({ where: { id: input.visitId, leadId } })
    : await findOpenVisit(leadId);

  if (!visit) {
    const last = await prisma.leadVisit.findFirst({
      where: { leadId },
      orderBy: { visitNumber: 'desc' },
      select: { visitNumber: true },
    });
    visit = await prisma.leadVisit.create({
      data: { organizationId, leadId, userId, visitNumber: (last?.visitNumber ?? 0) + 1 },
    });
  }

  return prisma.leadVisit.update({
    where: { id: visit.id },
    data: {
      hasReport: true,
      outcome: input.outcome,
      whoMet: input.whoMet,
      nextStep: input.nextStep,
      activityId: input.activityId,
    },
  });
}

/** Manager-facing: how much field effort is being logged without ever being turned into a report. */
export async function listVisitsMissingReport(organizationId: string) {
  const visits = await prisma.leadVisit.findMany({
    where: { organizationId, hasReport: false },
    orderBy: { occurredAt: 'desc' },
    include: {
      lead: { select: { id: true, name: true, company: true, stage: true } },
      user: { select: userSelect },
    },
    take: 200,
  });
  return { visits, count: visits.length };
}
