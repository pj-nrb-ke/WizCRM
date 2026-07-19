import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEAD_STAGES } from '../lib/stages';
import { api } from '../lib/api';
import type { LeadSummary } from '../lib/types';
import { SalesOpportunityForm } from './SalesOpportunityForm';
import { SALES_OPP_STAGE_LABELS, SALES_OPP_STATUS_LABELS } from '../lib/opportunity-labels';
import { CloseLeadModal, type CrmConfig } from './CloseLeadModal';
import { LogActivityForm } from './LogActivityForm';
import { CloseOutcomeBanner, LeadAuditTrail } from './LeadAuditTrail';
import { LeadQuotations } from './LeadQuotations';
import { LeadTagsEditor } from './LeadTagsEditor';
import { useAuth } from '../lib/auth';
import { isManager } from '../lib/roles';
import { LeadInsightsPanel } from './LeadInsightsPanel';
import { CommunicationDraftPanel } from './CommunicationDraftPanel';
import { LeadNextActionPanel } from './LeadNextActionPanel';
import { DecisionMakersPanel } from './DecisionMakersPanel';
import { LeadTeamChat } from './LeadTeamChat';
import { EditLeadModal } from './EditLeadModal';
import { OpportunityTasks } from './OpportunityTasks';
import { OpportunityExpenses } from './OpportunityExpenses';
import { OpportunitySummaryStrip } from './OpportunitySummaryStrip';
import { OpportunityCommission } from './OpportunityCommission';

