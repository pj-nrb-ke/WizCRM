import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Escalation {
  id: string;
  kind: 'REP_UNRESPONSIVE' | 'HIGH_VALUE_STALLED' | 'STAFF_FLAGGED' | 'TARGET_TRAJECTORY' | 'MEETING_ACTION_OVERDUE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  evidence: Record<string, unknown>;
  suggestedAction: string | null;
  createdAt: string;
  updatedAt: string;
  subjectUser: { id: string; name: string } | null;
  acknowledgedByUser: { id: string; name: string } | null;
  resolvedByUser: { id: string; name: string } | null;
}

const KIND_LABELS: Record<Escalation['kind'], string> = {
  REP_UNRESPONSIVE: 'Unresponsive rep',
  HIGH_VALUE_STALLED: 'High-value deal stalled',
  STAFF_FLAGGED: 'Flagged by staff',
  TARGET_TRAJECTORY: 'Target trajectory',
  MEETING_ACTION_OVERDUE: 'Meeting action overdue',
};

const SEVERITY_STYLE: Record<Escalation['severity'], { bg: string; fg: string; border: string }> = {
  INFO: { bg: '#eff6ff', fg: '#1A56DB', border: '#bfdbfe' },
  WARNING: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  CRITICAL: { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
};

type Filter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ALL';

export function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    const qs = filter === 'ALL' ? '' : `?status=${filter}`;
    api<{ escalations: Escalation[] }>(`/vsm/escalations${qs}`)
      .then((data) => setEscalations(data.escalations))
      .catch(() => setError('Failed to load escalations.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function act(id: string, action: 'acknowledge' | 'resolve') {
    setBusyId(id);
    setError(null);
    try {
      await api(`/vsm/escalations/${id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Escalations
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Patterns Wanjiru flagged with evidence — she never takes action on these herself; what happens next is your call.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${filter === f ? '#1A56DB' : '#e2e8f0'}`,
              background: filter === f ? '#eff6ff' : '#fff',
              color: filter === f ? '#1A56DB' : '#64748b',
              textTransform: 'capitalize',
            }}
          >
            {f.toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading…</div>
      ) : escalations.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 14 }}>Nothing here — that's a good sign.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {escalations.map((esc) => {
            const s = SEVERITY_STYLE[esc.severity];
            return (
              <div key={esc.id} style={{ background: '#fff', border: `1px solid ${s.border}`, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: s.bg, color: s.fg, borderRadius: 20 }}>
                      {esc.severity}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{KIND_LABELS[esc.kind]}</span>
                    {esc.subjectUser && <span style={{ fontSize: 13, color: '#64748b' }}>· {esc.subjectUser.name}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(esc.createdAt).toLocaleDateString()}</span>
                </div>
                {esc.suggestedAction && <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>{esc.suggestedAction}</div>}
                <details>
                  <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>Evidence</summary>
                  <pre style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: 8, borderRadius: 6, marginTop: 6, overflowX: 'auto' }}>
                    {JSON.stringify(esc.evidence, null, 2)}
                  </pre>
                </details>
                {esc.status === 'OPEN' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => act(esc.id, 'acknowledge')}
                      disabled={busyId === esc.id}
                      style={{ padding: '6px 14px', background: '#fff', border: '1px solid #1A56DB', color: '#1A56DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => act(esc.id, 'resolve')}
                      disabled={busyId === esc.id}
                      style={{ padding: '6px 14px', background: '#1A56DB', border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Resolve
                    </button>
                  </div>
                )}
                {esc.status === 'ACKNOWLEDGED' && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      Acknowledged{esc.acknowledgedByUser ? ` by ${esc.acknowledgedByUser.name}` : ''}
                    </span>
                    <button
                      onClick={() => act(esc.id, 'resolve')}
                      disabled={busyId === esc.id}
                      style={{ padding: '6px 14px', background: '#1A56DB', border: 'none', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Resolve
                    </button>
                  </div>
                )}
                {esc.status === 'RESOLVED' && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
                    Resolved{esc.resolvedByUser ? ` by ${esc.resolvedByUser.name}` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
