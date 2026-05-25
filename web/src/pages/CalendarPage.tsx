import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

type CalendarEvent = {
  id: string;
  title: string;
  notes: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  recurrence: string;
  reminderMinutes: number | null;
  user: { id: string; name: string };
  lead: { id: string; name: string; company: string | null } | null;
};

type ViewMode = 'day' | 'week' | 'month';

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week');
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const range = useMemo(() => {
    if (view === 'day') {
      const from = new Date(cursor);
      from.setHours(0, 0, 0, 0);
      const to = new Date(cursor);
      to.setHours(23, 59, 59, 999);
      return { from, to, days: [from] };
    }
    if (view === 'month') {
      const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const days: Date[] = [];
      const pad = from.getDay();
      const start = addDays(from, -pad);
      for (let i = 0; i < 42; i++) days.push(addDays(start, i));
      return { from, to, days };
    }
    const from = startOfWeek(cursor);
    const to = addDays(from, 6);
    to.setHours(23, 59, 59, 999);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) days.push(addDays(from, i));
    return { from, to, days };
  }, [view, cursor]);

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

  function eventsOnDay(day: Date) {
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return events.filter((e) => {
      const es = new Date(e.startAt);
      const ee = new Date(e.endAt);
      return es <= end && ee >= start;
    });
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
    setStartAt(toLocalInput(start));
    setEndAt(toLocalInput(end));
    setAllDay(false);
    setModalOpen(true);
  }

  function openNewEvent() {
    openNewForDay(cursor);
  }

  function openEditEvent(ev: CalendarEvent) {
    setEditingId(ev.id);
    setTitle(ev.title);
    setNotes(ev.notes ?? '');
    setStartAt(toLocalInput(new Date(ev.startAt)));
    setEndAt(toLocalInput(new Date(ev.endAt)));
    setAllDay(ev.allDay);
    setModalOpen(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      allDay,
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
        subtitle="Click a day to add an event, or click an event to edit. Day, week, and month views."
        actions={
          <button type="button" className="btn-primary" onClick={openNewEvent}>
            Add event
          </button>
        }
      />

      <div className="calendar-toolbar">
        <div className="calendar-view-tabs">
          {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
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
            onClick={() => setCursor(addDays(cursor, view === 'month' ? -30 : view === 'week' ? -7 : -1))}
          >
            ←
          </button>
          <input
            type="date"
            value={isoDate(cursor)}
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
            onClick={() => setCursor(addDays(cursor, view === 'month' ? 30 : view === 'week' ? 7 : 1))}
          >
            →
          </button>
        </div>
      </div>

      {error && !modalOpen ? <div className="alert alert-error">{error}</div> : null}
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
                    <span className="calendar-event-title">{ev.title}</span>
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
              <div className="form-actions calendar-form-actions">
                {editingId ? (
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
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : 'Save event'}
                  </button>
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
