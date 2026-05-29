import { TrendingUp, Circle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

type OrgStats = {
  open: number;
  won: number;
  stale: number;
  overdue: number;
};

type Props = {
  stats: OrgStats;
  onOpen?: () => void;
  onWon?: () => void;
  onStale?: () => void;
  onOverdue?: () => void;
};

export function OrgSnapshotCard({ stats, onOpen, onWon, onStale, onOverdue }: Props) {
  const total = stats.won + stats.open;
  const winRate = total > 0 ? Math.round((stats.won / total) * 100) : 0;

  return (
    <div
      className="rounded-2xl border p-6 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f8f9ff 0%, #eef2ff 60%, #f0fdf4 100%)',
        borderColor: 'rgba(99, 102, 241, 0.2)',
        boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
      }}
    >
      {/* decorative blob */}
      <div
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'rgba(99, 102, 241, 0.06)' }}
      />

      {/* header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-700 text-slate-700">Organisation Snapshot</h3>
          <p className="text-xs text-slate-400">Live pipeline across all teams</p>
        </div>
        <Link
          to="/reports"
          className="text-xs font-600 text-indigo-600 no-underline hover:text-indigo-700 hover:no-underline"
        >
          Full reports →
        </Link>
      </div>

      {/* win rate featured metric */}
      <div
        className="rounded-xl p-4 mb-4 flex items-center gap-4"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #7c3aed 100%)',
          boxShadow: '0 4px 20px rgba(79, 70, 229, 0.25)',
        }}
      >
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        >
          <TrendingUp size={22} strokeWidth={2} color="#fff" />
        </div>
        <div>
          <div className="text-3xl font-800 text-white leading-none tracking-tight">{winRate}%</div>
          <div className="text-xs text-white/70 mt-1 font-500">Win rate</div>
          <div className="text-xs text-white/50 mt-0.5">{stats.won} won · {stats.open} open</div>
        </div>
      </div>

      {/* 4 metric tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          label="Open Leads"
          value={stats.open}
          icon={Circle}
          color="#6366f1"
          bg="#eef2ff"
          onClick={onOpen}
        />
        <MetricTile
          label="Won"
          value={stats.won}
          icon={CheckCircle2}
          color="#059669"
          bg="#ecfdf5"
          onClick={onWon}
        />
        <MetricTile
          label="Stale Leads"
          value={stats.stale}
          icon={AlertTriangle}
          color="#d97706"
          bg="#fffbeb"
          onClick={onStale}
          warn
        />
        <MetricTile
          label="Overdue Tasks"
          value={stats.overdue}
          icon={Clock}
          color="#dc2626"
          bg="#fef2f2"
          onClick={onOverdue}
          warn={stats.overdue > 0}
        />
      </div>
    </div>
  );
}

function MetricTile({
  label, value, icon: Icon, color, bg, onClick, warn,
}: {
  label: string;
  value: number;
  icon: typeof Circle;
  color: string;
  bg: string;
  onClick?: () => void;
  warn?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'flex items-center gap-2.5 rounded-xl border bg-white p-3 text-left transition-all',
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md font-inherit' : '',
        warn && value > 0 ? 'border-amber-200' : 'border-slate-100',
      ].join(' ')}
      style={{ color: 'inherit' }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: bg, color }}
      >
        <Icon size={14} strokeWidth={2} />
      </div>
      <div>
        <div className="text-lg font-700 text-slate-700 leading-none tracking-tight">{value.toLocaleString()}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
      </div>
    </Tag>
  );
}
