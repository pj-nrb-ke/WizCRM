import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import {
  allDayInputEnd,
  allDayInputStart,
  buildCalendarRange,
  buildEventIsoRange,
  findConflictingEventIds,
  formatDateInputLocal,
  getEventsOnDay,
  shiftCalendarCursor,
  toLocalDateTimeInput,
  type CalendarViewMode,
} from '../lib/calendar';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../lib/auth';

const EVENT_TYPES = ['MEETING', 'DEMO', 'EXPO', 'PRESENTATION', 'CONFERENCE_CALL', 'CALL', 'OTHER'] as const;
const EVENT_TYPE_LABELS: Record<string, string> = {
  MEETING: 'Meeting', DEMO: 'Demo', EXPO: 'Expo', PRESENTATION: 'Online presentation',
  CONFERENCE_CALL: 'Conference call', CALL: 'Call', OTHER: 'Other',
};
const MEETING_MODES = ['IN_PERSON', 'ZOOM', 'TEAMS', 'GOOGLE_MEET', 'PHONE', 'WHATSAPP', 'OTHER'] as const;
const MEETING_MODE_LABELS: Record<string, string> = {
  IN_PERSON: 'In person', ZOOM: 'Zoom', TEAMS: 'Microsoft Teams', GOOGLE_MEET: 'Google Meet',
  PHONE: 'Phone', WHATSAPP: 'WhatsApp', OTHER: 'Other',
};
const MODE_ICON: Record<string, string> = {
  IN_PERSON: '📍', ZOOM: '🎥', TEAMS: '💻', GOOGLE_MEET: '📹', PHONE: '📞', WHATSAPP: '💬', OTHER: '🔗',
};
const RSVP_LABELS: Record<string, string> = {
  INVITED: 'No reply yet', ACCEPTED: 'Going', DECLINED: 'Not going', TENTATIVE: 'Maybe',
};
const RSVP_ICON: Record<string, string> = {
  INVITED: '·', ACCEPTED: '✓', DECLINED: '✕', TENTATIVE: '?',
};

type OrgUser = { id: string; name: string; email: string; role: string; team: { name: string } | null };

type BusyBlock = { eventId: string; startAt: string; endAt: string; allDay: boolean; title: string };
type UserAvailability = { userId: string; name: string; busy: BusyBlock[] };

type Attendee = {
  userId: string;
  status: string;
  respondedAt: string | null;
  user: { id: string; name: string; email: string };
};

type CalendarEvent = {
  id: string;
  title: string;
  notes: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  recurrence: string;
  reminderMinutes: number | null;
  meetingAddress: string | null;
  meetingLat: number | null;
  meetingLng: number | null;
  eventType: string;
  meetingMode: string;
  meetingUrl: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  attendanceStatus: string | null;
  user: { id: string; name: string };
  lead: { id: string; name: string; company: string | null } | null;
  attendees: Attendee[];
};

