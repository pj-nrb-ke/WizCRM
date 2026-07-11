import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface VsmConfig {
  id: string;
  personaName: string;
  personaEmail: string;
  vsmUserId: string | null;
  tone: string;
  language: string;
  timezone: string;
  workingDays: number[];
  runMorningAt: string;
  middayNudgeEnabled: boolean;
  runMiddayAt: string;
  runEveningAt: string;
  runDigestAt: string;
  autonomy: 'DRAFT' | 'AUTO';
  dailyFocusCap: number;
  taskCapPerDay: number;
  nudgeCapPerDay: number;
  ceoUserIds: string[];
  enabled: boolean;
}

interface RosterUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AutoModeEligibility {
  eligible: boolean;
  uneditedCount: number;
  totalCount: number;
  reason: string;
}

interface ConfigChange {
  id: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  at: string;
  changedByUser: { name: string; email: string };
}

interface PlanItem {
  rule: string;
  title: string;
  reason: string;
  leadPriority: 'HOT' | 'WARM' | 'COLD' | null;
}

interface PersonPlan {
  userId: string;
  userName: string;
  items: PlanItem[];
  carryover: PlanItem[];
}

interface MorningPlanPreview {
  rawCandidateCount: number;
  dailyFocusCap: number;
  people: PersonPlan[];
}

const RULE_LABELS: Record<string, string> = {
  R1_STALE_LEAD: 'Stale lead',
  R2_OVERDUE_TASK: 'Overdue task',
  R3_NEW_LEAD_UNWORKED: 'New lead, unworked',
  R4_DEMO_TODAY: 'Demo today',
};

const PRIORITY_STYLE: Record<'HOT' | 'WARM' | 'COLD', { bg: string; fg: string }> = {
  HOT: { bg: '#fef2f2', fg: '#dc2626' },
  WARM: { bg: '#fffbeb', fg: '#b45309' },
  COLD: { bg: '#eff6ff', fg: '#1A56DB' },
};

