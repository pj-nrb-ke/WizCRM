export type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: DonutDatum[];
  ariaLabel: string;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
};

type Segment = {
  label: string;
  value: number;
  color: string;
  path: string;
};

function point(cx: number, cy: number, radius: number, angle: number) {
  const rad = (Math.PI / 180) * angle;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = point(cx, cy, radius, startAngle);
  const end = point(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function DonutChart({
  data,
  ariaLabel,
  centerLabel,
  centerValue,
  size = 220,
  thickness = 22,
}: Props) {
  const items = data.filter((entry) => entry.value > 0);
  const total = items.reduce((sum, entry) => sum + entry.value, 0);
  const radius = size / 2 - thickness / 2 - 2;
  const center = size / 2;

  const segments: Segment[] = [];
  let angle = -90;
  for (const entry of items) {
    const next = total > 0 ? angle + (entry.value / total) * 360 : angle;
    segments.push({
      ...entry,
      path: arcPath(center, center, radius, angle, next),
    });
    angle = next;
  }

  return (
    <div className="donut-chart-wrap">
      <div className="donut-chart-svg-wrap">
        <svg
          className="donut-chart"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={ariaLabel}
        >
          <title>{ariaLabel}</title>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={thickness}
          />
          {segments.map((segment) => (
            <path
              key={segment.label}
              d={segment.path}
              fill="none"
              stroke={segment.color}
              strokeWidth={thickness}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="donut-chart-center" aria-hidden>
          <strong>{centerValue ?? total.toLocaleString()}</strong>
          {centerLabel ? <span>{centerLabel}</span> : null}
        </div>
      </div>
      <ul className="chart-legend" aria-label={`${ariaLabel} legend`}>
        {data.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <li key={item.label}>
              <span className="chart-legend-swatch" style={{ background: item.color }} aria-hidden />
              <span className="chart-legend-label">{item.label}</span>
              <span className="chart-legend-value">
                {item.value.toLocaleString()} ({percent}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
