import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { IntentSignal, IntentStrength, SignalSource } from '../../lib/lead-engine-types';

// ── Kenya map ──────────────────────────────────────────────────────────────

const MAP_W = 380, MAP_H = 340;
function toX(lng: number) { return ((lng - 33.9) / 8.0) * MAP_W; }
function toY(lat: number) { return ((4.6  - lat) / 9.3) * MAP_H; }

const CITIES = [
  { name: 'Nairobi',  lat: -1.2921, lng: 36.8219 },
  { name: 'Mombasa',  lat: -4.0435, lng: 39.6682 },
  { name: 'Kisumu',   lat: -0.0917, lng: 34.7680 },
  { name: 'Nakuru',   lat: -0.3031, lng: 36.0800 },
  { name: 'Eldoret',  lat:  0.5143, lng: 35.2698 },
  { name: 'Nyeri',    lat: -0.4167, lng: 36.9500 },
  { name: 'Malindi',  lat: -3.2175, lng: 40.1169 },
  { name: 'Thika',    lat: -1.0332, lng: 37.0693 },
  { name: 'Machakos', lat: -1.5177, lng: 37.2634 },
  { name: 'Kisii',    lat: -0.6817, lng: 34.7667 },
];

const KENYA_PATH = 'M 162,18 L 210,10 L 280,30 L 320,60 L 330,110 L 310,150 L 290,195 L 270,250 L 230,295 L 185,308 L 140,300 L 95,270 L 60,230 L 40,190 L 30,150 L 38,110 L 55,75 L 85,45 Z';

// ── Source metadata (plain-English labels for each source) ─────────────────

const SOURCE_META: Record<string, { icon: string; label: string; description: string; color: string; border: string; bg: string }> = {
  tavily:       { icon: '🔍', label: 'Web Intelligence',      description: 'AI web search — forums, news, B2B sites (10 targeted queries)',   color: '#854d0e', border: '#fde047', bg: '#fefce8' },
  linkedin:     { icon: '💼', label: 'LinkedIn Signal',        description: 'LinkedIn posts & profiles of buyers actively discussing the need', color: '#0369a1', border: '#7dd3fc', bg: '#f0f9ff' },
  new_business: { icon: '🏢', label: 'New Business',           description: 'Newly registered or opened company — prime ERP adoption target',  color: '#7c3aed', border: '#c4b5fd', bg: '#faf5ff' },
  ppra:         { icon: '📋', label: 'Government Tender',      description: 'Official procurement posted on PPRA Kenya portal',                color: '#b91c1c', border: '#fca5a5', bg: '#fef2f2' },
  tenderskenya: { icon: '📋', label: 'Government Tender',      description: 'Aggregated public tender from TendersKenya.co.ke',                color: '#b91c1c', border: '#fca5a5', bg: '#fef2f2' },
  reddit:       { icon: '💬', label: 'Community Discussion',   description: 'Public post on Reddit — r/Kenya, r/nairobi, r/africa',            color: '#c2410c', border: '#fdba74', bg: '#fff7ed' },
  google_search:{ icon: '🌐', label: 'Forum / Article',        description: 'Web forum thread or article about sourcing this product',         color: '#166534', border: '#86efac', bg: '#f0fdf4' },
};

function getSourceMeta(platform: string) {
  return SOURCE_META[platform] ?? { icon: '📡', label: platform, description: 'Signal from external source', color: '#475569', border: '#94a3b8', bg: '#f8fafc' };
}

// ── Intent strength colours ────────────────────────────────────────────────

const STRENGTH_COLOR: Record<IntentStrength, string> = { HOT: '#ef4444', WARM: '#f97316', MEDIUM: '#6366f1' };
const STRENGTH_LABEL: Record<IntentStrength, string> = { HOT: '🔴 Hot — formal buying intent', WARM: '🟠 Warm — expressed need', MEDIUM: '🔵 Medium — research phase' };

// ── Apollo contact type ────────────────────────────────────────────────────

