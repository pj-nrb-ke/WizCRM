import type { Prisma } from '@prisma/client';
import { normalizeLeadTags, type createCalendarEventSchema, type updateCalendarEventSchema } from '@wizcrm/shared';
import { DEFAULT_CHECK_IN_RADIUS_METERS, haversineDistanceMeters } from '@wizcrm/shared';
import type { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getOrgSettings } from './org-settings.service.js';

type CreateInput = z.infer<typeof createCalendarEventSchema>;
type UpdateInput = z.infer<typeof updateCalendarEventSchema>;

const eventInclude = {
  user: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, company: true } },
  attendees: {
    select: {
      userId: true,
      status: true,
      respondedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.CalendarEventInclude;

/**
 * Keep only ids that are real users in this org, minus the organiser —
 * the organiser is always on the event via CalendarEvent.userId.
 */
async function resolveAttendeeIds(
  organizationId: string,
  organiserId: string,
  attendeeIds: string[],
): Promise<string[]> {
  const wanted = [...new Set(attendeeIds)].filter((id) => id !== organiserId);
  if (wanted.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: wanted }, organizationId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Everyone in the org, for the attendee picker. Any signed-in user may read this. */
export async function listOrgUsers(organizationId: string) {
  return prisma.user.findMany({
    where: { organizationId },
    select: { id: true, name: true, email: true, role: true, team: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}

export type BusyBlock = { eventId: string; startAt: Date; endAt: Date; allDay: boolean; title: string };
export type UserAvailability = { userId: string; name: string; busy: BusyBlock[] };

/**
 * Who is unavailable between `from` and `to`.
 *
 * A person is busy for an event they organise, or one they were invited to and
 * have not declined. Titles are only revealed to someone already entitled to see
 * the event (its organiser, an attendee, or a manager); to everyone else a block
 * reads "Busy", so the view never leaks what a colleague is doing.
 */
export async function getTeamAvailability(
  organizationId: string,
  viewerId: string,
  role: string,
  query: { from: Date; to: Date; userIds?: string[]; excludeEventId?: string },
): Promise<UserAvailability[]> {
  const isManager = role === 'MANAGER' || role === 'ADMIN';

  const people = await prisma.user.findMany({
    where: { organizationId, ...(query.userIds?.length ? { id: { in: query.userIds } } : {}) },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  if (people.length === 0) return [];
  const ids = people.map((p) => p.id);

  const events = await prisma.calendarEvent.findMany({
    where: {
      organizationId,
      // Strict overlap: an event ending exactly when another starts is not a clash.
      startAt: { lt: query.to },
      endAt: { gt: query.from },
      ...(query.excludeEventId ? { id: { not: query.excludeEventId } } : {}),
      OR: [
        { userId: { in: ids } },
        { attendees: { some: { userId: { in: ids }, status: { not: 'DECLINED' } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      allDay: true,
      userId: true,
      attendees: { select: { userId: true, status: true } },
    },
    orderBy: { startAt: 'asc' },
  });

  const byUser = new Map<string, BusyBlock[]>(ids.map((id) => [id, []]));

  for (const ev of events) {
    const viewerMaySeeTitle =
      isManager || ev.userId === viewerId || ev.attendees.some((a) => a.userId === viewerId);
    const title = viewerMaySeeTitle ? ev.title : 'Busy';

    // The organiser is busy; so is every invitee who has not declined.
    const busyFor = new Set<string>();
    if (byUser.has(ev.userId)) busyFor.add(ev.userId);
    for (const a of ev.attendees) {
      if (a.status !== 'DECLINED' && byUser.has(a.userId)) busyFor.add(a.userId);
    }
    for (const uid of busyFor) {
      byUser.get(uid)!.push({
        eventId: ev.id,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: ev.allDay,
        title,
      });
    }
  }

  return people.map((p) => ({ userId: p.id, name: p.name, busy: byUser.get(p.id) ?? [] }));
}

export class GeofenceCheckInError extends Error {
  readonly code = 'GEOFENCE';
  constructor(
    readonly distanceM: number,
    readonly radiusM: number,
  ) {
    super(`Check-in is ${Math.round(distanceM)}m from meeting location (limit ${radiusM}m).`);
    this.name = 'GeofenceCheckInError';
  }
}

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
    // Managers on a team view see everything; everyone else sees what they
    // organise plus anything they have been invited to.
    ...(isManager && query.teamScope
      ? {}
      : { OR: [{ userId }, { attendees: { some: { userId } } }] }),
  };

  return prisma.calendarEvent.findMany({
    where,
    include: eventInclude,
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

  const attendeeIds = await resolveAttendeeIds(organizationId, userId, input.attendeeIds ?? []);

  const event = await prisma.calendarEvent.create({
    data: {
      organizationId,
      userId,
      attendees: { create: attendeeIds.map((id) => ({ userId: id })) },
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
      tags: normalizeLeadTags(input.tags),
      meetingAddress: input.meetingAddress,
      meetingLat: input.meetingLat,
      meetingLng: input.meetingLng,
      eventType: input.eventType ?? 'MEETING',
      meetingMode: input.meetingMode ?? 'IN_PERSON',
      meetingUrl: input.meetingUrl,
    },
    include: eventInclude,
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
  if (input.tags !== undefined) data.tags = normalizeLeadTags(input.tags);
  if (input.meetingAddress !== undefined) data.meetingAddress = input.meetingAddress;
  if (input.meetingLat !== undefined) data.meetingLat = input.meetingLat;
  if (input.meetingLng !== undefined) data.meetingLng = input.meetingLng;
  if (input.eventType !== undefined) data.eventType = input.eventType;
  if (input.meetingMode !== undefined) data.meetingMode = input.meetingMode;
  if (input.meetingUrl !== undefined) data.meetingUrl = input.meetingUrl;

  if (input.attendeeIds !== undefined) {
    // Reconcile against the organiser of the event, not whoever is editing it.
    const wanted = await resolveAttendeeIds(organizationId, existing.userId, input.attendeeIds);
    const current = await prisma.calendarEventAttendee.findMany({
      where: { eventId: id },
      select: { userId: true },
    });
    const currentIds = current.map((a) => a.userId);
    const removed = currentIds.filter((uid) => !wanted.includes(uid));
    const added = wanted.filter((uid) => !currentIds.includes(uid));
    // Untouched attendees keep their RSVP; only the delta moves.
    data.attendees = {
      ...(removed.length ? { deleteMany: { userId: { in: removed } } } : {}),
      ...(added.length ? { create: added.map((uid) => ({ userId: uid })) } : {}),
    };
  }

  return prisma.calendarEvent.update({
    where: { id },
    data,
    include: eventInclude,
  });
}

/** An invited attendee answers their own invite. Organisers are not attendees. */
export async function rsvpCalendarEvent(
  id: string,
  organizationId: string,
  userId: string,
  status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE',
) {
  const invite = await prisma.calendarEventAttendee.findFirst({
    where: { eventId: id, userId, event: { organizationId } },
  });
  if (!invite) return null;

  await prisma.calendarEventAttendee.update({
    where: { id: invite.id },
    data: { status, respondedAt: new Date() },
  });

  return prisma.calendarEvent.findUnique({ where: { id }, include: eventInclude });
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
  input: {
    lat?: number;
    lng?: number;
    attendanceStatus?: 'ON_TIME' | 'LATE' | 'NO_SHOW' | 'PARTIAL';
    geofenceOverride?: boolean;
  },
) {
  const isManager = role === 'MANAGER' || role === 'ADMIN';
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, organizationId, ...(isManager ? {} : { userId }) },
  });
  if (!existing) return null;

  const settings = await getOrgSettings(organizationId);
  const radiusM = settings.checkInRadiusMeters ?? DEFAULT_CHECK_IN_RADIUS_METERS;
  const allowOverride = isManager && input.geofenceOverride === true;

  if (
    existing.meetingLat != null &&
    existing.meetingLng != null &&
    input.lat != null &&
    input.lng != null &&
    !allowOverride
  ) {
    const distanceM = haversineDistanceMeters(
      input.lat,
      input.lng,
      existing.meetingLat,
      existing.meetingLng,
    );
    if (distanceM > radiusM) {
      throw new GeofenceCheckInError(distanceM, radiusM);
    }
  }

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
      checkInLat: input.lat,
      checkInLng: input.lng,
      geofenceOverride: allowOverride,
      attendanceStatus: status ?? 'ON_TIME',
    },
    include: eventInclude,
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
    include: eventInclude,
  });
}
