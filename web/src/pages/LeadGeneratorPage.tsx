import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import type { Campaign, CampaignStatus } from '../lib/lead-engine-types';

// ── Tag input ──────────────────────────────────────────────────────────────

function TagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState('');

  function commit() {
    const tag = input.trim().replace(/,$/, '');
    if (tag && !values.includes(tag)) onChange([...values, tag]);
    setInput('');
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !input && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
        {label}
      </label>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          padding: '8px 10px',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          background: 'var(--surface)',
          minHeight: 42,
        }}
      >
        {values.map((v) => (
          <span
            key={v}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', lineHeight: 1 }}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          placeholder={values.length ? '' : placeholder}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 120, fontSize: '0.9rem', background: 'transparent' }}
        />
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Press Enter or comma to add
      </p>
    </div>
  );
}

// ── Create campaign modal ──────────────────────────────────────────────────

function CreateCampaignModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(''); setGoal(''); setKeywords([]); setLocations([]);
      setSizeMin(''); setSizeMax(''); setError('');
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Campaign name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await api<Campaign>('/leadengine/campaigns', {
        method: 'POST',
        body: {
          name: name.trim(),
          goal: goal.trim() || undefined,
          industryKeywords: keywords,
          locations,
          sizeMin: sizeMin ? Number(sizeMin) : undefined,
          sizeMax: sizeMax ? Number(sizeMax) : undefined,
        },
      });
      onCreated(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create campaign');
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px' }}>New campaign</h2>
        <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Define your target audience and the AI will find matching prospects.
        </p>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Campaign name *
              <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. WizCRM prospects — Nairobi Q3" required />
            </label>
          </div>

          <div className="field">
            <label>Goal
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Find mid-market Nairobi firms likely to need a CRM upgrade"
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </label>
          </div>

          <div className="field">
            <TagInput
              label="Industry keywords"
              placeholder="e.g. wholesale distribution, FMCG, manufacturing…"
              values={keywords}
              onChange={setKeywords}
            />
          </div>

          <div className="field">
            <TagInput
              label="Target locations"
              placeholder="e.g. Nairobi Industrial Area, Mombasa Road…"
              values={locations}
              onChange={setLocations}
            />
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <label>Min staff size
              <input type="number" min={1} value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} placeholder="e.g. 30" />
            </label>
            <label>Max staff size
              <input type="number" min={1} value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} placeholder="e.g. 500" />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, { label: string; cls: string }> = {
    DRAFT:  { label: 'Draft',  cls: 'badge badge-neutral' },
    ACTIVE: { label: 'Active', cls: 'badge badge-success' },
    PAUSED: { label: 'Paused', cls: 'badge badge-warn'    },
    CLOSED: { label: 'Closed', cls: 'badge badge-neutral' },
  };
  const { label, cls } = map[status];
  return <span className={cls}>{label}</span>;
}

// ── Main page ──────────────────────────────────────────────────────────────

export function LeadGeneratorPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<Campaign[]>('/leadengine/campaigns')
      .then(setCampaigns)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleCreated(id: string) {
    setShowCreate(false);
    navigate(`/lead-generator/${id}`);
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Lead Generator"
        subtitle="AI-powered prospect discovery, scoring, and outreach — all in one place."
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Campaign
          </button>
        }
      />

      {error && <p className="alert alert-error">{error}</p>}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: '40px 0' }}>Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <EmptyState onNew={() => setShowCreate(true)} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
            marginTop: 24,
          }}
        >
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} onClick={() => navigate(`/lead-generator/${c.id}`)} />
          ))}
        </div>
      )}

      <CreateCampaignModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={handleCreated} />
    </div>
  );
}

// ── Campaign card ──────────────────────────────────────────────────────────

function CampaignCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  const stats = campaign.stats;

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(79,70,229,0.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
          {campaign.name}
        </h3>
        <StatusBadge status={campaign.status} />
      </div>

      {campaign.goal && (
        <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {campaign.goal}
        </p>
      )}

      {campaign.industryKeywords?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
          {campaign.industryKeywords.slice(0, 3).map((kw) => (
            <span key={kw} style={{
              fontSize: '0.72rem', background: 'var(--primary-soft)', color: 'var(--primary)',
              borderRadius: 4, padding: '2px 6px', fontWeight: 500,
            }}>{kw}</span>
          ))}
          {campaign.industryKeywords.length > 3 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '2px 4px' }}>
              +{campaign.industryKeywords.length - 3} more
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <Stat label="Prospects" value={stats?.prospects ?? campaign._count?.prospects ?? 0} />
        <Stat label="Sent" value={stats?.emailed ?? 0} />
        <Stat label="Replied" value={stats?.replied ?? 0} color={stats?.replied ? 'var(--success)' : undefined} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
        background: 'var(--primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.75 17L8 21l2.25-1 2.25 1-.75-4M14 10l2-6 2 6-2 1.5L14 10zM6 10l2-6 2 6-2 1.5L6 10z" />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>No campaigns yet</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
        Create your first campaign to start discovering and reaching out to prospects with AI.
      </p>
      <button type="button" className="btn-primary" onClick={onNew}>
        + Create your first campaign
      </button>
    </div>
  );
}
