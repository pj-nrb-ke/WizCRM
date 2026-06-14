import { normalizeLeadTags } from '@wizcrm/shared';
import type { createUserReminderSchema, updateUserReminderSchema } from '@wizcrm/shared';
import type { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type CreateInput = z.infer<typeof createUserReminderSchema>;
type UpdateInput = z.infer<typeof updateUserReminderSchema>;

export async function listUserReminders(organizationId: string, userId: string, from?: string, to?: string) {
  const start = from ? new Date(from) : new Date();
  start.setDate(start.getDate() - 1);
  const end = to ? new Date(to) : new Date(start.getTime() + 60 * 86400000);
  return prisma.userReminder.findMany({
    where: {
      organizationId,
      userId,
      remindAt: { gte: start, lte: end },
    },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { remindAt: 'asc' },
  });
}

export async function createUserReminder(
  organizationId: string,
  userId: string,
  input: CreateInput,
) {
  if (input.leadId) {
    const lead = await prisma.lead.findFirst({ where: { id: input.leadId, organizationId } });
    if (!lead) return null;
  }
  if (input.calendarEventId) {
    const ev = await prisma.calendarEvent.findFirst({
      where: { id: input.calendarEventId, organizationId, userId },
    });
    if (!ev) return null;
  }
  return prisma.userReminder.create({
    data: {
      organizationId,
      userId,
      title: input.title,
      notes: input.notes,
      remindAt: new Date(input.remindAt),
      tags: normalizeLeadTags(input.tags),
      leadId: input.leadId,
      calendarEventId: input.calendarEventId,
    },
    include: { lead: { select: { id: true, name: true } } },
  });
}

export async function updateUserReminder(
  id: string,
  organizationId: string,
  userId: string,
  input: UpdateInput,
) {
  const existing = await prisma.userReminder.findFirst({
    where: { id, organizationId, userId },
  });
  if (!existing) return null;
  return prisma.userReminder.update({
    where: { id },
    data: {
      title: input.title,
      notes: input.notes === undefined ? undefined : input.notes,
      remindAt: input.remindAt ? new Date(input.remindAt) : undefined,
      tags: input.tags !== undefined ? normalizeLeadTags(input.tags) : undefined,
      leadId: input.leadId,
      calendarEventId: input.calendarEventId,
    },
    include: { lead: { select: { id: true, name: true } } },
  });
}

export async function deleteUserReminder(id: string, organizationId: string, userId: string) {
  const existing = await prisma.userReminder.findFirst({
    where: { id, organizationId, userId },
  });
  if (!existing) return false;
  await prisma.userReminder.delete({ where: { id } });
  return true;
}
