type Props = {
  label: string;
  value: number;
  hint?: string;
  variant?: 'default' | 'warn' | 'success';
  icon?: string;
  active?: boolean;
  onClick?: () => void;
};

export function KpiCard({ label, value, hint, variant = 'default', icon, active, onClick }: Props) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`kpi-card kpi-card-${variant}${active ? ' kpi-card-active' : ''}${onClick ? ' kpi-card-clickable' : ''}`}
      onClick={onClick}
    >
      {icon ? <span className="kpi-card-icon" aria-hidden>{icon}</span> : null}
      <span className="kpi-card-value">{value.toLocaleString()}</span>
      <span className="kpi-card-label">{label}</span>
      {hint ? <span className="kpi-card-hint">{hint}</span> : null}
      {onClick ? <span className="kpi-card-cta">View records →</span> : null}
    </Tag>
  );
}
