import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { DeltaBadge } from './DeltaBadge';

type DataPoint = { label: string; activities: number; won: number };

type Props = {
  data: DataPoint[];
  title?: string;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-xs"
      style={{
        background: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(99,102,241,0.25)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="font-700 text-slate-200 mb-2 text-[11px] uppercase tracking-wide">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-slate-400">{p.name}</span>
          <span className="font-700 text-white ml-auto pl-4">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function computeDelta(data: DataPoint[], key: 'activities' | 'won'): number {
  if (data.length < 2) return 0;
  const half = Math.floor(data.length / 2);
  const first = data.slice(0, half).reduce((s, d) => s + d[key], 0);
  const second = data.slice(half).reduce((s, d) => s + d[key], 0);
  if (first === 0) return second > 0 ? 100 : 0;
  return Math.round(((second - first) / first) * 100);
}

export function RevenueTrendChart({ data, title = 'Activity Trend' }: Props) {
  const actDelta = computeDelta(data, 'activities');
  const wonDelta = computeDelta(data, 'won');
  const maxAct = Math.max(...data.map((d) => d.activities), 1);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)]"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-700 text-slate-800 tracking-tight">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">30-day rolling window</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: '#6366f1' }} />
              <span className="text-[11px] text-slate-500 font-500">Activities</span>
              <DeltaBadge delta={actDelta} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: '#10b981' }} />
              <span className="text-[11px] text-slate-500 font-500">Won</span>
              <DeltaBadge delta={wonDelta} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                <stop offset="60%" stopColor="#6366f1" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradWon" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="60%" stopColor="#10b981" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(148,163,184,0.15)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine
              y={Math.round(maxAct / 2)}
              stroke="rgba(148,163,184,0.1)"
              strokeDasharray="4 4"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(99,102,241,0.15)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="activities"
              name="Activities"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gradAct)"
              dot={false}
              animationDuration={1200}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="won"
              name="Won"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradWon)"
              dot={false}
              animationDuration={1400}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* trend summary bar */}
      <div className="mt-2 flex items-center gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[11px]">
          {actDelta >= 0
            ? <TrendingUp size={12} className="text-emerald-500" />
            : <TrendingDown size={12} className="text-red-400" />}
          <span className="text-slate-400">
            Activity {actDelta >= 0 ? 'up' : 'down'} <span className="font-700 text-slate-600">{Math.abs(actDelta)}%</span> vs prior period
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[11px]">
          {wonDelta >= 0
            ? <TrendingUp size={12} className="text-emerald-500" />
            : <TrendingDown size={12} className="text-red-400" />}
          <span className="text-slate-400">
            Won deals {wonDelta >= 0 ? '+' : ''}{wonDelta}%
          </span>
        </div>
      </div>
    </div>
  );
}
