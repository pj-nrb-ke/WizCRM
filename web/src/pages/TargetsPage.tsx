import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

type AssignableUser = { id: string; name: string; email: string };

type PacingReport = {
  period: string;
  orgTarget: number;
  orgWonRevenue: number;
  orgAchievementPct: number | null;
  orgPacingLabel: string;
  reps: {
    userId: string;
    name: string;
    target: number;
    wonRevenue: number;
    wonDeals: number;
    achievementPct: number | null;
    pacingLabel: string;
  }[];
};

type SettingsPayload = {
  orgMonthlyRevenueTarget?: number;
  userMonthlyTargets?: Record<string, number>;
};

export function TargetsPage() {
  const { user, entitlements } = useAuth();
  const canEdit = isAdmin(user?.role);
  const pro = entitlements?.features.targetsPacing ?? false;
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [orgTarget, setOrgTarget] = useState('');
  const [userTargets, setUserTargets] = useState<Record<string, string>>({});
  const [pacing, setPacing] = useState<PacingReport | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPacing = useCallback(() => {
    if (!pro) return;
    api<PacingReport>('/reports/pacing')
      .then(setPacing)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load pacing'));
  }, [pro]);

  useEffect(() => {
    if (!pro) return;
    api<{ users: AssignableUser[] }>('/teams/assignable-users')
      .then((d) => setUsers(d.users))
      .catch(() => setUsers([]));
    api<{ settings: SettingsPayload }>('/admin/settings')
      .then((d) => {
        setOrgTarget(
          d.settings.orgMonthlyRevenueTarget != null
            ? String(d.settings.orgMonthlyRevenueTarget)
            : '',
        );
        const map: Record<string, string> = {};
        const ut = d.settings.userMonthlyTargets ?? {};
        for (const [id, amt] of Object.entries(ut)) {
          map[id] = String(amt);
        }
        setUserTargets(map);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'));
    loadPacing();
  }, [pro, loadPacing]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || !pro) return;
    setMessage('');
    setError('');
    const org = orgTarget.trim() === '' ? undefined : Number(orgTarget);
    if (org !== undefined && (Number.isNaN(org) || org < 0)) {
      setError('Org target must be a non-negative number.');
      return;
    }
    const perUser: Record<string, number> = {};
    for (const u of users) {
      const raw = userTargets[u.id]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0) {
        setError(`Invalid target for ${u.name}`);
        return;
      }
      perUser[u.id] = n;
    }
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: {
          orgMonthlyRevenueTarget: org,
          userMonthlyTargets: Object.keys(perUser).length ? perUser : {},
        },
      });
      setMessage('Targets saved.');
      loadPacing();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  if (!pro) {
    return (
      <div className="page-wide">
        <PageHeader
          title="Targets & pacing"
          subtitle="Set monthly revenue targets and track rep achievement (WizCRM Pro)."
        />
        <div className="card">
          <p>
            Upgrade this organization to <strong>Pro</strong> in Platform settings to enable targets
            and pacing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Targets & pacing"
        subtitle="Monthly revenue targets vs closed-won value. Pacing compares achievement to the calendar month."
      />

      {pacing ? (
        <div className="card targets-pacing-summary">
          <h2 className="section-title">{pacing.period}</h2>
          <p>
            Organization: <strong>{pacing.orgWonRevenue.toLocaleString()}</strong> won of{' '}
            <strong>{pacing.orgTarget.toLocaleString()}</strong> target
            {pacing.orgAchievementPct != null ? ` (${pacing.orgAchievementPct}%)` : ''} —{' '}
            <em>{pacing.orgPacingLabel}</em>
          </p>
          <table>
            <thead>
              <tr>
                <th>Rep</th>
                <th>Target</th>
                <th>Won</th>
                <th>Deals</th>
                <th>%</th>
                <th>Pacing</th>
              </tr>
            </thead>
            <tbody>
              {pacing.reps.map((r) => (
                <tr key={r.userId}>
                  <td>{r.name}</td>
                  <td>{r.target.toLocaleString()}</td>
                  <td>{r.wonRevenue.toLocaleString()}</td>
                  <td>{r.wonDeals}</td>
                  <td>{r.achievementPct != null ? `${r.achievementPct}%` : '—'}</td>
                  <td>{r.pacingLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canEdit ? (
        <form className="card crm-settings-form" onSubmit={onSave}>
          <h2 className="section-title">Edit targets</h2>
          <label>
            Default monthly target (per rep without override)
            <input
              type="number"
              min={0}
              value={orgTarget}
              onChange={(e) => setOrgTarget(e.target.value)}
            />
          </label>
          <h3>Per-rep overrides</h3>
          <ul className="targets-user-list">
            {users.map((u) => (
              <li key={u.id}>
                <span>{u.name}</span>
                <input
                  type="number"
                  min={0}
                  placeholder="Uses default"
                  value={userTargets[u.id] ?? ''}
                  onChange={(e) =>
                    setUserTargets((prev) => ({ ...prev, [u.id]: e.target.value }))
                  }
                />
              </li>
            ))}
          </ul>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="success">{message}</p> : null}
          <button type="submit" className="btn-primary">
            Save targets
          </button>
        </form>
      ) : (
        <p className="muted">Only admins can edit targets. Managers can view pacing above.</p>
      )}
    </div>
  );
}
