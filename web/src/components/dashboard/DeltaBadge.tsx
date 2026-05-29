import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Props = {
  delta: number;
  suffix?: string;
  size?: 'xs' | 'sm';
  invertColor?: boolean;
};

export function DeltaBadge({ delta, suffix = '%', size = 'xs', invertColor = false }: Props) {
  const isUp = delta > 0;
  const isDown = delta < 0;

  let color: string;
  if (invertColor) {
    color = isUp ? '#ef4444' : isDown ? '#10b981' : '#94a3b8';
  } else {
    color = isUp ? '#10b981' : isDown ? '#ef4444' : '#94a3b8';
  }

  const bg = isUp && !invertColor
    ? 'rgba(16,185,129,0.1)'
    : isDown && !invertColor
    ? 'rgba(239,68,68,0.1)'
    : isUp && invertColor
    ? 'rgba(239,68,68,0.1)'
    : isDown && invertColor
    ? 'rgba(16,185,129,0.1)'
    : 'rgba(148,163,184,0.1)';

  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const label = delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}${suffix}`;
  const textSize = size === 'sm' ? 'text-xs' : 'text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-700 ${textSize}`}
      style={{ color, background: bg }}
    >
      <Icon size={10} strokeWidth={2.5} />
      {label}
    </span>
  );
}
