import { Link } from 'react-router-dom';
import { Calendar, Clock, ChevronRight, Video } from 'lucide-react';

export type MeetingEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  leadName?: string;
};

type Props = {
  events: MeetingEvent[];
  loading?: boolean;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function UpcomingMeetings({ events, loading }: Props) {
  const sorted = [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Calendar size={17} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-700 text-slate-700">Upcoming Meetings</h3>
            <p className="text-xs text-slate-400">Next 7 days</p>
          </div>
        </div>
        <Link
          to="/calendar"
          className="flex items-center gap-1 text-xs font-600 text-sky-600 no-underline hover:text-sky-700 hover:no-underline"
        >
          Calendar <ChevronRight size={13} strokeWidth={2.5} />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <Calendar size={18} className="text-slate-400" />
          </div>
          <p className="text-sm text-slate-400">No meetings scheduled</p>
          <Link to="/calendar" className="mt-1.5 block text-xs font-600 text-sky-600 no-underline hover:no-underline">
            Schedule one →
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.slice(0, 5).map((event, i) => {
            const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899'];
            const color = colors[i % colors.length];
            return (
              <li
                key={event.id}
                className="flex gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:border-slate-200 hover:bg-slate-50/60"
              >
                <div
                  className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{ background: `${color}15`, color }}
                >
                  <Video size={15} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-600 text-slate-700 truncate">{event.title}</div>
                  {event.leadName && (
                    <div className="text-xs text-slate-400 truncate">{event.leadName}</div>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={10} strokeWidth={2} />
                    <span className="font-500" style={{ color }}>
                      {formatDate(event.startAt)}
                    </span>
                    <span>{formatTime(event.startAt)} – {formatTime(event.endAt)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
