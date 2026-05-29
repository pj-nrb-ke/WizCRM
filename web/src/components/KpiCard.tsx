import type { LucideIcon } from 'lucide-react';
import {
  Circle,
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  TrendingUp,
  Users,
  Target,
  Zap,
} from 'lucide-react';

type Props = {
  label: string;
  value: number;
  hint?: string;
  variant?: 'default' | 'warn' | 'success';
  icon?: string;
  lucideIcon?: LucideIcon;
  active?: boolean;
  onClick?: () => void;
};

const EMOJI_TO_LUCIDE: Record<string, LucideIcon> = {
  '◎': Circle,
  '⏱': Clock,
  '⚠': AlertTriangle,
  '📅': Calendar,
  '✓': CheckCircle2,
  '↑': TrendingUp,
  '👥': Users,
  '🎯': Target,
  '⚡': Zap,
};

export function KpiCard({
  label,
  value,
  hint,
  variant = 'default',
  icon,
  lucideIcon,
  active,
  onClick,
}: Props) {
  const Tag = onClick ? 'button' : 'div';
  const IconComponent = lucideIcon ?? (icon ? EMOJI_TO_LUCIDE[icon] : undefined);

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`kpi-card kpi-card-${variant}${active ? ' kpi-card-active' : ''}${onClick ? ' kpi-card-clickable' : ''}`}
      onClick={onClick}
    >
      {IconComponent ? (
        <span className="kpi-card-icon" aria-hidden>
          <IconComponent size={18} strokeWidth={2} />
        </span>
      ) : icon ? (
        <span className="kpi-card-icon" aria-hidden>{icon}</span>
      ) : null}
      <span className="kpi-card-value">{value.toLocaleString()}</span>
      <span className="kpi-card-label">{label}</span>
      {hint ? <span className="kpi-card-hint">{hint}</span> : null}
      {onClick ? <span className="kpi-card-cta">View records →</span> : null}
    </Tag>
  );
}