type LeadDetail = LeadSummary & {
  createdAt?: string;
  wonValue?: number | string | null;
  wonStartAt?: string | null;
  wonProducts?: string | null;
  lossReason?: string | null;
  tags?: string[];
  extraPhones?: unknown;
  extraEmails?: unknown;
  address?: string | null;
  owner?: { id: string; name: string; email?: string };
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

type AssignableUser = { id: string; name: string; email: string };

export function LeadDrawer({ leadId, onClose, onUpdated }: Props) {
  const { user, entitlements } = useAuth();
  const manager = isManager(user?.role);
  const proInsights = entitlements?.features.leadInsights ?? false;
  const proDrafts = entitlements?.features.communicationDrafts ?? false;
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [config, setConfig] = useState<CrmConfig | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
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
      owner?: { id: string; name: string };
    }[]
  >([]);
  const [expenseRefreshKey, setExpenseRefreshKey] = useState(0);
  const [leadCostRollup, setLeadCostRollup] = useState<{
    budgeted: number;
    spent: number;
    revenue: number;
    margin: number;
    opportunityCount: number;
  } | null>(null);
  const [showOppForm, setShowOppForm] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [expandedOppId, setExpandedOppId] = useState<string | null>(null);

  async function reloadLead(id: string) {
    const d = await api<{ lead: LeadDetail }>(`/leads/${id}`);
    setLead(d.lead);
    setStage(d.lead.stage);
    setTags(d.lead.tags ?? []);
    setOwnerId(d.lead.owner?.id ?? '');
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
    if (isManager(user?.role)) {
      api<{ users: AssignableUser[] }>('/teams/assignable-users')
        .then((d) => setAssignableUsers(d.users ?? []))
        .catch(() => setAssignableUsers([]));
    }
    setShowOppForm(false);
  }, [leadId, user?.role]);

  useEffect(() => {
    if (!leadId || !manager) {
      setLeadCostRollup(null);
      return;
    }
    api<typeof leadCostRollup>(`/opportunities/lead/${leadId}/cost-rollup`)
      .then(setLeadCostRollup)
      .catch(() => setLeadCostRollup(null));
  }, [leadId, manager, expenseRefreshKey]);

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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0 }}>{lead.name}</h2>
                {lead.company ? <p className="muted" style={{ margin: 0 }}>{lead.company}</p> : null}
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setEditOpen(true)}>
                Edit
              </button>
            </div>
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
                  <dd>
                    {manager && assignableUsers.length > 0 ? (
                      <>
                        <select
                          value={ownerId}
                          onChange={(e) => setOwnerId(e.target.value)}
                        >
                          {assignableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        {ownerId && ownerId !== lead.owner?.id ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ marginTop: 8 }}
                            disabled={saving}
                            onClick={() => {
                              setSaving(true);
                              void reloadLeadAfterPatch({ ownerId })
                                .catch((e) =>
                                  setError(e instanceof Error ? e.message : 'Reassign failed'),
                                )
                                .finally(() => setSaving(false));
                            }}
                          >
                            Reassign owner
                          </button>
                        ) : null}
                      </>
                    ) : (
                      (lead.owner?.name ?? '—')
                    )}
                  </dd>
                  <dt>Tags</dt>
                  <dd>
                    <LeadTagsEditor
                      tags={tags}
                      suggestions={config?.leadTags ?? []}
                      disabled={saving}
                      onChange={setTags}
                    />
                    {JSON.stringify(tags) !== JSON.stringify(lead.tags ?? []) ? (
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ marginTop: 8 }}
                        disabled={saving}
                        onClick={() => {
                          setSaving(true);
                          void reloadLeadAfterPatch({ tags })
                            .catch((e) => setError(e instanceof Error ? e.message : 'Save failed'))
                            .finally(() => setSaving(false));
                        }}
                      >
                        Save tags
                      </button>
                    ) : null}
                  </dd>
                  <dt>Email</dt>
                  <dd>
                    {lead.email ?? '—'}
                    {Array.isArray(lead.extraEmails) && lead.extraEmails.length > 0
                      ? (lead.extraEmails as string[]).map((e) => (
                          <div key={e} className="muted">{e}</div>
                        ))
                      : null}
                  </dd>
                  <dt>Phone</dt>
                  <dd>
                    {lead.phone ?? '—'}
                    {Array.isArray(lead.extraPhones) && lead.extraPhones.length > 0
                      ? (lead.extraPhones as string[]).map((p) => (
                          <div key={p} className="muted">{p}</div>
                        ))
                      : null}
                  </dd>
                  <dt>Address</dt>
                  <dd>{lead.address ?? '—'}</dd>
                  <dt>Source</dt>
                  <dd><LeadSource source={lead.source} /></dd>
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
                {leadCostRollup && leadCostRollup.opportunityCount > 0 ? (
                  <p className="muted">
                    Across {leadCostRollup.opportunityCount} opportunit
                    {leadCostRollup.opportunityCount === 1 ? 'y' : 'ies'} on this lead: budget{' '}
                    {leadCostRollup.budgeted.toLocaleString()} · spent {leadCostRollup.spent.toLocaleString()} ·
                    revenue {leadCostRollup.revenue.toLocaleString()} · margin{' '}
                    {leadCostRollup.margin.toLocaleString()}
                  </p>
                ) : null}
                {showOppForm ? (
                  <SalesOpportunityForm
                    leadId={lead.id}
                    leadName={lead.name}
                    canSetBudget={manager}
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
                  <ul className="mini-list opportunity-list">
                    {opportunities.map((o) => {
                      const expanded = expandedOppId === o.id;
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            className="link-btn"
                            style={{ textAlign: 'left', width: '100%' }}
                            onClick={() => setExpandedOppId(expanded ? null : o.id)}
                            aria-expanded={expanded}
                          >
                            {expanded ? '▾' : '▸'} <strong>{o.referenceNumber}</strong> — {o.description.slice(0, 80)}
                            <span className="muted">
                              {' '}
                              · {SALES_OPP_STAGE_LABELS[o.oppStage] ?? o.oppStage} ·{' '}
                              {SALES_OPP_STATUS_LABELS[o.oppStatus] ?? o.oppStatus}
                            </span>
                          </button>
                          {expanded ? (
                            <div className="opportunity-card" style={{ padding: '12px 0 0 20px' }}>
                              <OpportunitySummaryStrip
                                opportunityId={o.id}
                                canView={manager || o.owner?.id === user?.id}
                                refreshKey={expenseRefreshKey}
                              />
                              <LeadTeamChat
                                leadId={lead.id}
                                leadName={lead.name}
                                opportunityId={o.id}
                                showDocumentTypeTag
                                onAttachmentUploaded={() => setExpenseRefreshKey((k) => k + 1)}
                              />
                              <OpportunityTasks opportunityId={o.id} />
                              <OpportunityExpenses
                                opportunityId={o.id}
                                canLog={o.owner?.id === user?.id}
                                onChanged={() => setExpenseRefreshKey((k) => k + 1)}
                              />
                              <OpportunityCommission
                                opportunityId={o.id}
                                canManage={manager}
                                refreshKey={expenseRefreshKey}
                              />
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted">No sales opportunities yet.</p>
                )}

                <DecisionMakersPanel leadId={lead.id} />

                {proInsights ? (
                  <>
                    <LeadInsightsPanel leadId={lead.id} />
                    <LeadNextActionPanel leadId={lead.id} />
                  </>
                ) : null}
                {proDrafts ? (
                  <CommunicationDraftPanel
                    leadId={lead.id}
                    leadEmail={lead.email}
                    leadPhone={lead.phone}
                  />
                ) : null}

                <LeadTeamChat leadId={lead.id} leadName={lead.name} />

                <LeadQuotations leadId={lead.id} />
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

      <EditLeadModal
        open={editOpen}
        lead={lead}
        config={config}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setLead(updated as LeadDetail);
          onUpdated?.();
        }}
      />
    </div>
  );
}

function LeadSource({ source }: { source?: string | null }) {
  if (!source) return <span>—</span>;
  if (source.startsWith('lead_generator:')) {
    const campaignId = source.slice('lead_generator:'.length);
    return (
      <Link
        to={`/lead-generator/${campaignId}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--primary)', textDecoration: 'none' }}
      >
        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>Lead Generator</span>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>↗ view campaign</span>
      </Link>
    );
  }
  return <span>{source}</span>;
}