export function VsmConfigPage() {
  const [cfg, setCfg] = useState<VsmConfig | null>(null);
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryRun, setDryRun] = useState<MorningPlanPreview | null>(null);
  const [eligibility, setEligibility] = useState<AutoModeEligibility | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ config: VsmConfig }>('/vsm/config'),
      api<{ roster: RosterUser[] }>('/vsm/roster'),
      api<{ changes: ConfigChange[] }>('/vsm/config/changes'),
      api<{ eligibility: AutoModeEligibility }>('/vsm/auto-mode-eligibility'),
    ])
      .then(([c, r, ch, el]) => {
        setCfg(c.config);
        setRoster(r.roster);
        setChanges(ch.changes);
        setEligibility(el.eligibility);
      })
      .catch(() => setError('Failed to load VSM configuration.'))
      .finally(() => setLoading(false));
  }, []);

  function update(patch: Partial<VsmConfig>) {
    setCfg((prev) => (prev ? { ...prev, ...patch } : prev));
    setSaved(false);
  }

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    try {
      const { config } = await api<{ config: VsmConfig }>('/vsm/config', {
        method: 'PATCH',
        body: {
          personaName: cfg.personaName,
          personaEmail: cfg.personaEmail,
          tone: cfg.tone,
          language: cfg.language,
          timezone: cfg.timezone,
          runMorningAt: cfg.runMorningAt,
          middayNudgeEnabled: cfg.middayNudgeEnabled,
          runMiddayAt: cfg.runMiddayAt,
          runEveningAt: cfg.runEveningAt,
          runDigestAt: cfg.runDigestAt,
          autonomy: cfg.autonomy,
          dailyFocusCap: cfg.dailyFocusCap,
          taskCapPerDay: cfg.taskCapPerDay,
          nudgeCapPerDay: cfg.nudgeCapPerDay,
          ceoUserIds: cfg.ceoUserIds,
          enabled: cfg.enabled,
        },
      });
      setCfg(config);
      setSaved(true);
      const { changes: ch } = await api<{ changes: ConfigChange[] }>('/vsm/config/changes');
      setChanges(ch);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save VSM configuration.');
    } finally {
      setSaving(false);
    }
  }

  async function provision() {
    setProvisioning(true);
    setError(null);
    try {
      const { config } = await api<{ config: VsmConfig }>('/vsm/provision', { method: 'POST' });
      setCfg(config);
    } catch {
      setError('Failed to provision the VSM account.');
    } finally {
      setProvisioning(false);
    }
  }

  async function runDryRun() {
    setDryRunning(true);
    setError(null);
    setDryRun(null);
    try {
      const result = await api<MorningPlanPreview>('/vsm/dry-run', { method: 'POST' });
      setDryRun(result);
    } catch {
      setError('Dry run failed.');
    } finally {
      setDryRunning(false);
    }
  }

  if (loading || !cfg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading VSM configuration…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Virtual Sales Manager
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Configure {cfg.personaName || 'the VSM'} — persona, schedule, autonomy and caps. Only admins and configured
            CEO users can change this.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '8px 20px', background: saving ? '#94a3b8' : '#1A56DB', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Account provisioning */}
      <Section title="Account">
        {cfg.vsmUserId ? (
          <div style={{ fontSize: 13, color: '#15803d' }}>✓ Provisioned — sends as {cfg.personaEmail}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              No system account yet. Creates a virtual MANAGER user (login disabled) so all VSM output is attributable.
            </span>
            <button
              onClick={provision}
              disabled={provisioning}
              style={{ padding: '6px 14px', background: '#fff', border: '1px solid #1A56DB', color: '#1A56DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
            >
              {provisioning ? 'Provisioning…' : 'Provision VSM account'}
            </button>
          </div>
        )}
      </Section>

      {/* Persona */}
      <Section title="Persona">
        <Row>
          <Field label="Name">
            <input style={inputStyle} value={cfg.personaName} onChange={(e) => update({ personaName: e.target.value })} />
          </Field>
          <Field label="Email">
            <input style={inputStyle} value={cfg.personaEmail} onChange={(e) => update({ personaEmail: e.target.value })} />
          </Field>
        </Row>
        <Row>
          <Field label="Tone">
            <select style={inputStyle} value={cfg.tone} onChange={(e) => update({ tone: e.target.value })}>
              <option value="professional">Professional</option>
              <option value="warm">Warm</option>
              <option value="direct">Direct</option>
            </select>
          </Field>
          <Field label="Language">
            <select style={inputStyle} value={cfg.language} onChange={(e) => update({ language: e.target.value })}>
              <option value="en">English</option>
              <option value="sw">Swahili phrases</option>
            </select>
          </Field>
        </Row>
      </Section>

      {/* Schedule */}
      <Section title="Daily rhythm">
        <Row>
          <Field label="Morning plan run">
            <input type="time" style={inputStyle} value={cfg.runMorningAt} onChange={(e) => update({ runMorningAt: e.target.value })} />
          </Field>
          <Field label="Timezone">
            <input style={inputStyle} value={cfg.timezone} onChange={(e) => update({ timezone: e.target.value })} />
          </Field>
        </Row>
        <Row>
          <Field label="End-of-day collection">
            <input type="time" style={inputStyle} value={cfg.runEveningAt} onChange={(e) => update({ runEveningAt: e.target.value })} />
          </Field>
          <Field label="CEO digest">
            <input type="time" style={inputStyle} value={cfg.runDigestAt} onChange={(e) => update({ runDigestAt: e.target.value })} />
          </Field>
        </Row>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginTop: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={cfg.middayNudgeEnabled} onChange={(e) => update({ middayNudgeEnabled: e.target.checked })} />
          Midday nudge (off by default) at
          <input
            type="time"
            style={{ ...inputStyle, width: 110, marginTop: 0 }}
            value={cfg.runMiddayAt}
            disabled={!cfg.middayNudgeEnabled}
            onChange={(e) => update({ runMiddayAt: e.target.value })}
          />
        </label>
      </Section>

      {/* Autonomy & caps */}
      <Section title="Autonomy & caps">
        <Row>
          <Field label="Autonomy">
            <select style={inputStyle} value={cfg.autonomy} onChange={(e) => update({ autonomy: e.target.value as 'DRAFT' | 'AUTO' })}>
              <option value="DRAFT">Draft — CEO approves each morning plan</option>
              <option value="AUTO" disabled={!eligibility?.eligible}>
                Auto — sends immediately{eligibility?.eligible ? '' : ' (not yet earned)'}
              </option>
            </select>
            {eligibility && !eligibility.eligible && cfg.autonomy === 'DRAFT' && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                {eligibility.reason} See <Link to="/settings/vsm-performance" style={{ color: '#1A56DB' }}>VSM Performance</Link>.
              </div>
            )}
          </Field>
          <Field label="Enabled">
            <select style={inputStyle} value={cfg.enabled ? '1' : '0'} onChange={(e) => update({ enabled: e.target.value === '1' })}>
              <option value="0">Off</option>
              <option value="1">On</option>
            </select>
          </Field>
        </Row>
        <Row>
          <Field label="Daily focus — total new tasks across the whole team">
            <input type="number" min={1} max={50} style={inputStyle} value={cfg.dailyFocusCap} onChange={(e) => update({ dailyFocusCap: Number(e.target.value) })} />
          </Field>
          <Field label="Max tasks / person / day (ceiling within the focus list)">
            <input type="number" min={1} max={20} style={inputStyle} value={cfg.taskCapPerDay} onChange={(e) => update({ taskCapPerDay: Number(e.target.value) })} />
          </Field>
        </Row>
        <Row>
          <Field label="Max nudges / person / day">
            <input type="number" min={0} max={5} style={inputStyle} value={cfg.nudgeCapPerDay} onChange={(e) => update({ nudgeCapPerDay: Number(e.target.value) })} />
          </Field>
          <div />
        </Row>
      </Section>

      {/* CEO recipients */}
      <Section title="CEO recipients">
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
          Gets the morning plan, evening digest, and escalations — and can edit this page even without the Admin role.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {roster.filter((u) => u.role !== 'SALES').map((u) => {
            const active = cfg.ceoUserIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => update({ ceoUserIds: active ? cfg.ceoUserIds.filter((id) => id !== u.id) : [...cfg.ceoUserIds, u.id] })}
                style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${active ? '#1A56DB' : '#e2e8f0'}`,
                  background: active ? '#eff6ff' : '#fff',
                  color: active ? '#1A56DB' : '#64748b',
                }}
              >
                {u.name}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Dry run */}
      <Section title="Dry run">
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 10px' }}>
          Runs the deterministic rule layer against real data. Produces a plan preview — creates nothing, sends nothing.
        </p>
        <button
          onClick={runDryRun}
          disabled={dryRunning}
          style={{ padding: '7px 16px', background: '#fff', border: '1px solid #1A56DB', color: '#1A56DB', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: dryRunning ? 'not-allowed' : 'pointer' }}
        >
          {dryRunning ? 'Running…' : 'Run dry run'}
        </button>
        {dryRun && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
              {dryRun.rawCandidateCount} candidate{dryRun.rawCandidateCount === 1 ? '' : 's'} found — focused down to the top {dryRun.dailyFocusCap} for today, prioritising hot leads and time-critical items.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 400, overflowY: 'auto' }}>
              {dryRun.people.map((person) => (
                <div key={person.userId}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{person.userName}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {person.items.map((item, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#1A56DB', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: 6 }}>
                          {RULE_LABELS[item.rule] ?? item.rule}
                        </span>
                        {item.leadPriority && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', background: PRIORITY_STYLE[item.leadPriority].bg, color: PRIORITY_STYLE[item.leadPriority].fg, borderRadius: 20, marginRight: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {item.leadPriority}
                          </span>
                        )}
                        <div style={{ color: '#0f172a', fontWeight: 600, marginTop: 2 }}>{item.title}</div>
                        <div style={{ color: '#64748b', fontSize: 12 }}>{item.reason}</div>
                      </div>
                    ))}
                  </div>
                  {person.carryover.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#94a3b8' }}>
                      + {person.carryover.length} still open from before (not counted against today's cap)
                    </div>
                  )}
                </div>
              ))}
              {dryRun.people.length === 0 && (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>No candidates — nothing stale, overdue, or unworked right now.</div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Audit trail */}
      {changes.length > 0 && (
        <Section title="Configuration changes">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {changes.map((c) => (
              <div key={c.id} style={{ fontSize: 12, color: '#64748b' }}>
                <strong style={{ color: '#374151' }}>{c.field}</strong> changed to{' '}
                <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>{JSON.stringify(c.newValue)}</code>{' '}
                by {c.changedByUser.name} · {new Date(c.at).toLocaleString()}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block' }}>
      {label}
      <div style={{ marginTop: 4 }}>{children}</div>
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box',
};
