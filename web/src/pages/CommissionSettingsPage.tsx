import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  commissionEnabled: boolean;
  commissionRatePct: number | null;
};

export function CommissionSettingsPage() {
  const [commissionEnabled, setCommissionEnabled] = useState(true);
  const [defaultRatePct, setDefaultRatePct] = useState('0');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    return api<{ commissionEnabled: boolean; commissionDefaultRatePct: number; users: UserRow[] }>(
      '/commission/settings',
    ).then((d) => {
      setCommissionEnabled(d.commissionEnabled);
      setDefaultRatePct(String(d.commissionDefaultRatePct));
      setUsers(d.users);
    });
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoaded(true));
  }, []);

  async function onSaveOrgSettings(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    const rate = Number(defaultRatePct);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      setError('Default rate must be between 0 and 100.');
      return;
    }
    try {
      await api('/commission/settings', {
        method: 'PATCH',
        body: { commissionEnabled, commissionDefaultRatePct: rate },
      });
      setMessage('Commission settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function onToggleUser(u: UserRow) {
    setBusyUserId(u.id);
    setError('');
    try {
      const { user } = await api<{ user: UserRow }>(`/commission/settings/users/${u.id}`, {
        method: 'PATCH',
        body: { commissionEnabled: !u.commissionEnabled },
      });
      setUsers((prev) => prev.map((row) => (row.id === u.id ? user : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onRateChange(u: UserRow, raw: string) {
    const value = raw.trim() === '' ? null : Number(raw);
    if (value != null && (Number.isNaN(value) || value < 0 || value > 100)) return;
    setUsers((prev) => prev.map((row) => (row.id === u.id ? { ...row, commissionRatePct: value } : row)));
  }

  async function onSaveRate(u: UserRow) {
    setBusyUserId(u.id);
    setError('');
    try {
      const { user } = await api<{ user: UserRow }>(`/commission/settings/users/${u.id}`, {
        method: 'PATCH',
        body: { commissionRatePct: u.commissionRatePct },
      });
      setUsers((prev) => prev.map((row) => (row.id === u.id ? user : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update rate');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Commission"
        subtitle="Org-wide switch, default rate, and per-salesperson overrides. Rate changes never apply retroactively — only to future document uploads."
      />

      <form className="card" onSubmit={onSaveOrgSettings} style={{ marginBottom: 20 }}>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={commissionEnabled}
            onChange={(e) => setCommissionEnabled(e.target.checked)}
          />
          Commission enabled org-wide
        </label>
        <label>
          Default commission rate (%)
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={defaultRatePct}
            onChange={(e) => setDefaultRatePct(e.target.value)}
          />
          <span className="muted">Used for anyone without a personal rate set below.</span>
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        <button type="submit" className="btn-primary" disabled={!loaded}>
          Save
        </button>
      </form>

      <div className="card">
        <h3>Per-salesperson overrides</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Included</th>
              <th>Rate override (%)</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.55 }}>
                <td>
                  {u.name}
                  <div className="muted">{u.email}</div>
                </td>
                <td className="muted">{u.role}</td>
                <td>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={u.commissionEnabled}
                      disabled={busyUserId === u.id}
                      onChange={() => void onToggleUser(u)}
                    />
                    {u.commissionEnabled ? 'Included' : 'Excluded'}
                  </label>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder={`org default`}
                    value={u.commissionRatePct ?? ''}
                    disabled={busyUserId === u.id}
                    onChange={(e) => void onRateChange(u, e.target.value)}
                    onBlur={() => void onSaveRate(u)}
                    style={{ width: 90 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
