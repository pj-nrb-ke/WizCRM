import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { IntentSignal, IntentStrength, SignalSource } from '../../lib/lead-engine-types';

// ── Kenya map helpers ──────────────────────────────────────────────────────

// Bounding box: lat -4.7→4.6, lng 33.9→41.9
const MAP_W = 360;
const MAP_H = 320;
const LAT_MAX = 4.6;
const LAT_RANGE = 9.3;   // 4.6 + 4.7
const LNG_MIN = 33.9;
const LNG_RANGE = 8.0;   // 41.9 - 33.9

function toSvgX(lng: number) { return ((lng - LNG_MIN) / LNG_RANGE) * MAP_W; }
function toSvgY(lat: number) { return ((LAT_MAX - lat) / LAT_RANGE) * MAP_H; }

const CITY_PINS = [
  { name: 'Nairobi',  lat: -1.2921, lng: 36.8219 },
  { name: 'Mombasa',  lat: -4.0435, lng: 39.6682 },
  { name: 'Kisumu',   lat: -0.0917, lng: 34.7680 },
  { name: 'Nakuru',   lat: -0.3031, lng: 36.0800 },
  { name: 'Eldoret',  lat:  0.5143, lng: 35.2698 },
  { name: 'Nyeri',    lat: -0.4167, lng: 36.9500 },
  { name: 'Thika',    lat: -1.0332, lng: 37.0693 },
  { name: 'Malindi',  lat: -3.2175, lng: 40.1169 },
];

// Rough Kenya outline (simplified polygon)
const KENYA_PATH = 'M 162,18 L 210,10 L 280,30 L 320,60 L 330,110 L 310,150 L 290,195 L 270,250 L 230,295 L 185,308 L 140,300 L 95,270 L 60,230 L 40,190 L 30,150 L 38,110 L 55,75 L 85,45 Z';

// ── Signal styling ─────────────────────────────────────────────────────────

const STRENGTH_COLOR: Record<IntentStrength, string> = {
  HOT: '#ef4444',
  WARM: '#f97316',
  MEDIUM: '#6366f1',
};

const STRENGTH_LABEL: Record<IntentStrength, string> = {
  HOT: 'Hot',
  WARM: 'Warm',
  MEDIUM: 'Medium',
};

const SOURCE_LABEL: Record<SignalSource, string> = {
  TENDER: 'Tender',
  SOCIAL: 'Social',
  DISCUSSION: 'Discussion',
};

const SOURCE_COLOR: Record<SignalSource, string> = {
  TENDER: '#fef2f2',
  SOCIAL: '#fff7ed',
  DISCUSSION: '#eef2ff',
};

const SOURCE_BORDER: Record<SignalSource, string> = {
  TENDER: '#fca5a5',
  SOCIAL: '#fed7aa',
  DISCUSSION: '#c7d2fe',
};

const SOURCE_TEXT: Record<SignalSource, string> = {
  TENDER: '#b91c1c',
  SOCIAL: '#c2410c',
  DISCUSSION: '#3730a3',
};

function StrengthBadge({ strength }: { strength: IntentStrength }) {
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: STRENGTH_COLOR[strength] + '22',
      color: STRENGTH_COLOR[strength],
      border: `1px solid ${STRENGTH_COLOR[strength]}55`,
    }}>
      {STRENGTH_LABEL[strength]}
    </span>
  );
}

