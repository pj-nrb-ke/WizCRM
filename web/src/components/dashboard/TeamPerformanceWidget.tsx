import { Link } from 'react-router-dom';
import { Users, TrendingUp, AlertTriangle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import type { TeamOverview } from '../../lib/types';

type Props = {
  teams: TeamOverview[];
  onDrillOpen?: (teamId: string, teamName: string, metric: 'open' | 'stale' | 'won' | 'overdue') => void;
};

function ScoreDot({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="text-xs text-slate-400">{score}%</div>
    </div>
  );
}

export function TeamPerformanceWidget({ teams, onDrillOpen }: Props) {
  if (!teams.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users size={17} strokeWidth={2} />
          </div>
          <h3 className="text-sm font-700 text-slate-700">Team Performance</h3>
        </div>
        <p className="text-center text-sm text-slate-400 py-6">No teams configured yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Users size={17} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-700 text-slate-700">Team Performance</h3>
            <p className="text-xs text-slate-400">Real-time metrics</p>
          </div>
        </div>
        <Link
          to="/teams"
          className="flex items-center gap-1 text-xs font-600 text-indigo-600 no-underline hover:text-indigo-700 hover:no-underline"
        >
          View all <ChevronRight size={13} strokeWidth={2.5} />
        </Link>
      </div>

      {/* team list */}
      <div className="flex flex-col gap-2">
        {teams.slice(0, 5).map((team) => {
          const total = team.stats.openLeads + team.stats.wonLeads;
          const winScore = total > 0 ? Math.round((team.stats.wonLeads / total) * 100) : 0;
          return (
            <div
              key={team.id}
              className="group rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:border-indigo-200 hover:bg-indigo-50/30"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-700 text-white"
                    style={{
                      background: `linear-gradient(135deg, #6366f1, #4f46e5)`,
                    }}
                  >
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-600 text-slate-700 truncate">{team.name}</div>
                    <div className="text-xs text-slate-400">{team.memberCount} rep{team.memberCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <ScoreDot score={winScore} />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 border-none bg-transparent p-0 cursor-pointer font-inherit"
                  onClick={() => onDrillOpen?.(team.id, team.name, 'open')}
                >
                  <TrendingUp size={11} strokeWidth={2} />
                  {team.stats.openLeads} open
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 border-none bg-transparent p-0 cursor-pointer font-inherit"
                  onClick={() => onDrillOpen?.(team.id, team.name, 'won')}
                >
                  <CheckCircle2 size={11} strokeWidth={2} />
                  {team.stats.wonLeads} won
                </button>
                {team.stats.staleLeads > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-600 border-none bg-transparent p-0 cursor-pointer font-inherit"
                    onClick={() => onDrillOpen?.(team.id, team.name, 'stale')}
                  >
                    <AlertTriangle size={11} strokeWidth={2} />
                    {team.stats.staleLeads} stale
                  </button>
                )}
                {team.stats.overdueTasks > 0 && (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-500 border-none bg-transparent p-0 cursor-pointer font-inherit"
                    onClick={() => onDrillOpen?.(team.id, team.name, 'overdue')}
                  >
                    <Clock size={11} strokeWidth={2} />
                    {team.stats.overdueTasks} overdue
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
