import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api } from '../lib/api';

interface PlanItem {
  rule: string;
  createsTask: boolean;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
  leadPriority: 'HOT' | 'WARM' | 'COLD' | null;
  included: boolean;
}

interface PersonPlan {
  userId: string;
  userName: string;
  items: PlanItem[];
  carryover: PlanItem[];
}

interface VsmRun {
  id: string;
  date: string;
  kind: 'MORNING' | 'EOD' | 'WEEKLY';
  status: 'DRAFT' | 'APPROVED' | 'SENT' | 'SKIPPED';
  planJson: {
    people?: PersonPlan[];
    perPerson?: { userId: string; userName: string; completedToday: number; stillOpen: number; hadMovementToday: boolean }[];
    rawCandidateCount?: number;
    dailyFocusCap?: number;
  };
  approvedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

const RULE_LABELS: Record<string, string> = {
  R1_STALE_LEAD: 'Stale lead',
  R2_OVERDUE_TASK: 'Overdue',
  R3_NEW_LEAD_UNWORKED: 'New, unworked',
  R4_DEMO_TODAY: 'Demo today',
};

const STATUS_STYLE: Record<VsmRun['status'], { bg: string; fg: string; border: string }> = {
  DRAFT: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  APPROVED: { bg: '#eff6ff', fg: '#1A56DB', border: '#bfdbfe' },
  SENT: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  SKIPPED: { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' },
};

const PRIORITY_STYLE: Record<'HOT' | 'WARM' | 'COLD', { bg: string; fg: string }> = {
  HOT: { bg: '#fef2f2', fg: '#dc2626' },
  WARM: { bg: '#fffbeb', fg: '#b45309' },
  COLD: { bg: '#eff6ff', fg: '#1A56DB' },
};

function PriorityBadge({ priority }: { priority: 'HOT' | 'WARM' | 'COLD' }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', background: s.bg, color: s.fg, borderRadius: 20, marginRight: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: VsmRun['status'] }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: s.bg, color: s.fg, borderRadius: 20, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

export function VsmRunsPage() {
  const [morningRuns, setMorningRuns] = useState<VsmRun[]>([]);
  const [eodRuns, setEodRuns] = useState<VsmRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonPlan[] | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      api<{ runs: VsmRun[] }>('/vsm/runs?kind=MORNING'),
      api<{ runs: VsmRun[] }>('/vsm/runs?kind=EOD'),
    ])
      .then(([m, e]) => {
        setMorningRuns(m.runs);
        setEodRuns(e.runs);
      })
      .catch(() => setError('Failed to load VSM runs.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function triggerMorning() {
    setBusy(true);
    setError(null);
    try {
      await api('/vsm/runs/morning', { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to trigger morning run.');
    } finally {
      setBusy(false);
    }
  }

  async function triggerEod() {
    setBusy(true);
    setError(null);
    try {
      await api('/vsm/runs/eod', { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to trigger evening digest.');
    } finally {
      setBusy(false);
    }
  }

  function openRun(run: VsmRun) {
    if (openRunId === run.id) {
      setOpenRunId(null);
      setDraft(null);
      return;
    }
    setOpenRunId(run.id);
    setDraft(run.planJson.people ? JSON.parse(JSON.stringify(run.planJson.people)) : null);
  }

  function toggleItem(personIdx: number, itemIdx: number) {
    if (!draft) return;
    const next = [...draft];
    next[personIdx] = { ...next[personIdx], items: [...next[personIdx].items] };
    next[personIdx].items[itemIdx] = { ...next[personIdx].items[itemIdx], included: !next[personIdx].items[itemIdx].included };
    setDraft(next);
  }

  async function saveDraft(runId: string) {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/vsm/runs/${runId}`, { method: 'PATCH', body: { people: draft } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save edits.');
    } finally {
      setBusy(false);
    }
  }

  async function approve(runId: string) {
    if (draft) await saveDraft(runId);
    setBusy(true);
    setError(null);
    try {
      await api(`/vsm/runs/${runId}/approve`, { method: 'POST' });
      setOpenRunId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve and send.');
    } finally {
      setBusy(false);
    }
  }

  async function skip(runId: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/vsm/runs/${runId}/skip`, { method: 'POST' });
      setOpenRunId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to skip.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading VSM runs…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Morning Plan & Digest
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Review and approve today's plan before it goes out, or trigger a run manually.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={triggerMorning} disabled={busy} style={secondaryBtn}>
            Run morning plan now
          </button>
          <button onClick={triggerEod} disabled={busy} style={secondaryBtn}>
            Run evening digest now
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <Section title="Morning runs">
        {morningRuns.length === 0 && <div style={{ color: '#94a3b8', fontSize: 14 }}>No morning runs yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {morningRuns.map((run) => {
            const isOpen = openRunId === run.id;
            const people = isOpen ? draft ?? [] : (run.planJson.people ?? []);
            return (
              <div key={run.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => openRun(run)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{new Date(run.date).toLocaleDateString()}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusBadge status={run.status} />
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f1f5f9' }}>
                    {typeof run.planJson.rawCandidateCount === 'number' && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                        {run.planJson.rawCandidateCount} candidate{run.planJson.rawCandidateCount === 1 ? '' : 's'} found — focused down to the top {run.planJson.dailyFocusCap ?? '—'} for today, prioritising hot leads and time-critical items.
                      </div>
                    )}
                    {people.length === 0 && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>No candidates today.</div>}
                    {people.map((person, pIdx) => (
                      <div key={person.userId} style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{person.userName}</div>
                        {person.items.map((item, iIdx) => (
                          <label key={iIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', cursor: run.status === 'DRAFT' ? 'pointer' : 'default' }}>
                            <input
                              type="checkbox"
                              checked={item.included}
                              disabled={run.status !== 'DRAFT'}
                              onChange={() => toggleItem(pIdx, iIdx)}
                              style={{ marginTop: 3 }}
                            />
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#1A56DB', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 6 }}>
                                {RULE_LABELS[item.rule] ?? item.rule}
                              </span>
                              {item.leadPriority && <PriorityBadge priority={item.leadPriority} />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{item.title}</span>
                              <div style={{ fontSize: 12, color: '#64748b' }}>{item.reason}</div>
                            </div>
                          </label>
                        ))}
                        {person.carryover.length > 0 && (
                          <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                            + {person.carryover.length} still open from before (not counted against today's cap)
                          </div>
                        )}
                      </div>
                    ))}
                    {run.status === 'DRAFT' && (
                      <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                        <button onClick={() => approve(run.id)} disabled={busy} style={primaryBtn}>
                          Approve & send
                        </button>
                        <button onClick={() => saveDraft(run.id)} disabled={busy} style={secondaryBtn}>
                          Save edits
                        </button>
                        <button onClick={() => skip(run.id)} disabled={busy} style={dangerBtn}>
                          Skip today
                        </button>
                      </div>
                    )}
                    {run.status === 'SENT' && run.sentAt && (
                      <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8' }}>Sent {new Date(run.sentAt).toLocaleString()}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Evening digests">
        {eodRuns.length === 0 && <div style={{ color: '#94a3b8', fontSize: 14 }}>No evening digests yet.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {eodRuns.map((run) => (
            <div key={run.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{new Date(run.date).toLocaleDateString()}</div>
                <StatusBadge status={run.status} />
              </div>
              {run.planJson.perPerson && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {run.planJson.perPerson.map((p) => (
                    <div key={p.userId} style={{ fontSize: 12, color: '#64748b' }}>
                      {p.userName}: {p.completedToday} done, {p.stillOpen} still open{p.hadMovementToday ? '' : ' — no movement today'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

const primaryBtn: CSSProperties = {
  padding: '7px 16px', background: '#1A56DB', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const secondaryBtn: CSSProperties = {
  padding: '7px 16px', background: '#fff', border: '1px solid #1A56DB', color: '#1A56DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const dangerBtn: CSSProperties = {
  padding: '7px 16px', background: '#fff', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
