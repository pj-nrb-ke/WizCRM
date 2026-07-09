import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Props = { leadId: string };

type DecisionRole = 'BOSS' | 'FINANCE' | 'IT' | 'OTHER';

type CommitteeContact = {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  source: string;
  confidence: number;
  role: DecisionRole;
};

type Committee = {
  boss: CommitteeContact[];
  finance: CommitteeContact[];
  it: CommitteeContact[];
  other: CommitteeContact[];
};

type Coverage = { boss: boolean; finance: boolean; it: boolean; filled: number; core: number };

type CommitteeResp = {
  fetched: boolean;
  company?: string | null;
  committee?: Committee;
  coverage?: Coverage;
  providers?: string[];
  fromCache?: boolean;
  totalFound?: number;
  cachedAt?: string;
};

const CORE_SLOTS: Array<{ key: 'boss' | 'finance' | 'it'; label: string }> = [
  { key: 'boss', label: 'Owner / MD' },
  { key: 'finance', label: 'Finance' },
  { key: 'it', label: 'IT' },
];

function ContactRow({ c }: { c: CommitteeContact }) {
  return (
    <li className="dm-contact">
      <div className="dm-contact-head">
        <strong>{c.name ?? 'Name not found'}</strong>
        {c.title ? <span className="muted"> — {c.title}</span> : null}
      </div>
      <div className="dm-contact-lines">
        {c.email ? (
          <a href={`mailto:${c.email}`}>{c.email}</a>
        ) : (
          <span className="muted">no email</span>
        )}
        {c.phone ? <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a> : null}
        {c.linkedinUrl ? (
          <a href={c.linkedinUrl} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        ) : null}
      </div>
      <div className="dm-contact-meta muted">
        {c.source} · {Math.round(c.confidence * 100)}% confidence
      </div>
    </li>
  );
}

export function DecisionMakersPanel({ leadId }: Props) {
  const [data, setData] = useState<CommitteeResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [error, setError] = useState('');

  // Free peek on mount — shows what we already have, never spends credits.
  useEffect(() => {
    setLoading(true);
    setError('');
    api<CommitteeResp>(`/leads/${leadId}/decision-makers`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [leadId]);

  async function findNow(forceRefresh = false) {
    setFinding(true);
    setError('');
    try {
      const res = await api<CommitteeResp>(`/leads/${leadId}/find-decision-makers`, {
        method: 'POST',
        body: { forceRefresh },
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setFinding(false);
    }
  }

  const committee = data?.committee;
  const coverage = data?.coverage;
  const hasResults = Boolean(data?.fetched && committee);

  return (
    <section className="decision-makers-panel">
      <h3 className="section-title">Decision-makers</h3>
      <p className="muted">
        Finds the buying committee — Owner/MD, Finance, IT — for this company. On-demand
        (uses lookup credits); results are saved and reused free for 30 days.
      </p>

      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && hasResults && coverage ? (
        <div className="dm-coverage">
          {CORE_SLOTS.map((slot) => (
            <span
              key={slot.key}
              className={`badge ${coverage[slot.key] ? 'badge-info' : 'dm-badge-empty'}`}
            >
              {coverage[slot.key] ? '✓' : '○'} {slot.label}
            </span>
          ))}
          <span className="muted dm-coverage-count">{coverage.filled}/3 roles</span>
        </div>
      ) : null}

      {!loading && hasResults && committee ? (
        <div className="dm-results">
          {CORE_SLOTS.map((slot) => (
            <div key={slot.key} className="dm-role">
              <div className="dm-role-label">{slot.label}</div>
              {committee[slot.key].length > 0 ? (
                <ul className="dm-contact-list">
                  {committee[slot.key].map((c, i) => (
                    <ContactRow key={`${slot.key}-${i}`} c={c} />
                  ))}
                </ul>
              ) : (
                <p className="muted dm-empty">Not found — the AI caller can confirm this by phone.</p>
              )}
            </div>
          ))}

          {committee.other.length > 0 ? (
            <div className="dm-role">
              <div className="dm-role-label">Other contacts</div>
              <ul className="dm-contact-list">
                {committee.other.map((c, i) => (
                  <ContactRow key={`other-${i}`} c={c} />
                ))}
              </ul>
            </div>
          ) : null}

          <p className="muted dm-footnote">
            {data?.fromCache ? 'Loaded from cache · 0 credits' : 'Fresh lookup'}
            {data?.providers && data.providers.length > 0
              ? ` · sources: ${data.providers.join(', ')}`
              : null}
            {data?.cachedAt ? ` · updated ${new Date(data.cachedAt).toLocaleDateString()}` : null}
          </p>
        </div>
      ) : null}

      <div className="toolbar">
        {!hasResults ? (
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={finding || loading}
            onClick={() => void findNow(false)}
          >
            {finding ? 'Searching…' : 'Find decision-makers'}
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={finding}
            title="Re-run the search and refresh from live sources (uses credits)"
            onClick={() => void findNow(true)}
          >
            {finding ? 'Refreshing…' : 'Refresh (uses credits)'}
          </button>
        )}
      </div>
    </section>
  );
}
