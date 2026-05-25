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
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [saving, setSaving] = useState(false);

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

  function openNewEvent() {
    const d = new Date(cursor);
    d.setMinutes(0, 0, 0);
    const end = new Date(d.getTime() + 60 * 60 * 1000);
    setTitle('');
    setNotes('');
    setStartAt(toLocalInput(d));
    setEndAt(toLocalInput(end));
    setAllDay(false);
    setModalOpen(true);
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/calendar/events', {
        method: 'POST',
        body: {
          title,
          notes: notes || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          allDay,
        },
      });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="My calendar"
        subtitle="Day, week, and month views — schedule meetings and link them to leads."
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

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <p className="muted">Loading calendar…</p> : null}

      <div className={`calendar-grid view-${view}`}>
        {range.days.map((day) => (
          <div
            key={day.toISOString()}
            className={`calendar-day${sameMonth(day, cursor) ? '' : ' calendar-day-outside'}`}
          >
            <div className="calendar-day-head">
              <strong>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>
            </div>
            <ul className="calendar-day-events">
              {eventsOnDay(day).map((ev) => (
                <li key={ev.id} className="calendar-event-chip">
                  <span className="calendar-event-time">
                    {ev.allDay
                      ? 'All day'
                      : `${fmtTime(ev.startAt)}–${fmtTime(ev.endAt)}`}
                  </span>
                  <span className="calendar-event-title">{ev.title}</span>
                  {ev.lead ? (
                    <span className="calendar-event-lead">{ev.lead.name}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card calendar-modal">
            <h2>Add event</h2>
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
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save event'}
                </button>
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
