import type { LucideIcon } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';
import { LiveIndicator } from './LiveIndicator';

type HeroKpi = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  warn?: boolean;
};

type Props = {
  greeting: string;
  name: string;
  dateLabel: string;
  roleLabel: string;
  kpis: HeroKpi[];
  loading?: boolean;
};

export function ExecutiveHero({ greeting, name, dateLabel, roleLabel, kpis, loading }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-4 border"
      style={{
        background: 'linear-gradient(140deg, #EFF3F9 0%, #EBF3FF 55%, #E4EEFF 100%)',
        borderColor: '#dbe4f0',
        padding: '28px 36px 24px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      {/* decorative blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-60px', right: '-60px', width: '260px', height: '260px',
          borderRadius: '50%',
          background: 'rgba(26, 86, 219, 0.06)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-50px', left: '22%', width: '200px', height: '200px',
          borderRadius: '50%',
          background: 'rgba(14, 165, 233, 0.05)',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* greeting + status row */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1
              className="m-0 font-800 leading-tight tracking-tight"
              style={{ color: '#0f172a', letterSpacing: '-0.04em', fontSize: 'clamp(22px, 3vw, 32px)', fontFamily: 'var(--font-display)' }}
            >
              {greeting}, {name}
            </h1>
            <p className="mt-1 text-xs" style={{ color: '#64748b', margin: '4px 0 0' }}>
              {dateLabel}
              <span style={{ color: '#94a3b8', marginLeft: 8 }}>· {roleLabel}</span>
            </p>
          </div>

          {/* AI pulse badge */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-600"
              style={{
                background: 'rgba(26, 86, 219, 0.10)',
                border: '1px solid rgba(26, 86, 219, 0.25)',
                color: '#1A56DB',
              }}
            >
              <LiveIndicator color="#1A56DB" size={6} />
              AI insights active
            </div>
          </div>
        </div>

        {/* KPI tiles row */}
        {loading && !kpis.length ? (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl animate-pulse"
                style={{ height: 80, background: 'rgba(15,23,42,0.04)' }}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
            {kpis.map((kpi) => (
              <HeroKpiTile key={kpi.label} kpi={kpi} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeroKpiTile({ kpi }: { kpi: HeroKpi }) {
  const Icon = kpi.icon;
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:bg-white cursor-default group"
      style={{
        background: kpi.warn ? '#fffbeb' : '#ffffff',
        border: `1px solid ${kpi.warn ? '#fde68a' : '#e2e8f0'}`,
      }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{
          background: kpi.warn ? 'rgba(217, 119, 6, 0.12)' : 'rgba(26, 86, 219, 0.10)',
          color: kpi.warn ? '#b45309' : '#1A56DB',
        }}
      >
        <Icon size={13} strokeWidth={2} />
      </div>
      <div
        className="text-xl font-800 leading-none tracking-tight tabular-nums"
        style={{ color: kpi.warn ? '#92400e' : '#0f172a', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}
      >
        {typeof kpi.value === 'number'
          ? <AnimatedCounter value={kpi.value} />
          : kpi.value}
      </div>
      <div className="text-[10px] font-600 uppercase tracking-wider" style={{ color: kpi.warn ? '#b45309' : '#64748b' }}>
        {kpi.label}
      </div>
      {kpi.sub && (
        <div className="text-[10px]" style={{ color: '#94a3b8' }}>{kpi.sub}</div>
      )}
    </div>
  );
}
