import { Zap } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';
import { LiveIndicator } from './LiveIndicator';

type Props = {
  wonCount: number;
  openCount: number;
  activitiesLast30: number;
  winRate: number;
};

export function RevenuePulse({ wonCount, openCount, activitiesLast30, winRate }: Props) {
  const pipelineHealth = Math.min(100, Math.round(
    (wonCount / Math.max(wonCount + openCount, 1)) * 40 +
    Math.min(activitiesLast30 / 50, 1) * 35 +
    Math.min(winRate / 60, 1) * 25
  ));

  const healthColor = pipelineHealth >= 65 ? '#10b981' : pipelineHealth >= 35 ? '#f59e0b' : '#ef4444';
  const healthLabel = pipelineHealth >= 65 ? 'Strong' : pipelineHealth >= 35 ? 'Moderate' : 'At Risk';

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pipelineHealth / 100) * circumference;

  return (
    <div
      className="rounded-2xl border p-4 relative overflow-hidden transition-all duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.10)]"
      style={{
        background: 'linear-gradient(135deg, #f8f9ff 0%, #eef2ff 60%, #f5f3ff 100%)',
        borderColor: 'rgba(99, 102, 241, 0.18)',
        boxShadow: '0 1px 4px rgba(15,23,42,0.07)',
      }}
    >
      {/* background blob */}
      <div
        className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none"
        style={{ background: 'rgba(99,102,241,0.06)' }}
      />

      <div className="flex items-start justify-between mb-3 relative z-10">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: '#eef2ff', color: '#6366f1' }}>
              <Zap size={13} strokeWidth={2} />
            </div>
            <h3 className="text-sm font-700 text-slate-800 tracking-tight">Pipeline Health</h3>
          </div>
          <p className="text-[11px] text-slate-400 uppercase tracking-wide ml-8.5">Live score · all teams</p>
        </div>
        <LiveIndicator color={healthColor} size={7} />
      </div>

      <div className="flex items-center gap-4 relative z-10">
        {/* ring gauge */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="7" />
            <circle
              cx="40" cy="40" r="36"
              fill="none"
              stroke={healthColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-800 text-slate-800 leading-none tabular-nums">
              <AnimatedCounter value={pipelineHealth} />
            </span>
            <span className="text-[9px] font-700 uppercase tracking-wide" style={{ color: healthColor }}>{healthLabel}</span>
          </div>
        </div>

        {/* metrics */}
        <div className="flex-1 grid grid-cols-2 gap-2">
          <MiniMetric label="Won" value={wonCount} color="#10b981" />
          <MiniMetric label="Open" value={openCount} color="#6366f1" />
          <MiniMetric label="Activities" value={activitiesLast30} color="#0ea5e9" sub="30d" />
          <MiniMetric label="Win Rate" value={winRate} color="#8b5cf6" suffix="%" />
        </div>
      </div>

      {/* health description */}
      <div
        className="mt-3 rounded-xl px-3 py-1.5 text-[11px] text-slate-500 leading-relaxed relative z-10"
        style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(148,163,184,0.12)' }}
      >
        {pipelineHealth >= 65
          ? `Pipeline is performing well. ${wonCount} deals closed with ${winRate}% win rate.`
          : pipelineHealth >= 35
          ? `Moderate pipeline health. Focus on re-engaging ${openCount} open leads.`
          : `Pipeline needs attention. Stale deals and low activity detected.`}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color, sub, suffix }: {
  label: string;
  value: number;
  color: string;
  sub?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-800 text-slate-800 leading-none tabular-nums">
        <AnimatedCounter value={value} suffix={suffix ?? ''} />
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5">
        <span className="h-1.5 w-1.5 rounded-full inline-block mr-1 align-middle" style={{ background: color }} />
        {label}{sub && <span className="opacity-60"> {sub}</span>}
      </span>
    </div>
  );
}
