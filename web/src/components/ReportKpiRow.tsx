export type ReportKpiItem = {
  label: string;
  value: number | string;
  hint?: string;
  tone?: 'default' | 'success' | 'warn' | 'info';
};

type Props = {
  items: ReportKpiItem[];
};

function formatValue(value: number | string): string {
  return typeof value === 'number' ? value.toLocaleString() : value;
}

export function ReportKpiRow({ items }: Props) {
  return (
    <section className="report-kpi-row" aria-label="Report overview metrics">
      {items.map((item) => (
        <article
          key={item.label}
          className={`report-kpi-card report-kpi-${item.tone ?? 'default'}`}
          aria-label={item.label}
        >
          <span className="report-kpi-label">{item.label}</span>
          <strong className="report-kpi-value">{formatValue(item.value)}</strong>
          {item.hint ? <span className="report-kpi-hint">{item.hint}</span> : null}
        </article>
      ))}
    </section>
  );
}
