import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export type AttendanceReportRow = {
  id: string;
  title: string;
  startAt: string;
  userName: string;
  leadName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  attendanceStatus: string | null;
  geofenceOverride: boolean;
  checkInDistanceM: number | null;
};

export type AttendanceReport = {
  dateFrom: string;
  dateTo: string;
  summary: {
    totalMeetings: number;
    checkedIn: number;
    checkedOut: number;
    onTime: number;
    late: number;
    noShow: number;
    partial: number;
    geofenceOverride: number;
    missingCheckIn: number;
  };
  rows: AttendanceReportRow[];
};

type DateRange = { dateFrom: Date; dateTo: Date };

function distanceM(
  checkInLat: number | null,
  checkInLng: number | null,
  meetingLat: number | null,
  meetingLng: number | null,
): number | null {
  if (
    checkInLat == null ||
    checkInLng == null ||
    meetingLat == null ||
    meetingLng == null
  ) {
    return null;
  }
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(meetingLat - checkInLat);
  const dLng = toRad(meetingLng - checkInLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(checkInLat)) * Math.cos(toRad(meetingLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export async function loadAttendanceReport(
  organizationId: string,
  range: DateRange,
  teamId?: string,
): Promise<AttendanceReport | null> {
  if (teamId) {
    const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
    if (!team) return null;
  }

  const where: Prisma.CalendarEventWhereInput = {
    organizationId,
    startAt: { gte: range.dateFrom, lte: range.dateTo },
    ...(teamId ? { user: { teamId } } : {}),
  };

  const events = await prisma.calendarEvent.findMany({
    where,
    include: {
      user: { select: { name: true } },
      lead: { select: { name: true } },
    },
    orderBy: { startAt: 'desc' },
  });

  const rows: AttendanceReportRow[] = events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    startAt: ev.startAt.toISOString(),
    userName: ev.user.name,
    leadName: ev.lead?.name ?? null,
    checkInAt: ev.checkInAt?.toISOString() ?? null,
    checkOutAt: ev.checkOutAt?.toISOString() ?? null,
    attendanceStatus: ev.attendanceStatus,
    geofenceOverride: ev.geofenceOverride,
    checkInDistanceM: distanceM(ev.checkInLat, ev.checkInLng, ev.meetingLat, ev.meetingLng),
  }));

  const now = Date.now();
  const summary = {
    totalMeetings: events.length,
    checkedIn: events.filter((e) => e.checkInAt).length,
    checkedOut: events.filter((e) => e.checkOutAt).length,
    onTime: events.filter((e) => e.attendanceStatus === 'ON_TIME').length,
    late: events.filter((e) => e.attendanceStatus === 'LATE').length,
    noShow: events.filter((e) => e.attendanceStatus === 'NO_SHOW').length,
    partial: events.filter((e) => e.attendanceStatus === 'PARTIAL').length,
    geofenceOverride: events.filter((e) => e.geofenceOverride).length,
    missingCheckIn: events.filter((e) => !e.checkInAt && e.startAt.getTime() < now).length,
  };

  return {
    dateFrom: range.dateFrom.toISOString(),
    dateTo: range.dateTo.toISOString(),
    summary,
    rows,
  };
}