function SourceBadge({ source }: { source: SignalSource }) {
  return (
    <span style={{
      fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
      background: SOURCE_COLOR[source],
      color: SOURCE_TEXT[source],
      border: `1px solid ${SOURCE_BORDER[source]}`,
    }}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

// ── Kenya SVG Map ──────────────────────────────────────────────────────────

function KenyaMap({
  signals,
  selected,
  onSelect,
}: {
  signals: IntentSignal[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  // Cluster signals at same approx location
  const mappable = signals.filter((s) => s.lat !== null && s.lng !== null);

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      style={{ width: '100%', maxWidth: 380, height: 'auto', display: 'block' }}
      aria-label="Kenya lead heat map"
    >
      {/* Background */}
      <rect width={MAP_W} height={MAP_H} fill="#e8f4fd" rx={10} />

      {/* Kenya outline */}
      <path d={KENYA_PATH} fill="#d1fae5" stroke="#6ee7b7" strokeWidth={1.5} opacity={0.7} />

      {/* City reference pins */}
      {CITY_PINS.map((c) => (
        <g key={c.name}>
          <circle cx={toSvgX(c.lng)} cy={toSvgY(c.lat)} r={3} fill="#94a3b8" opacity={0.5} />
          <text
            x={toSvgX(c.lng) + 5}
            y={toSvgY(c.lat) + 4}
            fontSize={7}
            fill="#64748b"
            fontFamily="Inter, sans-serif"
          >
            {c.name}
          </text>
        </g>
      ))}

      {/* Signal dots */}
      {mappable.map((s) => {
        const x = toSvgX(s.lng!);
        const y = toSvgY(s.lat!);
        const col = STRENGTH_COLOR[s.intentStrength];
        const isSelected = selected === s.id;
        const r = s.intentStrength === 'HOT' ? 9 : s.intentStrength === 'WARM' ? 7 : 5;
        return (
          <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer' }}>
            <circle cx={x} cy={y} r={r + 6} fill={col} opacity={0.15} />
            <circle cx={x} cy={y} r={r} fill={col} opacity={isSelected ? 1 : 0.75}
              stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Signal card ────────────────────────────────────────────────────────────

function SignalCard({
  signal,
  selected,
  onSelect,
  onDismiss,
}: {
  signal: IntentSignal;
  selected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
}) {
  const ago = signal.publishedAt
    ? (() => {
        const d = Math.floor((Date.now() - new Date(signal.publishedAt).getTime()) / 86400000);
        return d === 0 ? 'today' : d === 1 ? '1 day ago' : `${d} days ago`;
      })()
    : null;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1.5px solid ${selected ? STRENGTH_COLOR[signal.intentStrength] : 'var(--border-color, #e5e7eb)'}`,
        background: selected ? STRENGTH_COLOR[signal.intentStrength] + '08' : 'var(--surface, #fff)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
        <StrengthBadge strength={signal.intentStrength} />
        <SourceBadge source={signal.source} />
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary, #888)', marginLeft: 'auto' }}>
          {signal.platform}
          {ago ? ` · ${ago}` : ''}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.4, marginBottom: signal.snippet ? 4 : 0 }}>
        {signal.title}
      </p>
      {signal.snippet && (
        <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary, #666)', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {signal.snippet}
        </p>
      )}
      {signal.location && (
        <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--text-secondary, #888)' }}>
          📍 {signal.location}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <a
          href={signal.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: '0.72rem', color: 'var(--primary, #6366f1)', textDecoration: 'none', fontWeight: 500 }}
        >
          ↗ View source
        </a>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{ marginLeft: 'auto', fontSize: '0.68rem', background: 'none', border: 'none',
            color: 'var(--text-secondary, #aaa)', cursor: 'pointer', padding: 0 }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Main HeatMapTab ────────────────────────────────────────────────────────

export function HeatMapTab({ campaignId }: { campaignId: string }) {
  const [signals, setSignals] = useState<IntentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStrength, setFilterStrength] = useState<IntentStrength | 'ALL'>('ALL');
  const [filterSource, setFilterSource] = useState<SignalSource | 'ALL'>('ALL');
  const [lastResult, setLastResult] = useState<{ created: number; sources: Record<string, number> } | null>(null);

  const loadSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStrength !== 'ALL') params.set('intentStrength', filterStrength);
      if (filterSource !== 'ALL') params.set('source', filterSource);
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

  async function runDiscovery() {
    setRunning(true);
    setError('');
    setLastResult(null);
    try {
      const result = await api<{ created: number; skipped: number; sources: Record<string, number> }>(
        `/leadengine/campaigns/${campaignId}/heat-map`,
        { method: 'POST' },
      );
      setLastResult(result);
      await loadSignals();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Discovery failed');
    } finally {
      setRunning(false);
    }
  }

  async function dismissSignal(signalId: string) {
    try {
      await api(`/leadengine/signals/${signalId}/status`, {
        method: 'PATCH',
        body: { status: 'DISMISSED', campaignId },
      });
      setSignals((prev) => prev.filter((s) => s.id !== signalId));
      if (selectedId === signalId) setSelectedId(null);
    } catch { /* non-fatal */ }
  }

  // Stats
  const total = signals.length;
  const hotCount = signals.filter((s) => s.intentStrength === 'HOT').length;
  const warmCount = signals.filter((s) => s.intentStrength === 'WARM').length;
  const tenderCount = signals.filter((s) => s.source === 'TENDER').length;
  const socialCount = signals.filter((s) => s.source === 'SOCIAL').length;
  const discussionCount = signals.filter((s) => s.source === 'DISCUSSION').length;

  const filtered = signals.filter((s) =>
    (filterStrength === 'ALL' || s.intentStrength === filterStrength) &&
    (filterSource === 'ALL' || s.source === filterSource),
  );

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void runDiscovery()}
          disabled={running}
          style={{ minWidth: 160 }}
        >
          {running ? '⏳ Scanning signals…' : '🔥 Run Heat Map Scan'}
        </button>

        {/* Strength filter */}
        <select
          className="input"
          value={filterStrength}
          onChange={(e) => setFilterStrength(e.target.value as IntentStrength | 'ALL')}
          style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
        >
          <option value="ALL">All intent levels</option>
          <option value="HOT">🔴 Hot (tenders)</option>
          <option value="WARM">🟠 Warm (social)</option>
          <option value="MEDIUM">🔵 Medium (discussions)</option>
        </select>

        {/* Source filter */}
        <select
          className="input"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as SignalSource | 'ALL')}
          style={{ fontSize: '0.82rem', padding: '6px 10px', width: 'auto' }}
        >
          <option value="ALL">All sources</option>
          <option value="TENDER">Tenders</option>
          <option value="SOCIAL">Social (Reddit)</option>
          <option value="DISCUSSION">Discussions</option>
        </select>

        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-secondary, #888)' }}>
          {total} signal{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Last run result banner */}
      {lastResult && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, background: '#f0fdf4',
          border: '1px solid #86efac', marginBottom: 14, fontSize: '0.82rem', color: '#166534',
        }}>
          ✓ Scan complete — {lastResult.created} new signal{lastResult.created !== 1 ? 's' : ''} found
          {Object.keys(lastResult.sources).length > 0 && (
            <span style={{ marginLeft: 8, opacity: 0.75 }}>
              ({Object.entries(lastResult.sources).map(([k, v]) => `${v} ${k}`).join(', ')})
            </span>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2',
          border: '1px solid #fca5a5', marginBottom: 14, fontSize: '0.82rem', color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Stats row */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Tenders', count: tenderCount, color: '#ef4444' },
            { label: 'Social', count: socialCount, color: '#f97316' },
            { label: 'Discussions', count: discussionCount, color: '#6366f1' },
            { label: 'Hot signals', count: hotCount, color: '#ef4444' },
            { label: 'Warm signals', count: warmCount, color: '#f97316' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
              background: color + '15', color, border: `1px solid ${color}33`,
            }}>
              {count} {label}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary, #888)', fontSize: '0.85rem' }}>Loading signals…</p>
      ) : total === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary, #888)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗺️</div>
          <p style={{ fontWeight: 600, marginBottom: 6 }}>No signals yet</p>
          <p style={{ fontSize: '0.83rem' }}>
            Click <strong>Run Heat Map Scan</strong> to discover active buying signals from
            government tenders, social discussions, and forums.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 16 }}>
          {/* Map panel */}
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary, #888)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Signal map
            </p>
            <KenyaMap signals={filtered} selected={selectedId} onSelect={setSelectedId} />
            {/* Legend */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {(['HOT', 'WARM', 'MEDIUM'] as IntentStrength[]).map((s) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem',
                  color: 'var(--text-secondary, #888)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: STRENGTH_COLOR[s],
                    display: 'inline-block' }} />
                  {STRENGTH_LABEL[s]}
                </span>
              ))}
            </div>
          </div>

          {/* Signal list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary, #888)',
              textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 2px' }}>
              {filtered.length} signal{filtered.length !== 1 ? 's' : ''}
              {filterStrength !== 'ALL' || filterSource !== 'ALL' ? ' (filtered)' : ''}
            </p>
            {filtered.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                selected={selectedId === s.id}
                onSelect={() => setSelectedId(selectedId === s.id ? null : s.id)}
                onDismiss={() => void dismissSignal(s.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
