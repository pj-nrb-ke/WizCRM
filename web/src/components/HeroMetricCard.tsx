type Props = {
  eyebrow: string;
  value: string | number;
  label: string;
  sub?: string;
};

export function HeroMetricCard({ eyebrow, value, label, sub }: Props) {
  return (
    <div className="hero-metric-card">
      <span className="hero-metric-eyebrow">{eyebrow}</span>
      <span className="hero-metric-value">{typeof value === 'number' ? value.toLocaleString() : value}</span>
      <span className="hero-metric-label">{label}</span>
      {sub ? <span className="hero-metric-sub">{sub}</span> : null}
    </div>
  );
}
