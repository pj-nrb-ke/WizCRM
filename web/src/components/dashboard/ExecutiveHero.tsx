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
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{
        background: 'linear-gradient(140deg, #0c1020 0%, #161240 25%, #1a2060 60%, #0c3a5e 100%)',
        padding: '28px 36px 24px',
        boxShadow: '0 10px 40px rgba(20, 16, 70, 0.38), 0 2px 8px rgba(15, 23, 42, 0.18)',
      }}
    >
      {/* decorative blobs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-60px', right: '-60px', width: '260px', height: '260px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.10)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-50px', left: '22%', width: '200px', height: '200px',
          borderRadius: '50%',
          background: 'rgba(14, 165, 233, 0.07)',
        }}
      />
      {/* grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* greeting + status row */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1
              className="m-0 font-800 leading-tight tracking-tight"
              style={{ color: '#f8fafc', letterSpacing: '-0.04em', fontSize: 'clamp(22px, 3vw, 32px)' }}
            >
              {greeting}, {name}
            </h1>
            <p className="mt-1 text-xs" style={{ color: 'rgba(248,250,252,0.55)', margin: '4px 0 0' }}>
              {dateLabel}
              <span style={{ color: 'rgba(248,250,252,0.32)', marginLeft: 8 }}>· {roleLabel}</span>
            </p>
          </div>

          {/* AI pulse badge */}
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-600"
              style={{
                background: 'rgba(99, 102, 241, 0.18)',
                border: '1px solid rgba(99, 102, 241, 0.28)',
                color: '#a5b4fc',
                backdropFilter: 'blur(8px)',
              }}
            >
              <LiveIndicator color="#818cf8" size={6} />
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
                style={{ height: 80, background: 'rgba(255,255,255,0.06)' }}
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
      className="rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-200 hover:bg-white/10 cursor-default group"
      style={{
        background: kpi.warn
          ? 'rgba(120, 53, 15, 0.22)'
          : 'rgba(255, 255, 255, 0.07)',
        border: `1px solid ${kpi.warn ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.11)'}`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
        style={{
          background: kpi.warn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 255, 255, 0.1)',
          color: kpi.warn ? '#fcd34d' : '#a5b4fc',
        }}
      >
        <Icon size={13} strokeWidth={2} />
      </div>
      <div
        className="text-xl font-800 leading-none tracking-tight tabular-nums"
        style={{ color: kpi.warn ? '#fde68a' : '#f1f5f9', letterSpacing: '-0.03em' }}
      >
        {typeof kpi.value === 'number'
          ? <AnimatedCounter value={kpi.value} />
          : kpi.value}
      </div>
      <div className="text-[10px] font-600 uppercase tracking-wider" style={{ color: kpi.warn ? 'rgba(253,230,138,0.6)' : 'rgba(248,250,252,0.45)' }}>
        {kpi.label}
      </div>
      {kpi.sub && (
        <div className="text-[10px]" style={{ color: 'rgba(248,250,252,0.3)' }}>{kpi.sub}</div>
      )}
    </div>
  );
}
