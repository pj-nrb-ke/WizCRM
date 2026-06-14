import { CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';

export type TaskItem = {
  id: string;
  title?: string;
  dueAt: string | null;
  completedAt?: string | null;
  leadName?: string;
};

type Props = {
  tasks: TaskItem[];
  loading?: boolean;
};

function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

function isDueToday(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const d = new Date(dueAt);
  const t = new Date();
  return d.toDateString() === t.toDateString();
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No due date';
  const d = new Date(dueAt);
  if (isDueToday(dueAt)) return 'Due today';
  if (isOverdue(dueAt)) {
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    return `${days}d overdue`;
  }
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function TasksPriorityWidget({ tasks, loading }: Props) {
  const open = tasks.filter((t) => !t.completedAt);
  const overdue = open.filter((t) => isOverdue(t.dueAt));
  const dueToday = open.filter((t) => isDueToday(t.dueAt));
  const upcoming = open.filter((t) => t.dueAt && !isOverdue(t.dueAt) && !isDueToday(t.dueAt));

  const sorted = [...overdue, ...dueToday, ...upcoming, ...open.filter((t) => !t.dueAt)];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <CheckCircle2 size={17} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-700 text-slate-700">Priority Tasks</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {overdue.length > 0 && (
                <span className="text-[11px] font-600 text-red-500">
                  {overdue.length} overdue
                </span>
              )}
              {dueToday.length > 0 && (
                <span className="text-[11px] font-600 text-amber-500">
                  {dueToday.length} today
                </span>
              )}
              {overdue.length === 0 && dueToday.length === 0 && (
                <span className="text-xs text-slate-400">{open.length} open</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <p className="text-sm text-slate-400">All clear! No pending tasks.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.slice(0, 6).map((task) => {
            const over = isOverdue(task.dueAt);
            const today = isDueToday(task.dueAt);
            return (
              <li
                key={task.id}
                className={`flex gap-3 rounded-xl border p-3 transition-colors ${
                  over
                    ? 'border-red-100 bg-red-50/40 hover:bg-red-50/60'
                    : today
                    ? 'border-amber-100 bg-amber-50/30 hover:bg-amber-50/50'
                    : 'border-slate-100 bg-slate-50/40 hover:bg-slate-50/80'
                }`}
              >
                <div className={`flex-shrink-0 mt-0.5 ${over ? 'text-red-400' : today ? 'text-amber-400' : 'text-slate-300'}`}>
                  {over ? <AlertTriangle size={14} strokeWidth={2} /> : <Circle size={14} strokeWidth={2} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-600 text-slate-700 truncate">
                    {task.title ?? 'Follow up'}
                  </div>
                  {task.leadName && (
                    <div className="text-xs text-slate-400 truncate">{task.leadName}</div>
                  )}
                  <div className={`mt-0.5 flex items-center gap-1 text-[11px] font-500 ${over ? 'text-red-500' : today ? 'text-amber-500' : 'text-slate-400'}`}>
                    <Clock size={10} strokeWidth={2} />
                    {formatDue(task.dueAt)}
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
