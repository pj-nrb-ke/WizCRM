import {
  useCallback, useEffect, useRef, useState, type FormEvent,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ProspectDrawer } from '../components/lead-engine/ProspectDrawer';
import { api } from '../lib/api';
import { HeatMapTab } from '../components/lead-engine/HeatMapTab';
import type {
  Campaign, CampaignStatus, DiscoveryRun, EmailTemplate, Prospect, SequenceStep,
} from '../lib/lead-engine-types';

// ── Tier badge ─────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return <span className="badge badge-neutral">—</span>;
  const cls = tier === 'A' ? 'badge badge-success' : tier === 'B' ? 'badge badge-warn' : 'badge badge-info';
  return <span className={cls}>Tier {tier}</span>;
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, string> = {
    DRAFT: 'badge badge-neutral', ACTIVE: 'badge badge-success',
    PAUSED: 'badge badge-warn', CLOSED: 'badge badge-neutral',
  };
  return <span className={map[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

// ── Tag input (reused from LeadGeneratorPage) ──────────────────────────────

function TagInput({ label, placeholder, values, onChange }: {
  label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');
  function commit() {
    const tag = input.trim().replace(/,$/, '');
    if (tag && !values.includes(tag)) onChange([...values, tag]);
    setInput('');
  }
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', minHeight: 42 }}>
        {values.map((v) => (
          <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 6, padding: '2px 8px', fontSize: '0.8rem', fontWeight: 500 }}>
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
            else if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1));
          }}
          onBlur={commit}
          placeholder={values.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: 120, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem' }}
        />
      </div>
    </div>
  );
}

// ── Edit campaign modal ────────────────────────────────────────────────────

