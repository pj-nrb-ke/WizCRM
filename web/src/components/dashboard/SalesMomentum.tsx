import { TrendingUp, Flame } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { DeltaBadge } from './DeltaBadge';

type DataPoint = { label: string; activities: number; won: number };

type Props = {
  trendData: DataPoint[];
  totalActivities: number;
  wonThisPeriod: number;
};

function computeMomentum(data: DataPoint[]): number {
  if (data.length < 3) return 50;
  const recent = data.slice(-3).reduce((s, d) => s + d.activities + d.won * 3, 0);
  const prior = data.slice(0, Math.floor(data.length / 2)).reduce((s, d) => s + d.activities + d.won * 3, 0);
  if (prior === 0) return recent > 0 ? 75 : 50;
  return Math.min(100, Math.round((recent / (prior / (data.length / 2) * 3)) * 50));
}

export function SalesMomentum({ trendData, totalActivities, wonThisPeriod }: Props) {
  const momentum = computeMomentum(trendData);
  const isHot = momentum >= 65;
  const warmColor = isHot ? '#f59e0b' : '#6366f1';

  const delta = trendData.length >= 2
    ? (() => {
        const half = Math.floor(trendData.length / 2);
        const first = trendData.slice(0, half).reduce((s, d) => s + d.activities, 0);
        const second = trendData.slice(half).reduce((s, d) => s + d.activities, 0);
        if (first === 0) return 0;
        return Math.round(((second - first) / first) * 100);
      })()
    : 0;

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)]"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{
              background: isHot ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.1)',
              color: warmColor,
            }}
          >
            {isHot ? <Flame size={15} strokeWidth={2} /> : <TrendingUp size={15} strokeWidth={2} />}
          </div>
          <div>
            <h3 className="text-sm font-700 text-slate-800 tracking-tight">Sales Momentum</h3>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">Weekly activity trend</p>
          </div>
        </div>
        <DeltaBadge delta={delta} size="sm" />
      </div>

      {/* momentum gauge */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${momentum}%`,
              background: `linear-gradient(90deg, #6366f1, ${warmColor})`,
            }}
          />
        </div>
        <span className="text-sm font-800 tabular-nums" style={{ color: warmColor }}>{momentum}</span>
        <span className="text-[11px] font-600 text-slate-400">/ 100</span>
      </div>

      {/* mini bar chart */}
      <div style={{ height: 56 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="18%">
            <Bar dataKey="activities" radius={[3, 3, 0, 0]}>
              {trendData.map((_, i) => {
                const isRecent = i >= trendData.length - 3;
                return (
                  <Cell
                    key={i}
                    fill={isRecent ? warmColor : 'rgba(148,163,184,0.25)'}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* bottom stats */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
        <span className="text-slate-400">
          <span className="font-700 text-slate-600">{totalActivities}</span> activities this period
        </span>
        <span className="text-slate-400">
          <span className="font-700 text-emerald-600">{wonThisPeriod}</span> deals won
        </span>
      </div>
    </div>
  );
}
