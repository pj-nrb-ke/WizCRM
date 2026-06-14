import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { LiveIndicator } from './LiveIndicator';

export type ActivityItem = {
  id: string;
  userName: string;
  leadName: string;
  type: string;
  summary: string;
  detail?: string;
  createdAt: string;
};

type Props = {
  items: ActivityItem[];
  loading?: boolean;
};

const TYPE_CONFIG: Record<string, { color: string; short: string }> = {
  CALL:         { color: '#6366f1', short: 'CL' },
  EMAIL:        { color: '#0ea5e9', short: 'EM' },
  MEETING:      { color: '#10b981', short: 'MT' },
  NOTE:         { color: '#f59e0b', short: 'NT' },
  TASK:         { color: '#8b5cf6', short: 'TK' },
  SMS:          { color: '#ec4899', short: 'SM' },
  STAGE_CHANGE: { color: '#06b6d4', short: 'SC' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function ActivityTimeline({ items, loading }: Props) {
  const [expanded, setExpanded] = useState(false);
  const PAGE = 7;
  const visible = expanded ? items : items.slice(0, PAGE);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Activity size={15} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-700 text-slate-800 tracking-tight">Activity Stream</h3>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Team actions</p>
          </div>
        </div>
        {items.length > 0 && !loading && (
          <LiveIndicator color="#10b981" size={6} label="Live" />
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-2.5 items-center">
              <div className="h-7 w-7 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
                <div className="h-2 bg-slate-100 rounded animate-pulse w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          No recent activity. Start logging calls, emails, and meetings.
        </div>
      ) : (
        <>
          <ul className="flex flex-col relative" style={{ gap: 0 }}>
            {/* vertical timeline line */}
            <div className="absolute left-[13px] top-2 bottom-2 w-px" style={{ background: 'rgba(226,232,240,0.8)', zIndex: 0 }} />

            {visible.map((item) => {
              const cfg = TYPE_CONFIG[item.type] ?? { color: '#94a3b8', short: '??' };
              return (
                <li key={item.id} className="flex gap-2.5 pb-3 relative group" style={{ zIndex: 1 }}>
                  {/* avatar dot */}
                  <div
                    className="flex-shrink-0 h-[26px] w-[26px] rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-800 mt-0.5 transition-transform duration-150 group-hover:scale-110"
                    style={{ background: cfg.color, boxShadow: `0 0 0 2px ${cfg.color}22` }}
                  >
                    {item.userName.charAt(0).toUpperCase()}
                  </div>

                  {/* content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className="text-xs font-700 text-slate-700">{item.userName}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-800 uppercase tracking-wide text-white"
                        style={{ background: cfg.color }}
                      >
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-indigo-500 font-500 truncate max-w-[120px]">{item.leadName}</span>
                      <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{timeAgo(item.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 m-0 leading-relaxed truncate">{item.summary}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {items.length > PAGE && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-600 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {expanded ? (
                <><ChevronUp size={12} /> Show less</>
              ) : (
                <><ChevronDown size={12} /> {items.length - PAGE} more</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