function EditCampaignModal({ campaign, onClose, onSaved }: {
  campaign: Campaign; onClose: () => void; onSaved: (updated: Campaign) => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [goal, setGoal] = useState(campaign.goal ?? '');
  const [keywords, setKeywords] = useState<string[]>((campaign.industryKeywords as string[]) ?? []);
  const [locations, setLocations] = useState<string[]>((campaign.locations as string[]) ?? []);
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<Campaign>(`/leadengine/campaigns/${campaign.id}`, {
        method: 'PUT',
        body: { name: name.trim(), goal: goal.trim() || null, industryKeywords: keywords, locations, status },
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1.1rem', fontWeight: 700 }}>Edit Campaign</h2>
        <form onSubmit={(e) => { void save(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Campaign name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Goal / description</label>
            <textarea className="input" value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
          </div>
          <TagInput
            label="Industry keywords (press Enter or comma to add)"
            placeholder="e.g. roofing contractor, hardware store…"
            values={keywords}
            onChange={setKeywords}
          />
          <TagInput
            label="Locations (press Enter or comma to add)"
            placeholder="e.g. Nairobi, Mombasa…"
            values={locations}
            onChange={setLocations}
          />
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          {error && <p style={{ color: 'var(--error)', margin: 0, fontSize: '0.85rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add prospect modal ─────────────────────────────────────────────────────

function AddProspectModal({
  open, campaignId, onClose, onAdded,
}: { open: boolean; campaignId: string; onClose: () => void; onAdded: () => void }) {
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCompanyName(''); setPhone(''); setWebsite(''); setAddress(''); setIndustry(''); setError('');
      setTimeout(() => ref.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await api(`/leadengine/campaigns/${campaignId}/prospects`, {
        method: 'POST',
        body: { companyName: companyName.trim(), phone: phone || undefined, website: website || undefined, address: address || undefined, industry: industry || undefined },
      });
      onAdded();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Add prospect manually</h2>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="field"><label>Company name *<input ref={ref} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required /></label></div>
          <div className="field"><label>Industry<input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. FMCG distributor" /></label></div>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label>Website<input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" /></label>
          </div>
          <div className="field"><label>Address<input value={address} onChange={(e) => setAddress(e.target.value)} /></label></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add prospect'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Email template modal ───────────────────────────────────────────────────

const MERGE_FIELDS = ['{{company_name}}', '{{contact_name}}', '{{sender_name}}', '{{campaign_name}}'];

function EmailTemplateModal({
  open, campaignId, onClose, onSaved,
}: { open: boolean; campaignId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) { setName(''); setSubject(''); setBody(''); setError(''); }
  }, [open]);

  if (!open) return null;

  function insertMerge(field: string) {
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + field); return; }
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + field + body.slice(e));
    setTimeout(() => { el.focus(); el.setSelectionRange(s + field.length, s + field.length); }, 0);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !body.trim()) { setError('Name, subject and body are all required'); return; }
    setSaving(true); setError('');
    try {
      await api('/leadengine/email-templates', {
        method: 'POST',
        body: { name: name.trim(), subject: subject.trim(), bodyHtml: body.trim(), campaignId },
      });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setSaving(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <h2>New email template</h2>
        {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="form-row" style={{ marginBottom: 14 }}>
            <label>Template name *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. First touch" required /></label>
            <label>Subject *<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Quick question for {{company_name}}" required /></label>
          </div>
          <div className="field">
            <label>Body *</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {MERGE_FIELDS.map((f) => (
                <button key={f} type="button" onClick={() => insertMerge(f)}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--primary-soft)', color: 'var(--primary)', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {f}
                </button>
              ))}
            </div>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Write your email here. Use merge fields above to personalise."
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save template'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Prospects tab ──────────────────────────────────────────────────────────

type ProspectsTabProps = {
  campaignId: string;
  prospects: Prospect[];
  loadingProspects: boolean;
  activeRun: DiscoveryRun | null;
  onRunDiscovery: () => void;
  onProspectClick: (id: string) => void;
  onRefresh: () => void;
};

function ProspectsTab({
  campaignId, prospects, loadingProspects, activeRun, onRunDiscovery, onProspectClick, onRefresh,
}: ProspectsTabProps) {
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [bulkError, setBulkError] = useState('');

  const filtered = prospects.filter((p) => {
    if (tierFilter && p.tier !== tierFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.companyName.toLowerCase().includes(q) || (p.industry ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulkImport() {
    setBulkError('');
    const ids = [...selected];
    try {
      const result = await api<{ imported: number; skipped: number; errors: string[] }>(
        `/leadengine/campaigns/${campaignId}/bulk-import`,
        { method: 'POST', body: { prospectIds: ids } },
      );
      if (result.errors.length) {
        setBulkError(`${result.imported} imported, ${result.skipped} skipped, ${result.errors.length} error(s).`);
      }
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Bulk import failed');
    }
    setSelected(new Set());
    onRefresh();
  }

  async function bulkSuppress() {
    if (!confirm(`Suppress ${selected.size} prospects?`)) return;
    await Promise.allSettled(
      [...selected].map((id) => api(`/leadengine/prospects/${id}/status`, { method: 'PATCH', body: { status: 'SUPPRESSED' } })),
    );
    setSelected(new Set());
    onRefresh();
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 14 }}>
        <input type="search" placeholder="Search company or industry…" value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} style={{ minWidth: 120 }}>
          <option value="">All tiers</option>
          <option value="A">Tier A</option>
          <option value="B">Tier B</option>
          <option value="C">Tier C</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ minWidth: 130 }}>
          <option value="">All statuses</option>
          <option value="NEW">New</option>
          <option value="ENRICHED">Enriched</option>
          <option value="EMAILED">Emailed</option>
          <option value="REPLIED">Replied</option>
          <option value="IMPORTED">Imported</option>
        </select>
        <button type="button" className="btn-secondary" onClick={() => setShowAdd(true)}>+ Add manually</button>
        <button
          type="button"
          className="btn-primary"
          onClick={onRunDiscovery}
          disabled={!!activeRun}
        >
          {activeRun ? 'Discovery running…' : '⚡ Run Discovery'}
        </button>
      </div>

      {/* Discovery progress banner */}
      {activeRun && (
        <div className="card-tip" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
            AI discovery is running — finding matching companies from Google Places…
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Refreshes automatically
          </span>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10, background: '#1e293b', color: '#f1f5f9',
          padding: '10px 16px', borderRadius: 10, marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          {bulkError && <span style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{bulkError}</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={bulkImport}
              style={{ padding: '6px 14px', borderRadius: 6, background: '#4f46e5', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
              → Import to Pipeline
            </button>
            <button type="button" onClick={bulkSuppress}
              style={{ padding: '6px 14px', borderRadius: 6, background: 'transparent', color: '#f87171', border: '1px solid #f87171', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
              Suppress
            </button>
            <button type="button" onClick={() => setSelected(new Set())}
              style={{ padding: '6px 10px', borderRadius: 6, background: 'transparent', color: '#94a3b8', border: '1px solid #334155', cursor: 'pointer', fontSize: '0.85rem' }}>
              Clear
            </button>
          </div>
        </div>
      )}

      {loadingProspects ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading prospects…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          {prospects.length === 0
            ? 'No prospects yet — click ⚡ Run Discovery to find matching companies.'
            : 'No prospects match your filters.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} />
                </th>
                <th>Company</th>
                <th>Sector</th>
                <th>Tier</th>
                <th>Score</th>
                <th>Phone</th>
                <th>Website</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="row-clickable" onClick={() => onProspectClick(p.id)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.companyName}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {p.industry ?? (p.sectorTags[0] ?? '—')}
                  </td>
                  <td><TierBadge tier={p.tier} /></td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{p.score}</td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {p.phone
                      ? <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary)' }}>{p.phone}</a>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {p.website
                      ? <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                          target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--primary)' }}>
                          {extractDomain(p.website)}
                        </a>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className={statusClass(p.status)}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddProspectModal
        open={showAdd}
        campaignId={campaignId}
        onClose={() => setShowAdd(false)}
        onAdded={() => { setShowAdd(false); onRefresh(); }}
      />
    </div>
  );
}

// ── Outreach tab ───────────────────────────────────────────────────────────

type SendResult = { sent: number; skipped: number; failed: number; errors: string[] };
type EligibleCount = { eligible: number; noEmail: number; alreadySent: number };

function OutreachTab({
  campaignId, templates, sequences, onTemplatesChange, onSequencesChange,
}: {
  campaignId: string;
  templates: EmailTemplate[];
  sequences: SequenceStep[];
  onTemplatesChange: () => void;
  onSequencesChange: () => void;
}) {
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [savingSeq, setSavingSeq] = useState(false);
  const [seqError, setSeqError] = useState('');
  const [sendingStep, setSendingStep] = useState<number | null>(null);
  const [sendResults, setSendResults] = useState<Record<number, SendResult>>({});
  const [eligible, setEligible] = useState<Record<number, EligibleCount>>({});
  const [steps, setSteps] = useState<Array<{ stepNumber: number; delayDays: number; templateId: string }>>([
    { stepNumber: 1, delayDays: 0,  templateId: '' },
    { stepNumber: 2, delayDays: 5,  templateId: '' },
    { stepNumber: 3, delayDays: 10, templateId: '' },
  ]);

  useEffect(() => {
    if (sequences.length > 0) {
      setSteps(sequences.map((s) => ({ stepNumber: s.stepNumber, delayDays: s.delayDays, templateId: s.template?.id ?? '' })));
    }
  }, [sequences]);

  // Load eligible counts for each configured step
  useEffect(() => {
    const configured = steps.filter((s) => s.templateId);
    if (configured.length === 0) return;
    configured.forEach(async (s) => {
      try {
        const data = await api<EligibleCount>(`/leadengine/campaigns/${campaignId}/send-preview/${s.stepNumber}`);
        setEligible((prev) => ({ ...prev, [s.stepNumber]: data }));
      } catch {}
    });
  }, [campaignId, steps]);

  function setStepTemplate(stepNumber: number, templateId: string) {
    setSteps((prev) => prev.map((s) => s.stepNumber === stepNumber ? { ...s, templateId } : s));
  }

  async function saveSequence() {
    setSavingSeq(true); setSeqError('');
    try {
      const filled = steps.filter((s) => s.templateId);
      await api(`/leadengine/campaigns/${campaignId}/sequences`, {
        method: 'PUT',
        body: { steps: filled },
      });
      onSequencesChange();
    } catch (e) {
      setSeqError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingSeq(false);
    }
  }

  async function sendStep(stepNumber: number) {
    const info = eligible[stepNumber];
    if (info && info.eligible === 0) {
      alert('No eligible prospects to send to. Add contacts with email addresses first.');
      return;
    }
    const count = info?.eligible ?? '?';
    if (!confirm(`Send Step ${stepNumber} to ${count} prospect(s) now?`)) return;
    setSendingStep(stepNumber);
    try {
      const result = await api<SendResult>(`/leadengine/campaigns/${campaignId}/send/${stepNumber}`, { method: 'POST' });
      setSendResults((prev) => ({ ...prev, [stepNumber]: result }));
      // Refresh eligible counts after send
      const updated = await api<EligibleCount>(`/leadengine/campaigns/${campaignId}/send-preview/${stepNumber}`);
      setEligible((prev) => ({ ...prev, [stepNumber]: updated }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Send failed — check email configuration');
    } finally {
      setSendingStep(null);
    }
  }

  const STEP_LABELS = ['Day 0 — First touch', 'Day 5 — Follow-up', 'Day 10 — Final nudge'];

  return (
    <div>
      {/* Templates */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Email Templates</h3>
        <button type="button" className="btn-secondary" onClick={() => setShowNewTemplate(true)}>+ New template</button>
      </div>

      {templates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 28, color: 'var(--text-muted)' }}>
          No templates yet. Create one to build your sequence.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {templates.map((t) => (
            <div key={t.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{t.subject}</div>
                </div>
                {t.mergeFields.length > 0 && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.mergeFields.map((f) => (
                      <span key={f} style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 4, fontFamily: 'monospace' }}>
                        {`{{${f}}}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sequence */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Campaign Sequence</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Stops automatically on reply</span>
      </div>

      {seqError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{seqError}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {steps.map((step, i) => {
          const info = eligible[step.stepNumber];
          const result = sendResults[step.stepNumber];
          const isSending = sendingStep === step.stepNumber;
          return (
            <div key={step.stepNumber} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-soft)',
                  color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                }}>
                  {step.stepNumber}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{STEP_LABELS[i]}</div>
                  <select
                    value={step.templateId}
                    onChange={(e) => setStepTemplate(step.stepNumber, e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">— No template assigned —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} · {t.subject}</option>
                    ))}
                  </select>
                </div>
                {step.templateId && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => { void sendStep(step.stepNumber); }}
                      disabled={isSending || sendingStep !== null}
                      style={{ minWidth: 110, fontSize: '0.82rem', padding: '6px 12px' }}
                    >
                      {isSending ? 'Sending…' : '✉ Send now'}
                    </button>
                    {info && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {info.eligible} ready · {info.alreadySent} sent · {info.noEmail} no email
                      </span>
                    )}
                  </div>
                )}
              </div>
              {result && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 6,
                  background: result.failed > 0 ? '#fff7ed' : '#f0fdf4',
                  border: `1px solid ${result.failed > 0 ? '#fdba74' : '#86efac'}`,
                  fontSize: '0.82rem',
                }}>
                  <strong>{result.sent} sent</strong>
                  {result.skipped > 0 && <span style={{ color: 'var(--text-muted)' }}> · {result.skipped} skipped</span>}
                  {result.failed > 0 && <span style={{ color: 'var(--error)' }}> · {result.failed} failed</span>}
                  {result.errors.slice(0, 2).map((e, idx) => (
                    <div key={idx} style={{ color: 'var(--error)', marginTop: 4 }}>{e}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="btn-primary" onClick={saveSequence} disabled={savingSeq}>
        {savingSeq ? 'Saving…' : 'Save sequence'}
      </button>

      <EmailTemplateModal
        open={showNewTemplate}
        campaignId={campaignId}
        onClose={() => setShowNewTemplate(false)}
        onSaved={() => { setShowNewTemplate(false); onTemplatesChange(); }}
      />
    </div>
  );
}

// ── Results tab ────────────────────────────────────────────────────────────

type EmailStats = {
  sent: number; opened: number; clicked: number; replied: number; failed: number;
  byStep: Array<{ step: number; sent: number }>;
};

function ResultsTab({ campaignId }: { campaignId: string }) {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api<EmailStats>(`/leadengine/campaigns/${campaignId}/email-stats`)
      .then(setStats)
      .catch(() => setStats({ sent: 0, opened: 0, clicked: 0, replied: 0, failed: 0, byStep: [] }))
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const s = stats ?? { sent: 0, opened: 0, clicked: 0, replied: 0, failed: 0, byStep: [] };
  const metrics = [
    { label: 'Emails sent',  value: s.sent,    color: 'var(--primary)' },
    { label: 'Opened',       value: s.opened,  color: 'var(--success)' },
    { label: 'Clicked',      value: s.clicked, color: '#8b5cf6' },
    { label: 'Replied',      value: s.replied, color: '#f59e0b' },
  ];

  return (
    <div>
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Email Performance</h3>
            <button type="button" className="btn-secondary" onClick={load} style={{ fontSize: '0.8rem' }}>
              ↻ Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
            {metrics.map((m) => (
              <div key={m.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>{m.label}</div>
                {m.label === 'Emails sent' && s.sent > 0 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {s.failed > 0 && <span style={{ color: 'var(--error)' }}>{s.failed} failed</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {s.byStep.some((b) => b.sent > 0) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                BY SEQUENCE STEP
              </h3>
              <div style={{ display: 'flex', gap: 12 }}>
                {s.byStep.map((b) => (
                  <div key={b.step} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 12px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{b.sent}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Step {b.step}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {s.sent === 0 && (
            <div className="card-tip" style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                <strong>No emails sent yet.</strong> Go to the Email Outreach tab, assign templates to your sequence steps, and click <em>Send now</em>.
              </p>
            </div>
          )}

          {s.sent > 0 && s.opened === 0 && (
            <div className="card-tip" style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Opens and clicks are tracked via Brevo webhooks — set up Phase 7 to see engagement data here.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

type Tab = 'prospects' | 'outreach' | 'results' | 'heatmap';

export function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [sequences, setSequences] = useState<SequenceStep[]>([]);
  const [activeRun, setActiveRun] = useState<DiscoveryRun | null>(null);

  const [tab, setTab] = useState<Tab>('prospects');
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [loadingProspects, setLoadingProspects] = useState(false);
  const [error, setError] = useState('');
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const loadCampaign = useCallback(() => {
    if (!campaignId) return;
    api<Campaign>(`/leadengine/campaigns/${campaignId}`)
      .then((c) => { setCampaign(c); setSequences(c.sequences ?? []); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load campaign'))
      .finally(() => setLoadingCampaign(false));
  }, [campaignId]);

  const loadProspects = useCallback(() => {
    if (!campaignId) return;
    setLoadingProspects(true);
    api<{ prospects: Prospect[] }>(`/leadengine/campaigns/${campaignId}/prospects`)
      .then((d) => setProspects(d.prospects))
      .catch(() => {})
      .finally(() => setLoadingProspects(false));
  }, [campaignId]);

  const loadTemplates = useCallback(() => {
    api<EmailTemplate[]>('/leadengine/email-templates')
      .then(setTemplates)
      .catch(() => {});
  }, []);

  useEffect(() => { loadCampaign(); }, [loadCampaign]);
  useEffect(() => { loadProspects(); }, [loadProspects]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Poll active discovery run
  useEffect(() => {
    if (!activeRun) return;
    const interval = setInterval(async () => {
      try {
        const run = await api<DiscoveryRun>(`/leadengine/runs/${activeRun.id}`);
        if (run.status === 'COMPLETED' || run.status === 'FAILED') {
          setActiveRun(null);
          loadProspects();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeRun, loadProspects]);

  async function runDiscovery() {
    if (!campaignId) return;
    try {
      const result = await api<{ runId: string; status: string }>(
        `/leadengine/campaigns/${campaignId}/discover`,
        { method: 'POST' },
      );
      setActiveRun({ id: result.runId, status: 'RUNNING', resultsCount: 0, startedAt: new Date().toISOString(), finishedAt: null, error: null });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to start discovery');
    }
  }

  if (loadingCampaign) {
    return <div className="page-wide"><p style={{ color: 'var(--text-muted)', padding: '40px 0' }}>Loading campaign…</p></div>;
  }

  if (error || !campaign) {
    return (
      <div className="page-wide">
        <button type="button" className="btn-secondary" onClick={() => navigate('/lead-generator')}>← Back</button>
        <p className="alert alert-error" style={{ marginTop: 16 }}>{error || 'Campaign not found'}</p>
      </div>
    );
  }

  return (
    <div className="page-wide">
      <PageHeader
        title={campaign.name}
        subtitle={campaign.goal ?? undefined}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={campaign.status} />
            <button type="button" className="btn-secondary" onClick={() => setShowEdit(true)}>
              ✎ Edit
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/lead-generator')}>
              ← All campaigns
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="drawer-tabs" style={{ marginBottom: 24 }} role="tablist">
        {([['prospects', 'Prospects'], ['outreach', 'Email Outreach'], ['results', 'Results'], ['heatmap', '🔥 Heat Map']] as [Tab, string][]).map(
          ([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key}
              className={tab === key ? 'drawer-tab active' : 'drawer-tab'}
              onClick={() => setTab(key)}>
              {label}
              {key === 'prospects' && prospects.length > 0 && (
                <span style={{ marginLeft: 6, background: 'var(--primary-soft)', color: 'var(--primary)',
                  borderRadius: 10, padding: '1px 6px', fontSize: '0.72rem', fontWeight: 700 }}>
                  {prospects.length}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {/* Tab content */}
      {tab === 'prospects' && (
        <ProspectsTab
          campaignId={campaign.id}
          prospects={prospects}
          loadingProspects={loadingProspects}
          activeRun={activeRun}
          onRunDiscovery={runDiscovery}
          onProspectClick={setSelectedProspectId}
          onRefresh={loadProspects}
        />
      )}
      {tab === 'outreach' && (
        <OutreachTab
          campaignId={campaign.id}
          templates={templates}
          sequences={sequences}
          onTemplatesChange={loadTemplates}
          onSequencesChange={() => { loadTemplates(); loadCampaign(); }}
        />
      )}
      {tab === 'results' && <ResultsTab campaignId={campaign.id} />}
      {tab === 'heatmap' && <HeatMapTab campaignId={campaign.id} />}

      {/* Prospect detail drawer */}
      <ProspectDrawer
        prospectId={selectedProspectId}
        onClose={() => setSelectedProspectId(null)}
        onImported={loadProspects}
      />

      {/* Edit campaign modal */}
      {showEdit && (
        <EditCampaignModal
          campaign={campaign}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setCampaign(updated); setShowEdit(false); }}
        />
      )}
    </div>
  );
}

// ── Utility ────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    NEW: 'badge badge-neutral', QUALIFIED: 'badge badge-info', ENRICHED: 'badge badge-info',
    EMAILED: 'badge badge-warn', REPLIED: 'badge badge-success', IMPORTED: 'badge badge-success',
    REJECTED: 'badge badge-neutral', SUPPRESSED: 'badge badge-neutral',
  };
  return map[status] ?? 'badge badge-neutral';
}