interface ApolloContact {
  name: string; title: string; email: string | null;
  phone: string | null; linkedinUrl: string | null;
  company: string | null; companySize: string | null; industry: string | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SourceChip({ platform }: { platform: string }) {
  const m = getSourceMeta(platform);
  return (
    <span title={m.description} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.65rem',
      fontWeight: 700, padding: '2px 8px', borderRadius: 10, cursor: 'help',
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function StrengthChip({ strength }: { strength: IntentStrength }) {
  return (
    <span title={STRENGTH_LABEL[strength]} style={{
      fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: STRENGTH_COLOR[strength] + '18', color: STRENGTH_COLOR[strength],
      border: `1px solid ${STRENGTH_COLOR[strength]}40`, cursor: 'help',
    }}>
      {strength}
    </span>
  );
}

function ContactCard({ contact }: { contact: ApolloContact }) {
  return (
    <div style={{
      marginTop: 10, padding: '10px 12px', borderRadius: 8,
      background: '#fdf4ff', border: '1px solid #d8b4fe',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '1rem' }}>👤</span>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{contact.name}</div>
          <div style={{ fontSize: '0.7rem', color: '#6b21a8' }}>{contact.title}</div>
        </div>
        {contact.company && (
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#7c3aed', fontWeight: 600 }}>
            {contact.company}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '0.7rem' }}>
        {contact.email && (
          <a href={`mailto:${contact.email}`} style={{ color: '#7c3aed', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
            ✉ {contact.email}
          </a>
        )}
        {contact.phone && <span style={{ color: '#475569' }}>📞 {contact.phone}</span>}
        {contact.linkedinUrl && (
          <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: '#0369a1', textDecoration: 'none' }}>↗ LinkedIn</a>
        )}
      </div>
      {(contact.companySize || contact.industry) && (
        <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 5 }}>
          {[contact.industry, contact.companySize ? `${contact.companySize} employees` : null].filter(Boolean).join(' · ')}
        </div>
      )}
    </div>
  );
}

function SignalCard({
  signal, selected, onSelect, onDismiss,
}: {
  signal: IntentSignal; selected: boolean; onSelect: () => void; onDismiss: () => void;
}) {
  const [loadingContact, setLoadingContact] = useState(false);
  const [contact, setContact]               = useState<ApolloContact | null>(null);
  const [contactError, setContactError]     = useState('');

  const ago = signal.publishedAt
    ? (() => { const d = Math.floor((Date.now() - new Date(signal.publishedAt).getTime()) / 86400000); return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`; })()
    : null;

  async function getContacts(e: React.MouseEvent) {
    e.stopPropagation();
    setLoadingContact(true);
    setContactError('');
    try {
      const res = await api<{ contact: ApolloContact }>(`/leadengine/signals/${signal.id}/contacts`, { method: 'POST' });
      setContact(res.contact);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'No contact found');
    } finally {
      setLoadingContact(false);
    }
  }

  const meta = getSourceMeta(signal.platform);

  return (
    <div onClick={onSelect} style={{
      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
      border: `1.5px solid ${selected ? STRENGTH_COLOR[signal.intentStrength] : 'var(--border-color, #e5e7eb)'}`,
      background: selected ? STRENGTH_COLOR[signal.intentStrength] + '08' : 'var(--surface, #fff)',
      transition: 'border-color 0.15s',
    }}>

      {/* Header row */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <StrengthChip strength={signal.intentStrength} />
        <SourceChip platform={signal.platform} />
        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #94a3b8)', marginLeft: 'auto' }}>
          {ago ?? 'recently'}
        </span>
      </div>

      {/* Title */}
      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4, marginBottom: signal.snippet ? 4 : 0 }}>
        {signal.title}
      </p>

      {/* Snippet */}
      {signal.snippet && (
        <p style={{
          margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary, #666)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {signal.snippet}
        </p>
      )}

      {/* Source description (plain English) */}
      <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: 'var(--text-secondary, #94a3b8)', fontStyle: 'italic' }}>
        {meta.icon} {meta.description}
      </p>

      {signal.location && (
        <p style={{ margin: '3px 0 0', fontSize: '0.67rem', color: 'var(--text-secondary, #94a3b8)' }}>
          📍 {signal.location}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <a href={signal.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '0.72rem', color: 'var(--primary, #6366f1)', textDecoration: 'none', fontWeight: 500 }}>
          ↗ View source
        </a>

        {!contact && (
          <button type="button" onClick={(e) => void getContacts(e)} disabled={loadingContact}
            style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              background: '#fdf4ff', color: '#7c3aed', border: '1px solid #d8b4fe',
              opacity: loadingContact ? 0.6 : 1,
            }}>
            {loadingContact ? '⏳ Looking up…' : '👤 Get Contact'}
          </button>
        )}

        {contactError && (
          <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>{contactError}</span>
        )}

        <button type="button" onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{ marginLeft: 'auto', fontSize: '0.67rem', background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', padding: 0 }}>
          Dismiss
        </button>
      </div>

      {/* Apollo contact result */}
      {contact && <ContactCard contact={contact} />}
    </div>
  );
}

function KenyaMap({ signals, selected, onSelect }: {
  signals: IntentSignal[]; selected: string | null; onSelect: (id: string) => void;
}) {
  const mappable = signals.filter((s) => s.lat !== null && s.lng !== null);
  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block' }}>
      <rect width={MAP_W} height={MAP_H} fill="#e8f4fd" rx={10} />
      <path d={KENYA_PATH} fill="#d1fae5" stroke="#6ee7b7" strokeWidth={1.5} opacity={0.7} />
      {CITIES.map((c) => (
        <g key={c.name}>
          <circle cx={toX(c.lng)} cy={toY(c.lat)} r={3} fill="#94a3b8" opacity={0.4} />
          <text x={toX(c.lng) + 5} y={toY(c.lat) + 4} fontSize={7} fill="#64748b" fontFamily="Inter,sans-serif">{c.name}</text>
        </g>
      ))}
      {mappable.map((s) => {
        const x = toX(s.lng!), y = toY(s.lat!);
        const col = STRENGTH_COLOR[s.intentStrength];
        const r = s.intentStrength === 'HOT' ? 9 : s.intentStrength === 'WARM' ? 7 : 5;
        const isSelected = selected === s.id;
        return (
          <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={r + 7} fill={col} opacity={0.12} />
            <circle cx={x} cy={y} r={r} fill={col} opacity={isSelected ? 1 : 0.75}
              stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Source legend ──────────────────────────────────────────────────────────

function SourceLegend() {
  const items = [
    { platform: 'tavily'       },
    { platform: 'linkedin'     },
    { platform: 'new_business' },
    { platform: 'ppra'         },
    { platform: 'reddit'       },
    { platform: 'google_search'},
  ];
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary, #888)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Signal Sources</p>
      {items.map(({ platform }) => {
        const m = getSourceMeta(platform);
        return (
          <div key={platform} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem' }}>
            <span>{m.icon}</span>
            <span style={{ fontWeight: 600, color: m.color }}>{m.label}</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #94a3b8)', marginLeft: 2 }}>— {m.description}</span>
          </div>
        );
      })}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem' }}>
        <span>👤</span>
        <span style={{ fontWeight: 600, color: '#7c3aed' }}>Apollo Contact</span>
        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary, #94a3b8)', marginLeft: 2 }}>— on-demand · 1 credit per lookup · 50/month free</span>
      </div>
    </div>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────

function exportCSV(signals: IntentSignal[]) {
  const headers = ['Strength', 'Source', 'Title', 'Location', 'Published', 'URL', 'Snippet'];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = signals.map((s) => [
    s.intentStrength,
    getSourceMeta(s.platform).label,
    esc(s.title),
    s.location ?? '',
    s.publishedAt ? new Date(s.publishedAt).toLocaleDateString('en-KE') : '',
    s.url,
    esc(s.snippet ?? ''),
  ].join(','));
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `heat-map-signals-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Main HeatMapTab ────────────────────────────────────────────────────────

export function HeatMapTab({ campaignId }: { campaignId: string }) {
  const [signals,       setSignals]       = useState<IntentSignal[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [running,       setRunning]       = useState(false);
  const [error,         setError]         = useState('');
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [filterStrength,setFilterStrength]= useState<IntentStrength | 'ALL'>('ALL');
  const [filterSource,  setFilterSource]  = useState<SignalSource | 'ALL'>('ALL');
  const [lastResult,    setLastResult]    = useState<{ created: number; sources: Record<string, number> } | null>(null);

  const loadSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStrength !== 'ALL') params.set('intentStrength', filterStrength);
      if (filterSource   !== 'ALL') params.set('source',         filterSource);
      const data = await api<{ signals: IntentSignal[] }>(
        `/leadengine/campaigns/${campaignId}/heat-map${params.toString() ? '?' + params : ''}`,
      );
      setSignals(data.signals);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load signals');
    } finally {
      setLoading(false);
    }
  }, [campaignId, filterStrength, filterSource]);

  useEffect(() => { void loadSignals(); }, [loadSignals]);

  async function runScan() {
    setRunning(true); setError(''); setLastResult(null);
    try {
      const result = await api<{ created: number; skipped: number; sources: Record<string, number> }>(
        `/leadengine/campaigns/${campaignId}/heat-map`, { method: 'POST' },
      );
      setLastResult(result);
      await loadSignals();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setRunning(false);
    }
  }

  async function dismissSignal(id: string) {
    try {
      await api(`/leadengine/signals/${id}/status`, { method: 'PATCH', body: { status: 'DISMISSED', campaignId } });
      setSignals((p) => p.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch { /* non-fatal */ }
  }

  const filtered = signals.filter((s) =>
    (filterStrength === 'ALL' || s.intentStrength === filterStrength) &&
    (filterSource   === 'ALL' || s.source        === filterSource),
  );

  const hotCount        = signals.filter((s) => s.intentStrength === 'HOT').length;
  const warmCount       = signals.filter((s) => s.intentStrength === 'WARM').length;
  const tenderCount     = signals.filter((s) => ['ppra','tenderskenya'].includes(s.platform)).length;
  const tavilyCount     = signals.filter((s) => s.platform === 'tavily').length;
  const redditCount     = signals.filter((s) => s.platform === 'reddit').length;

  return (
    <div style={{ padding: '16px 0' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <button type="button" className="btn-primary" onClick={() => void runScan()} disabled={running} style={{ minWidth: 170 }}>
          {running ? '⏳ Scanning all sources…' : '🔥 Run Heat Map Scan'}
        </button>
        {signals.length > 0 && (
          <button type="button" className="btn-secondary" onClick={() => exportCSV(filtered)}
            style={{ fontSize: '0.82rem' }} title="Download filtered signals as CSV">
            ⬇ Export CSV
          </button>
        )}
        <select className="input" value={filterStrength} onChange={(e) => setFilterStrength(e.target.value as IntentStrength | 'ALL')}
          style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}>
          <option value="ALL">All intent levels</option>
          <option value="HOT">🔴 Hot — formal tenders &amp; RFQs</option>
          <option value="WARM">🟠 Warm — social &amp; expressed need</option>
          <option value="MEDIUM">🔵 Medium — research discussions</option>
        </select>
        <select className="input" value={filterSource} onChange={(e) => setFilterSource(e.target.value as SignalSource | 'ALL')}
          style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}>
          <option value="ALL">All sources</option>
          <option value="TENDER">📋 Government Tenders</option>
          <option value="SOCIAL">💬 Social &amp; Web (Tavily + Reddit)</option>
          <option value="DISCUSSION">🌐 Forums &amp; Articles</option>
        </select>
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-secondary, #888)' }}>
          {signals.length} signal{signals.length !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* Scan result banner */}
      {lastResult && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 12, fontSize: '0.82rem', color: '#166534' }}>
          ✓ Scan complete — {lastResult.created} new signal{lastResult.created !== 1 ? 's' : ''} found
          {Object.keys(lastResult.sources).length > 0 && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              ({Object.entries(lastResult.sources).map(([k, v]) => `${v} from ${getSourceMeta(k).label}`).join(', ')})
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', marginBottom: 12, fontSize: '0.82rem', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Stats row */}
      {signals.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { label: 'Hot signals',         count: hotCount,    color: '#ef4444', title: 'Formal tenders & RFQs — highest buying intent' },
            { label: 'Warm signals',         count: warmCount,   color: '#f97316', title: 'Social posts & expressed needs' },
            { label: 'Gov\'t tenders',       count: tenderCount, color: '#ef4444', title: 'PPRA Kenya + TendersKenya' },
            { label: 'Web Intelligence',     count: tavilyCount, color: '#eab308', title: 'Tavily AI web search results' },
            { label: 'Community posts',      count: redditCount, color: '#f97316', title: 'Reddit discussions' },
          ].map(({ label, count, color, title }) => (
            <div key={label} title={title} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, cursor: 'help',
              background: color + '15', color, border: `1px solid ${color}33`,
            }}>
              {count} {label}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary, #888)', fontSize: '0.85rem' }}>Loading signals…</p>
      ) : signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary, #888)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗺️</div>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No signals yet</p>
          <p style={{ fontSize: '0.83rem', maxWidth: 460, margin: '0 auto' }}>
            Click <strong>Run Heat Map Scan</strong> to search across 6 sources: AI Web Intelligence,
            LinkedIn, new business registrations, government tenders, Reddit, and web forums.
          </p>
          <SourceLegend />
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.7fr)', gap: 16 }}>

            {/* Map */}
            <div>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary, #888)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Geographic signal heat
              </p>
              <KenyaMap signals={filtered} selected={selectedId} onSelect={(id) => setSelectedId(selectedId === id ? null : id)} />
              <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                {(['HOT','WARM','MEDIUM'] as IntentStrength[]).map((s) => (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: 'var(--text-secondary, #888)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: STRENGTH_COLOR[s], display: 'inline-block' }} />
                    {s.charAt(0) + s.slice(1).toLowerCase()} intent
                  </span>
                ))}
              </div>
            </div>

            {/* Signal list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 540, overflowY: 'auto' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary, #888)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 2px' }}>
                {filtered.length} signal{filtered.length !== 1 ? 's' : ''}
                {filterStrength !== 'ALL' || filterSource !== 'ALL' ? ' (filtered)' : ''}
                {' '}— hover source badges for explanation
              </p>
              {filtered.map((s) => (
                <SignalCard key={s.id} signal={s} selected={selectedId === s.id}
                  onSelect={() => setSelectedId(selectedId === s.id ? null : s.id)}
                  onDismiss={() => void dismissSignal(s.id)} />
              ))}
            </div>
          </div>

          {/* Source legend */}
          <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 8, background: 'var(--surface, #f8fafc)', border: '1px solid var(--border-color, #e5e7eb)' }}>
            <SourceLegend />
          </div>
        </>
      )}
    </div>
  );
}