export function CalendarPage() {
  const { user } = useAuth();
  const meId = user?.id ?? '';
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';
  const [view, setView] = useState<CalendarViewMode>('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [meetingAddress, setMeetingAddress] = useState('');
  const [meetingLat, setMeetingLat] = useState('');
  const [meetingLng, setMeetingLng] = useState('');
  const [eventType, setEventType] = useState('MEETING');
  const [meetingMode, setMeetingMode] = useState('IN_PERSON');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [checkInAt, setCheckInAt] = useState<string | null>(null);
  const [checkOutAt, setCheckOutAt] = useState<string | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [organiser, setOrganiser] = useState<{ id: string; name: string } | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [rsvping, setRsvping] = useState(false);
  const [availability, setAvailability] = useState<UserAvailability[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  /** The organiser (or a manager) owns the event; an invitee can only RSVP. */
  const isOrganiser = !editingId || organiser?.id === meId || (!!organiser && isManager);
  const myInvite = attendees.find((a) => a.userId === meId) ?? null;

  const busyByUser = useMemo(() => {
    const m = new Map<string, BusyBlock[]>();
    for (const row of availability) m.set(row.userId, row.busy);
    return m;
  }, [availability]);

  /** People you have ticked who already have something else in this slot. */
  const busyInvitees = useMemo(
    () => availability.filter((a) => attendeeIds.includes(a.userId) && a.busy.length > 0),
    [availability, attendeeIds],
  );

  /** What *you* already have in the slot the form is currently pointing at. */
  const myClashes = useMemo(
    () => availability.find((a) => a.userId === meId)?.busy ?? [],
    [availability, meId],
  );

  /**
   * Events on the grid that clash with another of your own. A manager's list
   * includes the whole team, so narrow it to what this person actually attends
   * before looking for overlaps.
   */
  const conflictIds = useMemo(() => {
    const mine = events.filter(
      (ev) =>
        ev.user.id === meId ||
        ev.attendees?.some((a) => a.userId === meId && a.status !== 'DECLINED'),
    );
    return findConflictingEventIds(mine);
  }, [events, meId]);

  const range = useMemo(() => buildCalendarRange(view, cursor), [view, cursor]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      view,
    });
    api<{ events: CalendarEvent[] }>(`/calendar/events?${params}`)
      .then((d) => setEvents(d.events ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load calendar'))
      .finally(() => setLoading(false));
  }, [range.from.toISOString(), range.to.toISOString(), view]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ users: OrgUser[] }>('/calendar/org-users')
      .then((d) => setOrgUsers(d.users ?? []))
      .catch(() => setOrgUsers([]));
  }, []);

  // Ask who is busy for the slot currently in the form. Debounced, because the
  // datetime inputs fire on every keystroke.
  useEffect(() => {
    if (!modalOpen || !startAt || !endAt) {
      setAvailability([]);
      return;
    }
    const iso = buildEventIsoRange(startAt, endAt, allDay);
    if (!iso.startAt || !iso.endAt || new Date(iso.endAt) <= new Date(iso.startAt)) {
      setAvailability([]);
      return;
    }
    let cancelled = false;
    setCheckingAvailability(true);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ from: iso.startAt, to: iso.endAt });
      // An event being rescheduled must not be reported as clashing with itself.
      if (editingId) params.set('excludeEventId', editingId);
      api<{ availability: UserAvailability[] }>(`/calendar/availability?${params}`)
        .then((d) => {
          if (!cancelled) setAvailability(d.availability ?? []);
        })
        .catch(() => {
          if (!cancelled) setAvailability([]);
        })
        .finally(() => {
          if (!cancelled) setCheckingAvailability(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [modalOpen, startAt, endAt, allDay, editingId]);

  function eventsOnDay(day: Date) {
    const src = typeFilter === 'ALL' ? events : events.filter((e) => e.eventType === typeFilter);
    return getEventsOnDay(src, day);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setError('');
  }

  function openNewForDay(day: Date) {
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(day);
    end.setHours(10, 0, 0, 0);
    setEditingId(null);
    setTitle('');
    setNotes('');
    setStartAt(toLocalDateTimeInput(start));
    setEndAt(toLocalDateTimeInput(end));
    setAllDay(false);
    setMeetingAddress('');
    setMeetingLat('');
    setMeetingLng('');
    setEventType('MEETING');
    setMeetingMode('IN_PERSON');
    setMeetingUrl('');
    setCheckInAt(null);
    setCheckOutAt(null);
    setAttendanceStatus(null);
    setAttendeeIds([]);
    setAttendees([]);
    setOrganiser(null);
    setModalOpen(true);
  }

  function openNewEvent() {
    openNewForDay(cursor);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingId(ev.id);
    setTitle(ev.title);
    setNotes(ev.notes ?? '');
    setStartAt(ev.allDay ? allDayInputStart(ev.startAt) : toLocalDateTimeInput(new Date(ev.startAt)));
    setEndAt(ev.allDay ? allDayInputEnd(ev.endAt) : toLocalDateTimeInput(new Date(ev.endAt)));
    setAllDay(ev.allDay);
    setMeetingAddress(ev.meetingAddress ?? '');
    setMeetingLat(ev.meetingLat != null ? String(ev.meetingLat) : '');
    setMeetingLng(ev.meetingLng != null ? String(ev.meetingLng) : '');
    setEventType(ev.eventType ?? 'MEETING');
    setMeetingMode(ev.meetingMode ?? 'IN_PERSON');
    setMeetingUrl(ev.meetingUrl ?? '');
    setCheckInAt(ev.checkInAt);
    setCheckOutAt(ev.checkOutAt);
    setAttendanceStatus(ev.attendanceStatus);
    setAttendees(ev.attendees ?? []);
    setAttendeeIds((ev.attendees ?? []).map((a) => a.userId));
    setOrganiser(ev.user);
    setModalOpen(true);
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function respond(status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') {
    if (!editingId) return;
    setRsvping(true);
    setError('');
    try {
      const res = await api<{ event: CalendarEvent }>(`/calendar/events/${editingId}/rsvp`, {
        method: 'POST',
        body: { status },
      });
      setAttendees(res.event.attendees ?? []);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your reply');
    } finally {
      setRsvping(false);
    }
  }

  /** Spell out the clash, then let the organiser overrule it — never block the save. */
  function confirmDespiteClash(): boolean {
    if (allDay || (myClashes.length === 0 && busyInvitees.length === 0)) return true;
    const lines: string[] = [];
    if (myClashes.length) {
      lines.push(`You already have: ${myClashes.map(busyLabel).join('; ')}`);
    }
    if (busyInvitees.length) {
      lines.push(
        `Already booked: ${busyInvitees
          .map((a) => `${a.name} (${a.busy.map(busyLabel).join('; ')})`)
          .join('\n')}`,
      );
    }
    return window.confirm(`${lines.join('\n\n')}\n\nBook this event anyway?`);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const isoRange = buildEventIsoRange(startAt, endAt, allDay);
    if (!allDay && isoRange.endAt && new Date(isoRange.endAt) <= new Date(isoRange.startAt)) {
      setError('End time must be after the start time.');
      return;
    }
    if (!confirmDespiteClash()) return;
    setSaving(true);
    const lat = meetingLat.trim() ? Number(meetingLat) : undefined;
    const lng = meetingLng.trim() ? Number(meetingLng) : undefined;
    const body = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      startAt: isoRange.startAt,
      endAt: isoRange.endAt,
      allDay,
      meetingAddress: meetingAddress.trim() || undefined,
      meetingLat: lat != null && !Number.isNaN(lat) ? lat : undefined,
      meetingLng: lng != null && !Number.isNaN(lng) ? lng : undefined,
      eventType,
      meetingMode,
      meetingUrl: meetingUrl.trim() || undefined,
      attendeeIds,
    };
    try {
      if (editingId) {
        await api(`/calendar/events/${editingId}`, { method: 'PATCH', body });
      } else {
        await api('/calendar/events', { method: 'POST', body });
      }
      closeModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function checkIn() {
    if (!editingId) return;
    setCheckingIn(true);
    setError('');
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      const res = await api<{ event: CalendarEvent }>(`/calendar/events/${editingId}/check-in`, {
        method: 'POST',
        body: { lat, lng },
      });
      setCheckInAt(res.event.checkInAt);
      setAttendanceStatus(res.event.attendanceStatus);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  }

  async function checkOut() {
    if (!editingId) return;
    setCheckingIn(true);
    setError('');
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      if (navigator.geolocation) {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      const res = await api<{ event: CalendarEvent }>(`/calendar/events/${editingId}/check-out`, {
        method: 'POST',
        body: { lat, lng },
      });
      setCheckOutAt(res.event.checkOutAt);
      setAttendanceStatus(res.event.attendanceStatus);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setCheckingIn(false);
    }
  }

  function openMaps() {
    const lat = meetingLat.trim();
    const lng = meetingLng.trim();
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`, '_blank');
      return;
    }
    if (meetingAddress.trim()) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meetingAddress.trim())}`,
        '_blank',
      );
    }
  }

  async function deleteEvent() {
    if (!editingId) return;
    if (!window.confirm('Delete this event?')) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/calendar/events/${editingId}`, { method: 'DELETE' });
      closeModal();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="My calendar"
        subtitle="Schedule meetings, set visit locations, and check in/out for field attendance (Phase 2)."
        actions={
          <button type="button" className="btn-primary" onClick={openNewEvent}>
            Add event
          </button>
        }
      />

      <div className="calendar-toolbar">
        <div className="calendar-view-tabs">
          {(['day', 'week', 'month'] as CalendarViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setView(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="calendar-nav">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCursor(shiftCalendarCursor(cursor, view, -1))}
          >
            ←
          </button>
          <input
            type="date"
            value={formatDateInputLocal(cursor)}
            onChange={(e) => setCursor(new Date(e.target.value + 'T12:00:00'))}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCursor(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCursor(shiftCalendarCursor(cursor, view, 1))}
          >
            →
          </button>
        </div>
      </div>

      <div
        className="calendar-type-filter"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}
      >
        <button
          type="button"
          className={typeFilter === 'ALL' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          onClick={() => setTypeFilter('ALL')}
        >
          All
        </button>
        {EVENT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={typeFilter === t ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => setTypeFilter(t)}
          >
            {EVENT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {error && !modalOpen ? <div className="alert alert-error">{error}</div> : null}
      {conflictIds.size ? (
        <div className="alert alert-error">
          ⚠ {conflictIds.size === 2 ? 'Two of your events clash' : `${conflictIds.size} of your events clash`}{' '}
          in this view. Look for the ⚠ marker.
        </div>
      ) : null}
      {loading ? <p className="muted">Loading calendar…</p> : null}

      <div className={`calendar-grid view-${view}`}>
        {range.days.map((day) => (
          <div
            key={day.toISOString()}
            className={`calendar-day calendar-day-clickable${sameMonth(day, cursor) ? '' : ' calendar-day-outside'}`}
            role="button"
            tabIndex={0}
            onClick={() => openNewForDay(day)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openNewForDay(day);
              }
            }}
            aria-label={`Add event on ${day.toLocaleDateString()}`}
          >
            <div className="calendar-day-head">
              <strong>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>
              <span className="calendar-day-add-hint">+</span>
            </div>
            <ul className="calendar-day-events">
              {eventsOnDay(day).length === 0 && view !== 'month' ? (
                <li className="calendar-day-empty muted">No events — tap to add</li>
              ) : null}
              {eventsOnDay(day).map((ev) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    className="calendar-event-chip"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditEvent(ev);
                    }}
                  >
                    <span className="calendar-event-time">
                      {ev.allDay
                        ? 'All day'
                        : `${fmtTime(ev.startAt)}–${fmtTime(ev.endAt)}`}
                    </span>
                    <span className="calendar-event-title">
                      {conflictIds.has(ev.id) ? (
                        <span title="Clashes with another event in your diary">⚠ </span>
                      ) : null}
                      {ev.meetingMode && ev.meetingMode !== 'IN_PERSON'
                        ? `${MODE_ICON[ev.meetingMode] ?? ''} `
                        : ''}
                      {ev.title}
                    </span>
                    {ev.attendees?.length ? (
                      <span className="calendar-event-lead" title={attendeeSummary(ev)}>
                        👥 {ev.attendees.length + 1}
                        {ev.attendees.some((a) => a.userId === meId && a.status === 'INVITED')
                          ? ' · reply?'
                          : ''}
                      </span>
                    ) : null}
                    {ev.lead ? (
                      <span className="calendar-event-lead">{ev.lead.name}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div className="modal-panel calendar-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Edit event' : 'Add event'}</h2>
            {error && modalOpen ? <div className="alert alert-error">{error}</div> : null}
            <form onSubmit={(e) => void saveEvent(e)}>
              <label>
                Event outline *
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                />
                All day event
              </label>
              <label>
                Start
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </label>
              <label>
                End
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  required
                />
              </label>
              <label>
                Notes
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </label>
              <div className="field-row">
                <label>
                  Type
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  How
                  <select value={meetingMode} onChange={(e) => setMeetingMode(e.target.value)}>
                    {MEETING_MODES.map((m) => (
                      <option key={m} value={m}>
                        {MEETING_MODE_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {meetingMode !== 'IN_PERSON' ? (
                <label>
                  {meetingMode === 'PHONE' ? 'Dial-in number' : 'Join link'}
                  <input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder={meetingMode === 'PHONE' ? '+254…' : 'https://…'}
                  />
                </label>
              ) : null}
              {meetingMode !== 'IN_PERSON' && meetingUrl.trim() ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const u = meetingUrl.trim();
                    if (meetingMode === 'PHONE') window.open(`tel:${u.replace(/\s/g, '')}`);
                    else window.open(u.startsWith('http') ? u : `https://${u}`, '_blank');
                  }}
                >
                  {meetingMode === 'PHONE' ? 'Call now' : 'Open join link'}
                </button>
              ) : null}
              <h3>
                Who's coming
                {attendeeIds.length ? <span className="muted"> · {attendeeIds.length} invited</span> : null}
              </h3>
              <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
                Organised by {organiser && organiser.id !== meId ? organiser.name : 'you'}. Invited
                colleagues see this event on their own calendar and can reply.
                {checkingAvailability ? (
                  <> Checking who's free…</>
                ) : availability.length ? (
                  <>
                    {' '}
                    <strong>
                      {availability.filter((a) => a.busy.length === 0).length} of {availability.length} free
                    </strong>{' '}
                    at this time.
                  </>
                ) : null}
              </p>
              {myClashes.length ? (
                <div className="alert alert-error" style={{ marginBottom: 8 }}>
                  <strong>This clashes with your own diary.</strong> You already have{' '}
                  {myClashes.map(busyLabel).join('; ')}. You can still book it — you'll be asked to
                  confirm.
                </div>
              ) : null}
              {busyInvitees.length ? (
                <div className="alert alert-error" style={{ marginBottom: 8 }}>
                  {busyInvitees.length === 1
                    ? `${busyInvitees[0].name} is already booked at this time.`
                    : `${busyInvitees.map((a) => a.name).join(', ')} are already booked at this time.`}{' '}
                  Pick another slot or invite someone else.
                </div>
              ) : null}
              {isOrganiser ? (
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid var(--border, #ddd)',
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 8,
                  }}
                >
                  {orgUsers.filter((u) => u.id !== (organiser?.id ?? meId)).length === 0 ? (
                    <p className="muted" style={{ margin: 4 }}>
                      No colleagues to invite yet — add them under Users.
                    </p>
                  ) : null}
                  {orgUsers
                    .filter((u) => u.id !== (organiser?.id ?? meId))
                    .map((u) => {
                      const invite = attendees.find((a) => a.userId === u.id);
                      const busy = busyByUser.get(u.id) ?? [];
                      return (
                        <label
                          key={u.id}
                          className="checkbox-row"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
                        >
                          <input
                            type="checkbox"
                            checked={attendeeIds.includes(u.id)}
                            onChange={() => toggleAttendee(u.id)}
                          />
                          <span style={{ flex: 1 }}>
                            {u.name}
                            <span className="muted" style={{ fontSize: '0.8rem' }}>
                              {' '}
                              {u.team?.name ? `· ${u.team.name}` : `· ${u.role.toLowerCase()}`}
                            </span>
                          </span>
                          {busy.length ? (
                            <span
                              style={{ fontSize: '0.8rem', color: 'var(--danger, #b42318)' }}
                              title={busy.map(busyLabel).join('\n')}
                            >
                              ● Busy
                            </span>
                          ) : availability.length ? (
                            <span className="muted" style={{ fontSize: '0.8rem' }}>
                              ○ Free
                            </span>
                          ) : null}
                          {invite ? (
                            <span
                              className="muted"
                              style={{ fontSize: '0.8rem' }}
                              title={RSVP_LABELS[invite.status]}
                            >
                              {RSVP_ICON[invite.status]} {RSVP_LABELS[invite.status]}
                            </span>
                          ) : null}
                        </label>
                      );
                    })}
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 8px' }}>
                  {attendees.map((a) => (
                    <li key={a.userId} className="muted" style={{ fontSize: '0.9rem' }}>
                      {RSVP_ICON[a.status]} {a.user.name} — {RSVP_LABELS[a.status]}
                    </li>
                  ))}
                </ul>
              )}

              {editingId && myInvite ? (
                <div className="calendar-attendance" style={{ marginBottom: 8 }}>
                  <p className="muted" style={{ marginBottom: 6 }}>
                    You were invited by {organiser?.name ?? 'a colleague'} —{' '}
                    <strong>{RSVP_LABELS[myInvite.status]}</strong>
                  </p>
                  <div className="form-actions" style={{ gap: 6 }}>
                    {(['ACCEPTED', 'TENTATIVE', 'DECLINED'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={myInvite.status === s ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                        disabled={rsvping}
                        onClick={() => void respond(s)}
                      >
                        {RSVP_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <h3>Meeting location</h3>
              <label>
                Address
                <input
                  value={meetingAddress}
                  onChange={(e) => setMeetingAddress(e.target.value)}
                  placeholder="Street, city"
                />
              </label>
              <div className="field-row">
                <label>
                  Latitude
                  <input
                    value={meetingLat}
                    onChange={(e) => setMeetingLat(e.target.value)}
                    placeholder="-26.20"
                  />
                </label>
                <label>
                  Longitude
                  <input
                    value={meetingLng}
                    onChange={(e) => setMeetingLng(e.target.value)}
                    placeholder="28.04"
                  />
                </label>
              </div>
              {(meetingAddress.trim() || (meetingLat && meetingLng)) && (
                <button type="button" className="btn-secondary" onClick={openMaps}>
                  Open in Google Maps
                </button>
              )}
              {editingId ? (
                <div className="calendar-attendance">
                  <p className="muted">
                    {checkInAt
                      ? `Checked in ${new Date(checkInAt).toLocaleString()}`
                      : 'Not checked in'}
                    {checkOutAt ? ` · Out ${new Date(checkOutAt).toLocaleString()}` : ''}
                    {attendanceStatus ? ` · ${attendanceStatus}` : ''}
                  </p>
                  <div className="form-actions">
                    {!checkInAt ? (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={checkingIn}
                        onClick={() => void checkIn()}
                      >
                        {checkingIn ? 'Working…' : 'Check in'}
                      </button>
                    ) : !checkOutAt ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={checkingIn}
                        onClick={() => void checkOut()}
                      >
                        {checkingIn ? 'Working…' : 'Check out'}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="form-actions calendar-form-actions">
                {editingId && isOrganiser ? (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => void deleteEvent()}
                    disabled={deleting || saving}
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
                <div className="form-actions-right">
                  <button type="button" className="btn-secondary" onClick={closeModal}>
                    {isOrganiser ? 'Cancel' : 'Close'}
                  </button>
                  {isOrganiser ? (
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save event'}
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function sameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function busyLabel(b: BusyBlock) {
  const when = b.allDay ? 'All day' : `${fmtTime(b.startAt)}–${fmtTime(b.endAt)}`;
  return `${when} · ${b.title}`;
}

function attendeeSummary(ev: CalendarEvent) {
  const going = ev.attendees.filter((a) => a.status === 'ACCEPTED').length;
  const pending = ev.attendees.filter((a) => a.status === 'INVITED').length;
  return `${ev.user.name} (organiser) · ${going} going · ${pending} awaiting reply`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
