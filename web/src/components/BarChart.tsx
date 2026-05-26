export type BarChartDatum = {
  label: string;
  value: number;
  color?: string;
  detail?: string;
};

type Props = {
  data: BarChartDatum[];
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
  compact?: boolean;
};

export function BarChart({ data, ariaLabel, valueFormatter, compact = false }: Props) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const format = valueFormatter ?? ((value: number) => value.toLocaleString());

  return (
    <ul className={`chart-bar-list${compact ? ' chart-bar-list-compact' : ''}`} aria-label={ariaLabel}>
      {data.map((item) => {
        const width = Math.max(3, Math.round((item.value / max) * 100));
        return (
          <li key={item.label} className="chart-bar">
            <div className="chart-bar-meta">
              <span className="chart-bar-label">{item.label}</span>
              {item.detail ? <span className="chart-bar-detail">{item.detail}</span> : null}
            </div>
            <div className="chart-bar-track" aria-hidden>
              <span
                className="chart-bar-fill"
                style={{ width: `${width}%`, background: item.color ?? 'var(--primary)' }}
              />
            </div>
            <span className="chart-bar-value">{format(item.value)}</span>
          </li>
        );
      })}
    </ul>
  );
}
