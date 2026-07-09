import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EXPO_RECOMMENDATION_LABELS,
  EXPO_TIERS,
  EXPO_TIER_LABELS,
  type ExpoRecommendation,
  type ExpoTier,
} from '@wizcrm/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';

type Expo = {
  id: string;
  name: string;
  tier: ExpoTier;
  brief: string | null;
  positioning: string | null;
  recommendation: ExpoRecommendation | null;
  recommendationReason: string | null;
  startDate: string | null;
  endDate: string | null;
  dateText: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  sourceTitle: string | null;
  confidence: number;
  industryTags: string[];
  calendarEventId: string | null;
  dismissedAt: string | null;
};

type OrgUser = { id: string; name: string; role: string };

const REC_COLOR: Record<ExpoRecommendation, string> = {
  BOOTH: 'var(--success, #067647)',
  PARTICIPANT: 'var(--accent, #175cd3)',
  SKIP: 'var(--muted-fg, #667085)',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Never invent a date the source did not give — say so plainly instead. */
function whenLabel(e: Expo): string {
  if (e.startDate && e.endDate && e.startDate !== e.endDate) {
    return `${fmtDate(e.startDate)} – ${fmtDate(e.endDate)}`;
  }
  if (e.startDate) return fmtDate(e.startDate);
  if (e.dateText) return `${e.dateText} (not confirmed)`;
  return 'Date not confirmed';
}

function whereLabel(e: Expo): string {
  return [e.venue, e.city, e.country].filter(Boolean).join(', ') || 'Location not stated';
}

export function ExposPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER' || user?.role === 'ADMIN';

  const [expos, setExpos] = useState<Expo[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [tier, setTier] = useState<ExpoTier | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);

  // "Add to calendar" modal
  const [adding, setAdding] = useState<Expo | null>(null);
  const [inviteIds, setInviteIds] = useState<string[]>([]);
  const [savingEvent, setSavingEvent] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tier !== 'ALL') params.set('tier', tier);
    if (showDismissed) params.set('includeDismissed', 'true');
    api<{ expos: Expo[] }>(`/expos?${params}`)
      .then((d) => setExpos(d.expos ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load expos'))
      .finally(() => setLoading(false));
  }, [tier, showDismissed]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    api<{ users: OrgUser[] }>('/calendar/org-users')
      .then((d) => setOrgUsers(d.users ?? []))
      .catch(() => setOrgUsers([]));
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expos) m.set(e.tier, (m.get(e.tier) ?? 0) + 1);
    return m;
  }, [expos]);

  async function discover() {
    setDiscovering(true);
    setError('');
    setMessage('');
    try {
      const body = tier === 'ALL' ? {} : { tier };
      const { summary } = await api<{
        summary: { found: number; added: number; updated: number };
      }>('/expos/discover', { method: 'POST', body });
      setMessage(
        summary.found === 0
          ? 'The search found no upcoming expos this time. Try again later, or search a single region.'
          : `Found ${summary.found} — ${summary.added} new, ${summary.updated} refreshed.`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setDiscovering(false);
    }
  }

  async function toggleDismiss(e: Expo) {
    setError('');
    try {
      await api(`/expos/${e.id}/dismiss`, { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update');
    }
  }

  async function confirmAdd() {
    if (!adding) return;
    setSavingEvent(true);
    setError('');
    try {
      const res = await api<{ alreadyOnCalendar: boolean }>(`/expos/${adding.id}/add-to-calendar`, {
        method: 'POST',
        body: { attendeeIds: inviteIds },
      });
      setMessage(
        res.alreadyOnCalendar
          ? `${adding.name} was already on the calendar.`
          : `${adding.name} added to the calendar${
              inviteIds.length ? ` — ${inviteIds.length} colleague(s) invited.` : '.'
            }`,
      );
      setAdding(null);
      setInviteIds([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to calendar');
    } finally {
      setSavingEvent(false);
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Expo finder"
        subtitle="Upcoming trade shows worth WizAG's time, read from the public web — with a view on whether to take a booth or just attend."
        actions={
          isManager ? (
            <button type="button" className="btn-primary" disabled={discovering} onClick={() => void discover()}>
              {discovering ? 'Searching…' : tier === 'ALL' ? 'Find expos' : `Find ${EXPO_TIER_LABELS[tier]} expos`}
            </button>
          ) : null
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
        <button
          type="button"
          className={tier === 'ALL' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          onClick={() => setTier('ALL')}
        >
          All regions
        </button>
        {EXPO_TIERS.map((t) => (
          <button
            key={t}
            type="button"
            className={tier === t ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
            onClick={() => setTier(t)}
          >
            {EXPO_TIER_LABELS[t]}
            {counts.get(t) ? <span className="muted"> ({counts.get(t)})</span> : null}
          </button>
        ))}
        <label className="checkbox-row" style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => setShowDismissed(e.target.checked)}
          />
          Show dismissed
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}
      {discovering ? (
        <p className="muted">
          Searching the web and reading the results — this takes up to a minute for all five regions.
        </p>
      ) : null}
      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && expos.length === 0 ? (
        <div className="card">
          <h2>No expos yet</h2>
          <p className="muted">
            {isManager
              ? 'Press "Find expos" to search the web. Results are read from real listings — anything without a source is discarded, so an empty list means nothing solid was found.'
              : 'Ask a manager to run the expo search.'}
          </p>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        {expos.map((e) => (
          <div key={e.id} className="card" style={{ opacity: e.dismissedAt ? 0.55 : 1 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, flex: 1 }}>{e.name}</h2>
              {e.recommendation ? (
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: REC_COLOR[e.recommendation],
                    border: `1px solid ${REC_COLOR[e.recommendation]}`,
                    borderRadius: 999,
                    padding: '2px 10px',
                  }}
                >
                  {EXPO_RECOMMENDATION_LABELS[e.recommendation]}
                </span>
              ) : null}
              <span className="muted" style={{ fontSize: '0.8rem' }}>
                {EXPO_TIER_LABELS[e.tier]}
              </span>
            </div>

            <p className="muted" style={{ margin: '4px 0 8px' }}>
              <strong>{whenLabel(e)}</strong> · {whereLabel(e)}
              {e.calendarEventId ? ' · ✓ on the calendar' : ''}
            </p>

            {e.brief ? <p style={{ marginTop: 0 }}>{e.brief}</p> : null}

            {e.positioning ? (
              <p style={{ marginTop: 0 }}>
                <strong>How we position ourselves:</strong> {e.positioning}
              </p>
            ) : null}

            {e.recommendationReason ? (
              <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
                {e.recommendationReason}
              </p>
            ) : null}

            {e.industryTags.length ? (
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
                {e.industryTags.join(' · ')}
              </p>
            ) : null}

            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
              Confidence {e.confidence}% ·{' '}
              <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                {e.sourceTitle ?? 'source'}
              </a>
              {e.websiteUrl ? (
                <>
                  {' · '}
                  <a href={e.websiteUrl} target="_blank" rel="noreferrer">
                    official site
                  </a>
                </>
              ) : null}
              {e.confidence < 60 ? ' · check the source before committing' : ''}
            </p>

            <div className="toolbar" style={{ gap: 6 }}>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!e.startDate || !!e.calendarEventId}
                title={
                  !e.startDate
                    ? 'This expo has no confirmed date yet'
                    : e.calendarEventId
                      ? 'Already on the calendar'
                      : undefined
                }
                onClick={() => {
                  setAdding(e);
                  setInviteIds([]);
                  setMessage('');
                }}
              >
                {e.calendarEventId ? 'On the calendar' : 'Add to calendar'}
              </button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void toggleDismiss(e)}>
                {e.dismissedAt ? 'Restore' : 'Not interested'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setAdding(null)}>
          <div className="modal-panel" onClick={(ev) => ev.stopPropagation()}>
            <h2>Add "{adding.name}" to the calendar</h2>
            <p className="muted">
              {whenLabel(adding)} · {whereLabel(adding)}
              <br />
              It goes on as an all-day <strong>Expo</strong> event. Tick anyone who should come — they
              will see it on their calendar and can reply.
            </p>

            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid var(--border, #ddd)',
                borderRadius: 8,
                padding: 8,
                marginBottom: 8,
              }}
            >
              {orgUsers.filter((u) => u.id !== user?.id).length === 0 ? (
                <p className="muted" style={{ margin: 4 }}>
                  No colleagues to invite yet.
                </p>
              ) : null}
              {orgUsers
                .filter((u) => u.id !== user?.id)
                .map((u) => (
                  <label key={u.id} className="checkbox-row" style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={inviteIds.includes(u.id)}
                      onChange={() =>
                        setInviteIds((prev) =>
                          prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id],
                        )
                      }
                    />
                    {u.name}
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {u.role.toLowerCase()}
                    </span>
                  </label>
                ))}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAdding(null)}
                disabled={savingEvent}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void confirmAdd()}
                disabled={savingEvent}
              >
                {savingEvent ? 'Adding…' : 'Add to calendar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
