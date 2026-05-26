import { useEffect, useState } from 'react';
import { LEAD_STAGES } from '../lib/stages';
import { api } from '../lib/api';
import type { LeadSummary } from '../lib/types';
import { SalesOpportunityForm } from './SalesOpportunityForm';
import { SALES_OPP_STAGE_LABELS, SALES_OPP_STATUS_LABELS } from '../lib/opportunity-labels';
import { CloseLeadModal, type CrmConfig } from './CloseLeadModal';
import { LogActivityForm } from './LogActivityForm';
import { CloseOutcomeBanner, LeadAuditTrail } from './LeadAuditTrail';

type LeadDetail = LeadSummary & {
  createdAt?: string;
  wonValue?: number | string | null;
  wonStartAt?: string | null;
  wonProducts?: string | null;
  lossReason?: string | null;
  activities?: {
    id: string;
    type: string;
    subject: string | null;
    body: string;
    createdAt: string;
    user: { name: string };
  }[];
  tasks?: { id: string; title: string; dueAt: string; completedAt: string | null }[];
  stageChanges?: {
    id: string;
    fromStage: string;
    toStage: string;
    note: string | null;
    createdAt: string;
    user: { name: string };
  }[];
};

type Props = {
  leadId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

type CloseMode = 'WON' | 'LOST' | null;

export function LeadDrawer({ leadId, onClose, onUpdated }: Props) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState('');
  const [closeMode, setCloseMode] = useState<CloseMode>(null);
  const [tab, setTab] = useState<'overview' | 'activity' | 'history'>('overview');
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

  async function reloadLead(id: string) {
    const d = await api<{ lead: LeadDetail }>(`/leads/${id}`);
    setLead(d.lead);
    setStage(d.lead.stage);
    return d.lead;
  }

  useEffect(() => {
    if (!leadId) {
      setLead(null);
      return;
    }
    setError('');
    setTab('overview');
    setCloseMode(null);
    reloadLead(leadId).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    api<{ opportunities: typeof opportunities }>(`/opportunities/lead/${leadId}`)
      .then((d) => setOpportunities(d.opportunities ?? []))
      .catch(() => setOpportunities([]));
    api<CrmConfig>('/leads/crm-config')
      .then(setConfig)
      .catch(() => setConfig(null));
    setShowOppForm(false);
  }, [leadId]);

  if (!leadId) return null;

  async function saveStage() {
    if (!leadId || !lead || stage === lead.stage) return;
    if (stage === 'WON' || stage === 'LOST') {
      setCloseMode(stage);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await reloadLeadAfterPatch({ stage });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function reloadLeadAfterPatch(body: Record<string, unknown>) {
    const d = await api<{ lead: LeadDetail }>(`/leads/${leadId}`, { method: 'PATCH', body });
    setLead(d.lead);
    setStage(d.lead.stage);
    setCloseMode(null);
    onUpdated?.();
  }

  async function logActivity(data: { type: string; subject?: string; body: string }) {
    if (!leadId) return;
    setSaving(true);
    setError('');
    try {
      await api(`/leads/${leadId}/activities`, { method: 'POST', body: data });
      await reloadLead(leadId);
      onUpdated?.();
      setTab('history');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log activity');
    } finally {
      setSaving(false);
    }
  }

  const isClosed = lead?.stage === 'WON' || lead?.stage === 'LOST';

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside className="drawer drawer-wide" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drawer-close btn-secondary" onClick={onClose}>
          Close
        </button>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {!lead ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <h2>{lead.name}</h2>
            {lead.company ? <p className="muted">{lead.company}</p> : null}
            <CloseOutcomeBanner
              stage={lead.stage}
              wonValue={lead.wonValue}
              wonStartAt={lead.wonStartAt}
              wonProducts={lead.wonProducts}
              lossReason={lead.lossReason}
            />

            <div className="drawer-tabs" role="tablist">
              {(['overview', 'activity', 'history'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? 'drawer-tab active' : 'drawer-tab'}
                  onClick={() => setTab(t)}
                >
                  {t === 'overview' ? 'Overview' : t === 'activity' ? 'Log activity' : 'History'}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <>
                <div className="drawer-close-actions">
                  {!isClosed && (
                    <>
                      <button type="button" className="btn-primary" onClick={() => setCloseMode('WON')}>
                        Mark Won
                      </button>
                      <button type="button" className="btn-danger" onClick={() => setCloseMode('LOST')}>
                        Mark Lost
                      </button>
                    </>
                  )}
                  {isClosed && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => void reloadLeadAfterPatch({ stage: 'QUALIFIED' })}
                      disabled={saving}
                    >
                      Reopen (Qualified)
                    </button>
                  )}
                </div>

                <dl className="detail-grid">
                  <dt>Stage</dt>
                  <dd>
                    <select
                      value={stage}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'WON' || v === 'LOST') {
                          setCloseMode(v);
                          return;
                        }
                        setStage(v);
                      }}
                      disabled={isClosed}
                    >
                      {LEAD_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {!isClosed && stage !== lead.stage && stage !== 'WON' && stage !== 'LOST' ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ marginTop: 8 }}
                        disabled={saving}
                        onClick={() => void saveStage()}
                      >
                        Update stage
                      </button>
                    ) : null}
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
                          {SALES_OPP_STATUS_LABELS[o.oppStatus] ?? o.oppStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No sales opportunities yet.</p>
                )}
              </>
            )}

            {tab === 'activity' && (
              <LogActivityForm leadId={lead.id} saving={saving} onSubmit={(d) => void logActivity(d)} />
            )}

            {tab === 'history' && (
              <LeadAuditTrail
                stageChanges={lead.stageChanges ?? []}
                activities={lead.activities ?? []}
              />
            )}
          </>
        )}
      </aside>

      {closeMode && lead && config ? (
        <CloseLeadModal
          mode={closeMode}
          leadName={lead.name}
          config={config}
          saving={saving}
          onClose={() => setCloseMode(null)}
          initialWon={{
            wonValue: lead.wonValue != null ? Number(lead.wonValue) : undefined,
            wonStartAt: lead.wonStartAt,
            wonProducts: lead.wonProducts,
          }}
          initialLost={{ lossReason: lead.lossReason }}
          onSubmitWon={(data) => {
            setSaving(true);
            void reloadLeadAfterPatch({ stage: 'WON', ...data })
              .catch((e) => setError(e instanceof Error ? e.message : 'Close failed'))
              .finally(() => setSaving(false));
          }}
          onSubmitLost={(data) => {
            setSaving(true);
            void reloadLeadAfterPatch({ stage: 'LOST', ...data })
              .catch((e) => setError(e instanceof Error ? e.message : 'Close failed'))
              .finally(() => setSaving(false));
          }}
        />
      ) : null}
    </div>
  );
}
