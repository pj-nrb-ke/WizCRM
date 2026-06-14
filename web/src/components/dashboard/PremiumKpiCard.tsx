import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AnimatedCounter } from './AnimatedCounter';

type Trend = 'up' | 'down' | 'neutral';

type SparkPoint = { v: number };

type Props = {
  label: string;
  value: string | number;
  sub?: string;
  microInsight?: string;
  prevLabel?: string;
  trend?: Trend;
  trendLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  sparkData?: SparkPoint[];
  sparkColor?: string;
  onClick?: () => void;
  active?: boolean;
};

const TREND_CONFIG: Record<Trend, { icon: LucideIcon; cls: string; bg: string }> = {
  up: { icon: TrendingUp, cls: 'text-emerald-600', bg: 'rgba(16,185,129,0.1)' },
  down: { icon: TrendingDown, cls: 'text-red-500', bg: 'rgba(239,68,68,0.09)' },
  neutral: { icon: Minus, cls: 'text-slate-400', bg: 'rgba(148,163,184,0.1)' },
};

export function PremiumKpiCard({
  label,
  value,
  sub,
  microInsight,
  prevLabel,
  trend = 'neutral',
  trendLabel,
  icon: Icon,
  iconColor = '#6366f1',
  iconBg = '#eef2ff',
  sparkData,
  sparkColor = '#6366f1',
  onClick,
  active,
}: Props) {
  const tc = TREND_CONFIG[trend];
  const TrendIcon = tc.icon;
  const Tag = onClick ? 'button' : 'div';

  // mount animation flag
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      const id = setTimeout(() => setMounted(true), 80);
      return () => clearTimeout(id);
    }
  }, []);

  const numericValue = typeof value === 'number' ? value : null;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'group relative flex flex-col gap-2 rounded-2xl border bg-white p-4 text-left',
        'transition-all duration-200',
        'shadow-[0_1px_3px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]',
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(15,23,42,0.11)] font-inherit'
          : '',
        active ? 'border-indigo-400 ring-2 ring-indigo-400/20' : 'border-slate-200 hover:border-slate-300',
      ].join(' ')}
      style={{
        color: 'inherit',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: 'opacity 0.35s ease, transform 0.35s ease, box-shadow 0.2s, border-color 0.2s',
      }}
    >
      {/* accent top line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl transition-all duration-200 group-hover:h-[3px]"
        style={{ background: sparkColor }}
      />

      {/* header row */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
          style={{ background: iconBg, color: iconColor }}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
        {trendLabel && (
          <span
            className={`flex items-center gap-1 text-[11px] font-700 rounded-full px-1.5 py-0.5 ${tc.cls}`}
            style={{ background: tc.bg }}
          >
            <TrendIcon size={11} strokeWidth={2.5} />
            {trendLabel}
          </span>
        )}
      </div>

      {/* value */}
      <div>
        <div className="text-2xl font-800 tracking-tight text-slate-800 leading-none tabular-nums">
          {numericValue !== null && mounted
            ? <AnimatedCounter value={numericValue} />
            : (typeof value === 'number' ? value.toLocaleString() : value)}
        </div>
        <div className="mt-0.5 text-[11px] font-600 uppercase tracking-wider text-slate-400">{label}</div>
        {prevLabel && (
          <div className="mt-0.5 text-[11px] text-slate-400">{prevLabel}</div>
        )}
        {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      </div>

      {/* sparkline */}
      {sparkData && sparkData.length > 1 && (
        <div className="h-9 w-full" style={{ opacity: 0.85 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={sparkColor}
                strokeWidth={1.5}
                fill={`url(#spark-${label.replace(/\s/g, '')})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* micro-insight */}
      {microInsight && (
        <div
          className="text-[11px] text-slate-400 leading-tight border-t border-slate-100 pt-1.5"
        >
          {microInsight}
        </div>
      )}

      {onClick && (
        <span
          className="absolute bottom-2.5 right-3.5 text-[11px] font-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ color: iconColor }}
        >
          View →
        </span>
      )}
    </Tag>
  );
}
