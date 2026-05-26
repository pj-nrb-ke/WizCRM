import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Insights = {
  priority: string | null;
  source: string | null;
  scores: { engagement: number; urgency: number; fit: number };
  hygiene: string[];
};

type Props = {
  leadId: string;
};

export function LeadInsightsPanel({ leadId }: Props) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    api<{ insights: Insights }>(`/leads/${leadId}/insights`)
      .then((d) => setInsights(d.insights))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load insights'));
  }, [leadId]);

  if (error) return <p className="error">{error}</p>;
  if (!insights) return <p className="muted">Loading insights…</p>;

  return (
    <section className="lead-insights-panel">
      <h3 className="section-title">AI insights</h3>
      <div className="insight-scores">
        <ScoreBar label="Urgency" value={insights.scores.urgency} tone="warn" />
        <ScoreBar label="Engagement" value={insights.scores.engagement} tone="ok" />
        <ScoreBar label="Fit" value={insights.scores.fit} tone="indigo" />
      </div>
      {insights.priority ? (
        <p className="muted">
          Priority: <strong>{insights.priority}</strong>
          {insights.source ? ` · Source: ${insights.source}` : ''}
        </p>
      ) : null}
      {insights.hygiene.length > 0 ? (
        <ul className="hygiene-list">
          {insights.hygiene.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">No hygiene flags on this lead.</p>
      )}
    </section>
  );
}

function ScoreBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'warn' | 'ok' | 'indigo';
}) {
  return (
    <div className={`insight-score insight-score-${tone}`}>
      <span>{label}</span>
      <div className="insight-score-track">
        <div className="insight-score-fill" style={{ width: `${value}%` }} />
      </div>
      <span>{value}</span>
    </div>
  );
}
