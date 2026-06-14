import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { SectionHeader } from './shared/SectionHeader';
import { GlassPanel } from './shared/GlassPanel';
import { ScrollReveal } from './shared/ScrollReveal';
import { TrendingUp, Award, Activity } from 'lucide-react';

const revenueData = [
  { month: 'Jan', revenue: 820, target: 900 },
  { month: 'Feb', revenue: 940, target: 920 },
  { month: 'Mar', revenue: 880, target: 950 },
  { month: 'Apr', revenue: 1020, target: 980 },
  { month: 'May', revenue: 1180, target: 1000 },
  { month: 'Jun', revenue: 1350, target: 1050 },
  { month: 'Jul', revenue: 1240, target: 1100 },
  { month: 'Aug', revenue: 1420, target: 1150 },
  { month: 'Sep', revenue: 1580, target: 1200 },
  { month: 'Oct', revenue: 1720, target: 1280 },
  { month: 'Nov', revenue: 1650, target: 1350 },
  { month: 'Dec', revenue: 1890, target: 1400 },
];

const stageData = [
  { name: 'Prospect', value: 142, color: '#818cf8' },
  { name: 'Qualified', value: 87, color: '#6366f1' },
  { name: 'Proposal', value: 54, color: '#8b5cf6' },
  { name: 'Closed', value: 31, color: '#10b981' },
];

const repData = [
  { name: 'Sarah K', quota: 94, deals: 14 },
  { name: 'James O', quota: 87, deals: 11 },
  { name: 'Maria L', quota: 79, deals: 9 },
  { name: 'Tom R', quota: 72, deals: 8 },
  { name: 'Lisa P', quota: 68, deals: 7 },
];

function GaugeArc({ value, max, color, label, sublabel }: { value: number; max: number; color: string; label: string; sublabel: string }) {
  const pct = value / max;
  const r = 54;
  const circ = Math.PI * r;
  const strokeDash = pct * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: '130px', height: '72px', overflow: 'hidden' }}>
        <svg width="130" height="130" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path
            d={`M 11 65 A ${r} ${r} 0 0 1 119 65`}
            fill="none"
            stroke="rgba(226,232,240,0.5)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <motion.path
            d={`M 11 65 A ${r} ${r} 0 0 1 119 65`}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            initial={{ strokeDashoffset: circ }}
            whileInView={{ strokeDashoffset: circ - strokeDash }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.03em' }}>
            {label}
          </p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 500, textAlign: 'center', marginTop: '0.25rem' }}>
        {sublabel}
      </p>
    </div>
  );
}

export function AnalyticsSection() {
  return (
    <section
      id="analytics"
      style={{
        padding: '6rem 0',
        background: '#f8fafc',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Analytics & Reporting"
          title="Data That Drives Decisions,<br />Not Just Reports"
          subtitle="From executive MBRs to rep-level coaching sessions, WizCRM gives you the exact view you need, when you need it."
        />

        {/* Top row: Revenue chart + Gauge meters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
          className="analytics-top"
        >
          {/* Revenue trend chart */}
          <ScrollReveal direction="left">
            <GlassPanel style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Annual Revenue Trend
                  </p>
                  <p style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.025em' }}>
                    $14.7M
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.2rem' }}>
                    <TrendingUp size={14} color="#10b981" />
                    <span style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>+34% YoY growth</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '10px', height: '3px', background: '#6366f1', borderRadius: '9999px' }} />
                    <span style={{ color: '#64748b' }}>Actual</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div style={{ width: '10px', height: '3px', background: '#e2e8f0', borderRadius: '9999px' }} />
                    <span style={{ color: '#64748b' }}>Target</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueData} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}K`} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.8125rem', boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}
                    formatter={(v) => [`$${((v as number)*1000).toLocaleString()}`, '']}
                  />
                  <Area type="monotone" dataKey="target" stroke="#e2e8f0" strokeWidth={1.5} fill="none" strokeDasharray="4 3" />
                  <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fill="url(#revenueGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </GlassPanel>
          </ScrollReveal>

          {/* KPI Gauges */}
          <ScrollReveal direction="right" delay={0.1}>
            <GlassPanel style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Performance Meters
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <GaugeArc value={68} max={100} color="#6366f1" label="68%" sublabel="Win Rate" />
                <GaugeArc value={94} max={100} color="#10b981" label="94%" sublabel="Quota Attained" />
                <GaugeArc value={82} max={100} color="#f59e0b" label="82%" sublabel="Activity Score" />
                <GaugeArc value={91} max={100} color="#ec4899" label="91%" sublabel="CRM Hygiene" />
              </div>
            </GlassPanel>
          </ScrollReveal>
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1.5rem',
          }}
          className="analytics-bottom"
        >
          {/* Pipeline by stage donut */}
          <ScrollReveal delay={0.1}>
            <GlassPanel style={{ padding: '1.75rem' }}>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>Pipeline by Stage</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <PieChart width={120} height={120}>
                  <Pie data={stageData} cx={55} cy={55} innerRadius={36} outerRadius={54} paddingAngle={3} dataKey="value">
                    {stageData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div style={{ flex: 1 }}>
                  {stageData.map((s) => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.75rem', color: '#64748b' }}>{s.name}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </ScrollReveal>

          {/* Rep quota bar chart */}
          <ScrollReveal delay={0.15}>
            <GlassPanel style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Award size={16} color="#f59e0b" />
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>Quota Attainment</p>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={repData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '0.75rem', fontSize: '0.75rem', boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}
                    formatter={(v) => [`${v as number}%`, 'Quota']}
                  />
                  <Bar dataKey="quota" radius={[0, 4, 4, 0]}>
                    {repData.map((entry, i) => (
                      <Cell key={i} fill={entry.quota >= 90 ? '#10b981' : entry.quota >= 80 ? '#6366f1' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </GlassPanel>
          </ScrollReveal>

          {/* Activity KPI cards */}
          <ScrollReveal delay={0.2}>
            <GlassPanel style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Activity size={16} color="#6366f1" />
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a' }}>Activity Summary</p>
              </div>
              {[
                { label: 'Calls Logged', value: '1,284', delta: '+18%', color: '#6366f1' },
                { label: 'Emails Sent', value: '4,792', delta: '+24%', color: '#8b5cf6' },
                { label: 'Meetings Held', value: '342', delta: '+11%', color: '#10b981' },
                { label: 'Proposals Sent', value: '187', delta: '+9%', color: '#f59e0b' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: '0.8125rem', color: '#475569' }}>{item.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0f172a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {item.value}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#10b981', fontWeight: 600, marginLeft: '0.375rem' }}>
                      {item.delta}
                    </span>
                  </div>
                </div>
              ))}
            </GlassPanel>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
