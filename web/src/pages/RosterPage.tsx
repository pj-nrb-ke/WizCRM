import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { api } from '../lib/api';

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

interface Profile {
  position: string | null;
  responsibilities: string | null;
  workingDays: number[];
  workStart: string | null;
  workEnd: string | null;
  pushOptIn: boolean;
  managedByVsm: boolean;
}

interface RosterUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team: { id: string; name: string } | null;
  teamMemberProfile: Profile | null;
}

const EMPTY_PROFILE: Profile = {
  position: '',
  responsibilities: '',
  workingDays: [1, 2, 3, 4, 5],
  workStart: '08:00',
  workEnd: '17:00',
  pushOptIn: false,
  managedByVsm: true,
};

export function RosterPage() {
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Profile>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    api<{ roster: RosterUser[] }>('/vsm/roster')
      .then((data) => setRoster(data.roster))
      .catch(() => setError('Failed to load the roster.'))
      .finally(() => setLoading(false));
  }

  function draftFor(user: RosterUser): Profile {
    return drafts[user.id] ?? { ...EMPTY_PROFILE, ...(user.teamMemberProfile ?? {}) };
  }

  function updateDraft(userId: string, patch: Partial<Profile>) {
    setDrafts((prev) => ({ ...prev, [userId]: { ...draftFor(roster.find((r) => r.id === userId)!), ...prev[userId], ...patch } }));
    setSavedId(null);
  }

  function toggleDay(userId: string, day: number) {
    const current = draftFor(roster.find((r) => r.id === userId)!).workingDays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
    updateDraft(userId, { workingDays: next });
  }

  async function save(userId: string) {
    setSavingId(userId);
    setError(null);
    try {
      const draft = draftFor(roster.find((r) => r.id === userId)!);
      const { profile } = await api<{ profile: Profile }>(`/vsm/roster/${userId}`, {
        method: 'PUT',
        body: {
          position: draft.position || undefined,
          responsibilities: draft.responsibilities || undefined,
          workingDays: draft.workingDays,
          workStart: draft.workStart || undefined,
          workEnd: draft.workEnd || undefined,
          pushOptIn: draft.pushOptIn,
          managedByVsm: draft.managedByVsm,
        },
      });
      setRoster((prev) => prev.map((u) => (u.id === userId ? { ...u, teamMemberProfile: profile } : u)));
      setSavedId(userId);
      setTimeout(() => setSavedId((id) => (id === userId ? null : id)), 2500);
    } catch {
      setError('Failed to save this profile. Please try again.');
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading team roster…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Team Roster
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            What each person does and when they work — this is what Wanjiru reads to decide who gets which task.
            Uncheck "Managed by Wanjiru" for anyone who should keep working the old way.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {roster.map((user) => {
          const isOpen = openId === user.id;
          const draft = draftFor(user);
          const hasProfile = Boolean(user.teamMemberProfile);
          return (
            <div key={user.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : user.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', background: '#eff6ff', color: '#1A56DB',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0,
                  }}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      {user.name} <span style={{ fontWeight: 400, color: '#94a3b8' }}>· {user.role}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {user.teamMemberProfile?.position || 'No position set'}
                      {user.team ? ` · ${user.team.name}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {!hasProfile && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', background: '#fffbeb', color: '#b45309', borderRadius: 20, border: '1px solid #fde68a' }}>
                      Not set up
                    </span>
                  )}
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '4px 18px 20px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                    <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                      Position / title
                      <input
                        value={draft.position ?? ''}
                        onChange={(e) => updateDraft(user.id, { position: e.target.value })}
                        placeholder="e.g. Sales Executive"
                        style={inputStyle}
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, flex: 1 }}>
                        Work start
                        <input type="time" value={draft.workStart ?? ''} onChange={(e) => updateDraft(user.id, { workStart: e.target.value })} style={inputStyle} />
                      </label>
                      <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, flex: 1 }}>
                        Work end
                        <input type="time" value={draft.workEnd ?? ''} onChange={(e) => updateDraft(user.id, { workEnd: e.target.value })} style={inputStyle} />
                      </label>
                    </div>
                  </div>

                  <label style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginTop: 14 }}>
                    What they do (free text — Wanjiru reads this to decide who gets what)
                    <textarea
                      value={draft.responsibilities ?? ''}
                      onChange={(e) => updateDraft(user.id, { responsibilities: e.target.value })}
                      placeholder="e.g. Handles Nairobi CBD and Westlands accounts, owns demo follow-ups for the manufacturing vertical."
                      rows={3}
                      style={{ ...inputStyle, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </label>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 6 }}>Working days</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {DAYS.map((d) => {
                        const active = draft.workingDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDay(user.id, d.value)}
                            style={{
                              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              border: `1px solid ${active ? '#1A56DB' : '#e2e8f0'}`,
                              background: active ? '#eff6ff' : '#fff',
                              color: active ? '#1A56DB' : '#94a3b8',
                            }}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={draft.managedByVsm} onChange={(e) => updateDraft(user.id, { managedByVsm: e.target.checked })} />
                      Managed by Wanjiru
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={draft.pushOptIn} onChange={(e) => updateDraft(user.id, { pushOptIn: e.target.checked })} />
                      Push notifications opt-in (phase 3)
                    </label>
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => save(user.id)}
                      disabled={savingId === user.id}
                      style={{
                        padding: '7px 18px', background: savingId === user.id ? '#94a3b8' : '#1A56DB', color: '#fff',
                        border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: savingId === user.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {savingId === user.id ? 'Saving…' : savedId === user.id ? '✓ Saved' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  marginTop: 4,
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 13,
  color: '#0f172a',
  outline: 'none',
  boxSizing: 'border-box',
};
