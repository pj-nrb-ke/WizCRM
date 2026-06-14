import { useEffect, useState } from 'react';
import { AnimatedCounter } from '../AnimatedCounter';

type Props = {
  gaugeId: string;
  label: string;
  score: number; // 0–100
  description?: string;
  tooltip?: string;
  loading?: boolean;
  delay?: number; // stagger mount delay in ms
};

// SVG geometry constants
const R = 44;
const CX = 50;
const CY = 54;
const ARC_LEN = Math.PI * R; // ≈ 138.23

function scoreColor(s: number): string {
  if (s >= 70) return '#10b981';
  if (s >= 40) return '#f59e0b';
  return '#ef4444';
}

function scoreFromColor(s: number): string {
  if (s >= 70) return '#6ee7b7';
  if (s >= 40) return '#fcd34d';
  return '#fca5a5';
}

function scoreStatus(s: number): string {
  if (s >= 70) return 'Strong';
  if (s >= 40) return 'Moderate';
  return 'At Risk';
}

// At arc parameter t ∈ [0,1], the SVG point on the semi-circle is:
// x = CX − R·cos(t·π),  y = CY − R·sin(t·π)
function arcPoint(t: number): [number, number] {
  const a = t * Math.PI;
  return [CX - R * Math.cos(a), CY - R * Math.sin(a)];
}

export function EnterpriseGauge({
  gaugeId,
  label,
  score,
  description,
  tooltip,
  loading = false,
  delay = 0,
}: Props) {
  const [animated, setAnimated] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay + 80);
    return () => clearTimeout(t);
  }, [delay]);

  const color = scoreColor(score);
  const fromColor = scoreFromColor(score);
  const status = scoreStatus(score);
  const progress = Math.min(Math.max(loading ? 0 : score, 0), 100) / 100;
  const dashOffset = ARC_LEN - (animated ? progress * ARC_LEN : 0);

  const [dotX, dotY] = arcPoint(progress);

  const gradId = `eg-grad-${gaugeId}`;
  const glowId = `eg-glow-${gaugeId}`;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glass card */}
      <div
        className="flex flex-col items-center rounded-2xl border p-4 transition-all duration-300"
        style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8faff 60%, #f5f3ff 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: hovered ? color + '60' : 'rgba(203,213,225,0.55)',
          boxShadow: hovered
            ? `0 12px 36px rgba(15,23,42,0.12), 0 0 0 1px ${color}25`
            : '0 2px 10px rgba(15,23,42,0.06), 0 0 0 1px rgba(203,213,225,0.4)',
          transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        }}
      >
        {/* SVG semi-circle gauge */}
        <div className="relative" style={{ width: 150, height: 84 }}>
          <svg
            viewBox="0 0 100 57"
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Gradient along arc: left (lighter) → right (full color) */}
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={fromColor} stopOpacity="0.7" />
                <stop offset="55%" stopColor={color} stopOpacity="0.9" />
                <stop offset="100%" stopColor={color} />
              </linearGradient>

              {/* Subtle glow on the arc */}
              <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background track — full 180° arc */}
            <path
              d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`}
              fill="none"
              stroke="rgba(148,163,184,0.13)"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Inner track shadow ring */}
            <path
              d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`}
              fill="none"
              stroke="rgba(148,163,184,0.07)"
              strokeWidth="10"
              strokeLinecap="round"
            />

            {/* Tick marks at 25 %, 50 %, 75 % */}
            {([0.25, 0.5, 0.75] as const).map((t) => {
              const [tx, ty] = arcPoint(t);
              // Outward radial direction from arc center
              const ox = -(tx - CX) / R;
              const oy = -(ty - CY) / R;
              return (
                <line
                  key={t}
                  x1={tx - ox * 6}
                  y1={ty - oy * 6}
                  x2={tx - ox * 9}
                  y2={ty - oy * 9}
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Value arc — animated via stroke-dashoffset */}
            <path
              d={`M ${CX - R},${CY} A ${R},${R} 0 0,1 ${CX + R},${CY}`}
              fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${ARC_LEN} ${ARC_LEN}`}
              strokeDashoffset={dashOffset}
              style={{
                transition: `stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
                filter: animated && progress > 0 ? `url(#${glowId})` : undefined,
              }}
            />

            {/* End-cap dot that fades in after arc sweep */}
            {progress > 0.02 && (
              <circle
                cx={dotX}
                cy={dotY}
                r="3.5"
                fill={color}
                opacity={animated ? 1 : 0}
                style={{
                  transition: `opacity 0.4s ease ${delay + 1100}ms`,
                  filter: `drop-shadow(0 0 2px ${color}80)`,
                }}
              />
            )}

            {/* Scale labels: 0 on left, 100 on right */}
            <text
              x={CX - R + 1}
              y={CY + 9}
              fontSize="5.5"
              fill="rgba(148,163,184,0.65)"
              textAnchor="middle"
              style={{ fontFamily: 'inherit', fontWeight: 600 }}
            >
              0
            </text>
            <text
              x={CX + R - 1}
              y={CY + 9}
              fontSize="5.5"
              fill="rgba(148,163,184,0.65)"
              textAnchor="middle"
              style={{ fontFamily: 'inherit', fontWeight: 600 }}
            >
              100
            </text>
          </svg>

          {/* Score number + status label, centered in the gauge bowl */}
          <div
            className="absolute inset-0 flex flex-col items-center"
            style={{ justifyContent: 'flex-end', paddingBottom: 12 }}
          >
            <span className="text-[22px] font-800 text-slate-800 leading-none tabular-nums">
              {loading ? (
                <span className="text-slate-300">—</span>
              ) : (
                <AnimatedCounter value={score} />
              )}
            </span>
            <span
              className="text-[9px] font-700 uppercase tracking-[0.09em] mt-0.5"
              style={{ color: loading ? '#cbd5e1' : color }}
            >
              {loading ? 'Loading' : status}
            </span>
          </div>
        </div>

        {/* Label row */}
        <div className="text-center mt-2 px-1 w-full">
          <div className="text-[11px] font-700 text-slate-700 leading-snug">{label}</div>
          {description && (
            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{description}</div>
          )}
        </div>

        {/* Thin progress accent bar */}
        <div className="mt-3 h-[3px] w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: animated ? `${progress * 100}%` : '0%',
              background: `linear-gradient(90deg, ${fromColor}, ${color})`,
              transition: `width 1.4s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
            }}
          />
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && hovered && (
        <div
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2.5 rounded-xl border bg-white pointer-events-none"
          style={{
            minWidth: 200,
            maxWidth: 264,
            padding: '10px 12px',
            boxShadow: '0 8px 28px rgba(15,23,42,0.13)',
            borderColor: 'rgba(203,213,225,0.7)',
          }}
        >
          <div className="text-[11px] font-700 text-slate-700 mb-1">{label}</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">{tooltip}</div>
          {/* Arrow */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-3 h-3 rotate-45 bg-white border-b border-r"
            style={{ borderColor: 'rgba(203,213,225,0.7)' }}
          />
        </div>
      )}
    </div>
  );
}
