import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

type FunnelStage = {
  stage: string;
  count: number;
  color: string;
};

type Props = {
  data: FunnelStage[];
  title?: string;
};

const CustomBarTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(99,102,241,0.2)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="font-700 text-slate-200 mb-1">{d.payload.stage}</div>
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-sm inline-block" style={{ background: d.payload.color }} />
        <span className="text-slate-400">Leads:</span>
        <span className="font-700 text-white">{d.value}</span>
      </div>
    </div>
  );
};

export function SalesFunnelChart({ data, title = 'Pipeline Stages' }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)]"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-sm font-700 text-slate-800 tracking-tight">{title}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">Lead count by stage</p>
        </div>
        {total > 0 && (
          <span
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-700"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
          >
            {total} total
          </span>
        )}
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
            <defs>
              {data.map((d, i) => (
                <linearGradient key={i} id={`barGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={d.color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={d.color} stopOpacity={0.6} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="stage"
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
            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
            <Bar dataKey="count" radius={[5, 5, 0, 0]} animationDuration={1000} animationEasing="ease-out">
              {data.map((_entry, i) => (
                <Cell key={i} fill={`url(#barGrad-${i})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* mini legend */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
        {data.map((d) => (
          <span key={d.stage} className="flex items-center gap-1 text-[11px]">
            <span className="h-2 w-2 rounded-sm inline-block flex-shrink-0" style={{ background: d.color }} />
            <span className="text-slate-500">{d.stage}</span>
            <span className="font-700 text-slate-600">{d.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal conversion funnel bars */
export function ConversionFunnelPanel({
  rows,
  title = 'Conversion Funnel',
}: {
  rows: { stage: string; count: number; pct: number }[];
  title?: string;
}) {
  const colors = ['#6366f1', '#818cf8', '#0ea5e9', '#22c55e', '#f59e0b'];

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)]"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
    >
      <div className="mb-3">
        <h3 className="text-sm font-700 text-slate-800 tracking-tight">{title}</h3>
        <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">Leads progressing through stages</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">No funnel data available</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <li key={row.stage} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-600 text-slate-600">{row.stage}</span>
                <div className="flex items-center gap-2">
                  <span className="font-700 text-slate-700">{row.count}</span>
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-700"
                    style={{ background: `${colors[i % colors.length]}18`, color: colors[i % colors.length] }}
                  >
                    {row.pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(row.pct, 100)}%`,
                    background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[(i + 1) % colors.length]})`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
