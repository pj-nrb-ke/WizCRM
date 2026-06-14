import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type StageData = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: StageData[];
  title?: string;
};

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: 'none',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: '0.82rem',
  padding: '8px 12px',
  boxShadow: '0 4px 16px rgba(15,23,42,0.25)',
};

export function StageBreakdownChart({ data, title }: Props) {
  const filtered = data.filter((d) => d.value > 0);
  const hasData = filtered.length > 0;

  return (
    <div className="stage-funnel-card">
      <div className="stage-funnel-header">
        <h3 className="stage-funnel-title">{title ?? 'Pipeline stage breakdown'}</h3>
      </div>
      <div className="stage-funnel-body">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart
              data={data}
              margin={{ top: 4, right: 8, left: -24, bottom: 0 }}
              barCategoryGap="28%"
            >
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                formatter={(val) => [typeof val === 'number' ? val.toLocaleString() : String(val ?? 0), 'Leads']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {data.map((entry) => (
                  <Cell key={entry.label} fill={entry.color} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            No pipeline data yet
          </div>
        )}
      </div>
    </div>
  );
}
