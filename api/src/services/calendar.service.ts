import type { Prisma } from '@prisma/client';
import type { createCalendarEventSchema, updateCalendarEventSchema } from '@wizcrm/shared';
import type { z } from 'zod';
import { prisma } from '../lib/prisma.js';

type CreateInput = z.infer<typeof createCalendarEventSchema>;
type UpdateInput = z.infer<typeof updateCalendarEventSchema>;

function parseRange(from?: string, to?: string) {
  const start = from ? new Date(from) : new Date();
  if (!from) start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date(start.getTime() + 14 * 86400000);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function listCalendarEvents(
  organizationId: string,
  userId: string,
  role: string,
  query: { from?: string; to?: string; teamScope?: boolean },
) {
  const { start, end } = parseRange(query.from, query.to);
  const isManager = role === 'MANAGER' || role === 'ADMIN';

  const where: Prisma.CalendarEventWhereInput = {
    organizationId,
    startAt: { lte: end },
    endAt: { gte: start },
    ...(isManager && query.teamScope ? {} : { userId }),
  };

  return prisma.calendarEvent.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
    orderBy: { startAt: 'asc' },
  });
}

export async function createCalendarEvent(
  organizationId: string,
  userId: string,
  input: CreateInput,
) {
  if (input.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId },
    });
    if (!lead) return null;
  }

  const event = await prisma.calendarEvent.create({
    data: {
      organizationId,
      userId,
      leadId: input.leadId,
      title: input.title,
      notes: input.notes,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      allDay: input.allDay ?? false,
      recurrence: input.recurrence ?? 'NONE',
      recurrenceIntervalDays: input.recurrenceIntervalDays,
      recurrenceUntil: input.recurrenceUntil ? new Date(input.recurrenceUntil) : null,
      reminderMinutes: input.reminderMinutes,
      meetingAddress: input.meetingAddress,
      meetingLat: input.meetingLat,
      meetingLng: input.meetingLng,
    },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
  });

  if (input.leadId) {
    await prisma.activity.create({
      data: {
        leadId: input.leadId,
        userId,
        type: 'CALENDAR_EVENT',
        subject: input.title,
        body: input.notes ?? `Scheduled ${input.startAt}`,
        metadata: { calendarEventId: event.id } as Prisma.InputJsonValue,
      },
    });
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { lastActivityAt: new Date() },
    });
  }

  return event;
}

export async function updateCalendarEvent(
  id: string,
  organizationId: string,
  userId: string,
  role: string,
  input: UpdateInput,
) {
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const existing = await prisma.calendarEvent.findFirst({
    where: {
      id,
      organizationId,
      ...(isManager ? {} : { userId }),
    },
  });
  if (!existing) return null;

  if (input.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, organizationId },
    });
    if (!lead) return null;
  }

  const data: Prisma.CalendarEventUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.leadId !== undefined) data.lead = input.leadId ? { connect: { id: input.leadId } } : { disconnect: true };
  if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
  if (input.endAt !== undefined) data.endAt = new Date(input.endAt);
  if (input.allDay !== undefined) data.allDay = input.allDay;
  if (input.recurrence !== undefined) data.recurrence = input.recurrence;
  if (input.recurrenceIntervalDays !== undefined) {
    data.recurrenceIntervalDays = input.recurrenceIntervalDays;
  }
  if (input.recurrenceUntil !== undefined) {
    data.recurrenceUntil = input.recurrenceUntil ? new Date(input.recurrenceUntil) : null;
  }
  if (input.reminderMinutes !== undefined) data.reminderMinutes = input.reminderMinutes;
  if (input.meetingAddress !== undefined) data.meetingAddress = input.meetingAddress;
  if (input.meetingLat !== undefined) data.meetingLat = input.meetingLat;
  if (input.meetingLng !== undefined) data.meetingLng = input.meetingLng;

  return prisma.calendarEvent.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function deleteCalendarEvent(
  id: string,
  organizationId: string,
  userId: string,
  role: string,
) {
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const existing = await prisma.calendarEvent.findFirst({
    where: {
      id,
      organizationId,
      ...(isManager ? {} : { userId }),
    },
  });
  if (!existing) return false;
  await prisma.calendarEvent.delete({ where: { id } });
  return true;
}

export async function checkInCalendarEvent(
  id: string,
  organizationId: string,
  userId: string,
  role: string,
  input: { lat?: number; lng?: number; attendanceStatus?: 'ON_TIME' | 'LATE' | 'NO_SHOW' | 'PARTIAL' },
) {
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, organizationId, ...(isManager ? {} : { userId }) },
  });
  if (!existing) return null;

  const now = new Date();
  let status = input.attendanceStatus;
  if (!status && existing.startAt) {
    const lateMs = now.getTime() - existing.startAt.getTime();
    status = lateMs > 15 * 60_000 ? 'LATE' : 'ON_TIME';
  }

  return prisma.calendarEvent.update({
    where: { id },
    data: {
      checkInAt: now,
      attendanceStatus: status ?? 'ON_TIME',
      ...(input.lat !== undefined ? { meetingLat: input.lat } : {}),
      ...(input.lng !== undefined ? { meetingLng: input.lng } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
  });
}

export async function checkOutCalendarEvent(
  id: string,
  organizationId: string,
  userId: string,
  role: string,
  input: { lat?: number; lng?: number; attendanceStatus?: 'ON_TIME' | 'LATE' | 'NO_SHOW' | 'PARTIAL' },
) {
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, organizationId, ...(isManager ? {} : { userId }) },
  });
  if (!existing) return null;

  return prisma.calendarEvent.update({
    where: { id },
    data: {
      checkOutAt: new Date(),
      ...(input.attendanceStatus ? { attendanceStatus: input.attendanceStatus } : {}),
    },
    include: {
      user: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, company: true } },
    },
  });
}
