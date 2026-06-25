import { motion } from 'framer-motion';
import { SectionHeader } from './shared/SectionHeader';
import { GlassPanel } from './shared/GlassPanel';
import { ScrollReveal } from './shared/ScrollReveal';
import { TrendingUp, TrendingDown, Activity, CheckCircle } from 'lucide-react';

function MiniGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const strokeDash = (value / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ position: 'relative', width: '88px', height: '88px' }}>
        <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <motion.circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            whileInView={{ strokeDashoffset: circ - strokeDash }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {value}%
          </span>
        </div>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0, fontWeight: 500, textAlign: 'center' }}>{label}</p>
    </div>
  );
}

function SparkLine({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 120;
  const h = 36;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  });
  const path = `M${coords.join(' L')}`;

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function DashboardShowcase() {
  return (
    <section
      id="dashboard"
      style={{
        padding: '6rem 0',
        background: 'linear-gradient(160deg, #0f0c29 0%, #1e1b4b 50%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decorations */}
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: '-200px',
          right: '-200px',
          width: '500px',
          height: '500px',
          border: '1px solid rgba(99,102,241,0.12)',
          borderRadius: '50%',
          zIndex: 0,
        }}
      />
      <motion.div
        animate={{ rotate: [360, 0] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          bottom: '-150px',
          left: '-150px',
          width: '400px',
          height: '400px',
          border: '1px solid rgba(139,92,246,0.12)',
          borderRadius: '50%',
          zIndex: 0,
        }}
      />

      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem' }}>
        <SectionHeader
          eyebrow="Dashboard Preview"
          title="Executive-Grade Visibility<br />at Every Level"
          subtitle="See your entire revenue operation in real time. From individual rep activity to board-level KPIs."
          light
        />

        {/* Main showcase grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
          className="showcase-grid"
        >
          {/* Left: Main dashboard panel */}
          <ScrollReveal direction="left">
            <GlassPanel dark style={{ padding: '1.75rem', height: '100%' }}>
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Revenue Pulse
                  </p>
                  <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.025em' }}>
                    $4,218,500
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.25rem' }}>
                    <TrendingUp size={14} color="#10b981" />
                    <span style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 600 }}>+23.4% vs last quarter</span>
                  </div>
                </div>
                <div
                  style={{
                    padding: '0.375rem 0.875rem',
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    color: '#10b981',
                    fontWeight: 700,
                  }}
                >
                  On Track
                </div>
              </div>

              {/* Chart area */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', marginBottom: '1.5rem' }}>
                {[40, 65, 45, 80, 55, 75, 90, 70, 85, 95, 78, 100, 88, 92, 87, 95].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.05 * i, ease: 'easeOut' }}
                    style={{
                      flex: 1,
                      borderRadius: '3px 3px 0 0',
                      background:
                        i >= 14
                          ? 'linear-gradient(180deg, #818cf8 0%, #6366f1 100%)'
                          : i >= 10
                          ? 'rgba(99,102,241,0.5)'
                          : 'rgba(99,102,241,0.2)',
                    }}
                  />
                ))}
              </div>

              {/* Gauges row */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-around' }}>
                <MiniGauge value={68} label="Win Rate" color="#818cf8" />
                <MiniGauge value={94} label="Quota" color="#10b981" />
                <MiniGauge value={82} label="Activities" color="#f59e0b" />
                <MiniGauge value={76} label="Pipeline" color="#ec4899" />
              </div>
            </GlassPanel>
          </ScrollReveal>

          {/* Right column: smaller panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <ScrollReveal direction="right" delay={0.1}>
              <GlassPanel dark style={{ padding: '1.25rem' }}>
                <p style={{ margin: '0 0 0.875rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Pipeline Health
                </p>
                {[
                  { stage: 'Prospecting', value: 142, color: '#818cf8' },
                  { stage: 'Qualified', value: 87, color: '#6366f1' },
                  { stage: 'Proposal', value: 54, color: '#8b5cf6' },
                  { stage: 'Negotiation', value: 28, color: '#ec4899' },
                  { stage: 'Closed Won', value: 19, color: '#10b981' },
                ].map((s) => (
                  <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.625rem' }}>
                    <span style={{ width: '5.5rem', fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500, flexShrink: 0 }}>
                      {s.stage}
                    </span>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(s.value / 142) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        style={{ height: '100%', background: s.color, borderRadius: '9999px' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#f8fafc', fontWeight: 700, width: '2rem', textAlign: 'right' }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </GlassPanel>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={0.2}>
              <GlassPanel dark style={{ padding: '1.25rem' }}>
                <p style={{ margin: '0 0 0.875rem', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Top Performers
                </p>
                {[
                  { name: 'Sarah K.', deals: 14, rev: '$284K', trend: [40,55,70,65,80,95] },
                  { name: 'James O.', deals: 11, rev: '$231K', trend: [30,45,40,60,75,88] },
                  { name: 'Maria L.', deals: 9, rev: '$198K', trend: [50,60,55,70,68,79] },
                ].map((rep) => (
                  <div key={rep.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        width: '2.25rem',
                        height: '2.25rem',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {rep.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>{rep.name}</p>
                      <p style={{ margin: 0, fontSize: '0.6875rem', color: '#64748b' }}>{rep.deals} deals · {rep.rev}</p>
                    </div>
                    <SparkLine points={rep.trend} color="#10b981" />
                  </div>
                ))}
              </GlassPanel>
            </ScrollReveal>
          </div>
        </div>

        {/* Bottom KPI strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem',
          }}
          className="kpi-strip"
        >
          {[
            { label: 'Total Revenue', value: '$4.2M', delta: '+23%', Icon: TrendingUp, color: '#10b981' },
            { label: 'Active Leads', value: '247', delta: '+31 this week', Icon: Activity, color: '#818cf8' },
            { label: 'Avg Deal Size', value: '$38,400', delta: '+12% vs LQ', Icon: TrendingUp, color: '#f59e0b' },
            { label: 'Won This Month', value: '19 deals', delta: '94% quota', Icon: CheckCircle, color: '#ec4899' },
          ].map((kpi, i) => (
            <ScrollReveal key={kpi.label} delay={i * 0.1}>
              <GlassPanel dark style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.6875rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                      {kpi.label}
                    </p>
                    <p style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}>
                      {kpi.value}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      {kpi.color === '#10b981' || kpi.color === '#f59e0b' || kpi.color === '#818cf8' ? (
                        <TrendingUp size={12} color={kpi.color} />
                      ) : (
                        <TrendingDown size={12} color={kpi.color} />
                      )}
                      <span style={{ fontSize: '0.6875rem', color: kpi.color, fontWeight: 600 }}>{kpi.delta}</span>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      background: `${kpi.color}20`,
                      border: `1px solid ${kpi.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <kpi.Icon size={16} color={kpi.color} />
                  </div>
                </div>
              </GlassPanel>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
