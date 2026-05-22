import { useEffect, useState } from 'react';
import { LEAD_STAGES } from '../lib/stages';
import { api } from '../lib/api';
import type { LeadSummary } from '../lib/types';

type LeadDetail = LeadSummary & {
  createdAt?: string;
  activities?: { id: string; type: string; body: string; createdAt: string }[];
  tasks?: { id: string; title: string; dueAt: string; completedAt: string | null }[];
};

type Props = {
  leadId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function LeadDrawer({ leadId, onClose, onUpdated }: Props) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState('');

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }
    setError('');
    api<{ lead: LeadDetail }>(`/leads/${leadId}`)
      .then((d) => {
        setLead(d.lead);
        setStage(d.lead.stage);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [leadId]);

  if (!leadId) return null;

  async function saveStage() {
    if (!leadId || stage === lead?.stage) return;
    setSaving(true);
    setError('');
    try {
      const d = await api<{ lead: LeadDetail }>(`/leads/${leadId}`, {
        method: 'PATCH',
        body: { stage },
      });
      setLead(d.lead);
      setStage(d.lead.stage);
      onUpdated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drawer-close btn-secondary" onClick={onClose}>
          Close
        </button>
        {error ? <p className="error">{error}</p> : null}
        {!lead ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <h2>{lead.name}</h2>
            {lead.company ? <p className="muted">{lead.company}</p> : null}
            <dl className="detail-grid">
              <dt>Stage</dt>
              <dd>
                <select value={stage} onChange={(e) => setStage(e.target.value)}>
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: 8 }}
                  disabled={saving || stage === lead.stage}
                  onClick={() => void saveStage()}
                >
                  {saving ? 'Saving…' : 'Update stage'}
                </button>
              </dd>
              <dt>Owner</dt>
              <dd>{lead.owner?.name ?? '—'}</dd>
              <dt>Email</dt>
              <dd>{lead.email ?? '—'}</dd>
              <dt>Phone</dt>
              <dd>{lead.phone ?? '—'}</dd>
              <dt>Source</dt>
              <dd>{lead.source ?? '—'}</dd>
            </dl>
            {lead.tasks && lead.tasks.length > 0 ? (
              <>
                <h3>Tasks</h3>
                <ul className="mini-list">
                  {lead.tasks.map((t) => (
                    <li key={t.id}>
                      {t.title}
                      <span className="muted">
                        {' '}
                        · due {new Date(t.dueAt).toLocaleDateString()}
                        {t.completedAt ? ' (done)' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {lead.activities && lead.activities.length > 0 ? (
              <>
                <h3>Recent activity</h3>
                <ul className="mini-list">
                  {lead.activities.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      <strong>{a.type}</strong> — {a.body.slice(0, 120)}
                      {a.body.length > 120 ? '…' : ''}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </aside>
    </div>
  );
}
