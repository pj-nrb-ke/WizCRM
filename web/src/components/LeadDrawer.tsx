import { useEffect, useState } from 'react';
import { LEAD_STAGES } from '../lib/stages';
import { api } from '../lib/api';
import type { LeadSummary } from '../lib/types';
import { SalesOpportunityForm } from './SalesOpportunityForm';
import { SALES_OPP_STAGE_LABELS, SALES_OPP_STATUS_LABELS } from '../lib/opportunity-labels';

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
  const [opportunities, setOpportunities] = useState<
    {
      id: string;
      referenceNumber: string;
      description: string;
      oppStage: string;
      oppStatus: string;
      probabilityPct: number;
      expectedValue: number | null;
      isClosed: boolean;
    }[]
  >([]);
  const [showOppForm, setShowOppForm] = useState(false);

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
    api<{ opportunities: typeof opportunities }>(`/opportunities/lead/${leadId}`)
      .then((d) => setOpportunities(d.opportunities ?? []))
      .catch(() => setOpportunities([]));
    setShowOppForm(false);
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
            <h3>Sales opportunities</h3>
            {showOppForm ? (
              <SalesOpportunityForm
                leadId={lead.id}
                leadName={lead.name}
                onCreated={() => {
                  setShowOppForm(false);
                  onUpdated?.();
                  api<{ opportunities: typeof opportunities }>(`/opportunities/lead/${leadId}`)
                    .then((d) => setOpportunities(d.opportunities ?? []))
                    .catch(() => {});
                }}
                onCancel={() => setShowOppForm(false)}
              />
            ) : (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginBottom: 12 }}
                onClick={() => setShowOppForm(true)}
              >
                Add sales opportunity
              </button>
            )}
            {opportunities.length > 0 ? (
              <ul className="mini-list">
                {opportunities.map((o) => (
                  <li key={o.id}>
                    <strong>{o.referenceNumber}</strong> — {o.description.slice(0, 80)}
                    <span className="muted">
                      {' '}
                      · {SALES_OPP_STAGE_LABELS[o.oppStage] ?? o.oppStage} ·{' '}
                      {SALES_OPP_STATUS_LABELS[o.oppStatus] ?? o.oppStatus} · {o.probabilityPct}%
                      {o.expectedValue != null ? ` · EV ${o.expectedValue}` : ''}
                      {o.isClosed ? ' (closed)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No sales opportunities yet.</p>
            )}

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
