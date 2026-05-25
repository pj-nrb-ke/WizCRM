import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

export type TeamActivityItem = {
  id: string;
  kind: 'activity' | 'calendar';
  at: string;
  user: { id: string; name: string };
  lead: { id: string; name: string; company: string | null } | null;
  summary: string;
  detail: string | null;
  activityType?: string;
};

type LeadOption = { id: string; name: string; company?: string | null };

type Props = {
  leads?: LeadOption[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function TeamActivityFeed({ leads = [] }: Props) {
  const [dateFrom, setDateFrom] = useState(daysAgoIso(14));
  const [dateTo, setDateTo] = useState(todayIso());
  const [leadId, setLeadId] = useState('');
  const [items, setItems] = useState<TeamActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (leadId) params.set('leadId', leadId);
    const q = params.toString();
    api<{ items: TeamActivityItem[] }>(`/teams/activity-feed${q ? `?${q}` : ''}`)
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load activity'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, leadId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="card team-activity-card">
      <h2>Team activity</h2>
      <p className="muted">Who did what, when, and for which lead.</p>

      <div className="activity-filters">
        <label>
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label>
          Lead
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">All leads</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.company ? ` · ${l.company}` : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={load}>
          Apply
        </button>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <p className="muted">Loading activity…</p> : null}

      {!loading && items.length === 0 && !error ? (
        <p className="muted">No activity in this period.</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="activity-feed-list">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="activity-feed-item">
              <div className="activity-feed-meta">
                <time dateTime={item.at}>{formatWhen(item.at)}</time>
                <span className="activity-feed-user">{item.user.name}</span>
                {item.lead ? (
                  <Link to={`/leads?highlight=${item.lead.id}`} className="activity-feed-lead">
                    {item.lead.name}
                    {item.lead.company ? ` · ${item.lead.company}` : ''}
                  </Link>
                ) : (
                  <span className="muted">No lead linked</span>
                )}
              </div>
              <p className="activity-feed-summary">
                <span className={`activity-type-pill type-${item.activityType ?? item.kind}`}>
                  {item.activityType?.replace(/_/g, ' ') ?? item.kind}
                </span>
                {item.summary}
              </p>
              {item.detail ? (
                <p className="activity-feed-detail">{truncate(item.detail, 200)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
