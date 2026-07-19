import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type CostSummary = {
  budgeted: number | null;
  spent: number;
  remaining: number | null;
  revenue: number;
  margin: number | null;
  overBudget: boolean;
};

type Props = {
  opportunityId: string;
  /** Money view is owner + Manager+ — hide entirely for anyone else. */
  canView: boolean;
  refreshKey?: number;
};

function money(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export function OpportunitySummaryStrip({ opportunityId, canView, refreshKey }: Props) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!canView) return;
    api<{ summary: CostSummary }>(`/opportunities/${opportunityId}/summary`)
      .then((d) => setSummary(d.summary))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load cost summary'));
  }, [opportunityId, canView, refreshKey]);

  if (!canView) return null;
  if (error) return <p className="error">{error}</p>;
  if (!summary) return null;

  return (
    <dl className={`opportunity-summary-strip${summary.overBudget ? ' over-budget' : ''}`}>
      <div>
        <dt>Budget</dt>
        <dd>{money(summary.budgeted)}</dd>
      </div>
      <div>
        <dt>Spent</dt>
        <dd>{money(summary.spent)}</dd>
      </div>
      <div>
        <dt>Remaining</dt>
        <dd>{money(summary.remaining)}</dd>
      </div>
      <div>
        <dt>Revenue</dt>
        <dd>{money(summary.revenue)}</dd>
      </div>
      <div>
        <dt>Margin</dt>
        <dd>{money(summary.margin)}</dd>
      </div>
      {summary.overBudget ? <p className="alert alert-error">Over budget</p> : null}
    </dl>
  );
}
