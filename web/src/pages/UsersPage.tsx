import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'SALES' | 'MANAGER' | 'ADMIN';
  isActive: boolean;
  team?: { id: string; name: string } | null;
};

type TeamOption = { id: string; name: string };

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'SALES' | 'MANAGER' | 'ADMIN'>('SALES');
  const [teamId, setTeamId] = useState('');

  // Row-level action state — which user id currently has a request in flight,
  // and for which action, so only that row's button shows a busy state.
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  function load() {
    return Promise.all([
      api<{ users: UserRow[] }>('/admin/users').then((d) => setUsers(d.users)),
      api<{ teams: TeamOption[] }>('/admin/teams').then((d) =>
        setTeams(d.teams.map((t) => ({ id: t.id, name: t.name }))),
      ),
    ]);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api('/admin/users', {
        method: 'POST',
        body: { email, name, role, teamId: teamId || null },
      });
      setEmail('');
      setName('');
      setMessage(`User created — an email with a link to set their password was sent to ${email}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function onSendResetLink(u: UserRow) {
    setError('');
    setMessage('');
    setBusyUserId(u.id);
    try {
      await api(`/admin/users/${u.id}/reset-password`, { method: 'POST' });
      setMessage(`Reset link sent to ${u.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onRoleChange(u: UserRow, nextRole: UserRow['role']) {
    setError('');
    setMessage('');
    setBusyUserId(u.id);
    try {
      const { user } = await api<{ user: UserRow }>(`/admin/users/${u.id}`, {
        method: 'PATCH',
        body: { role: nextRole },
      });
      setUsers((prev) => prev.map((row) => (row.id === u.id ? user : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change role');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onToggleActive(u: UserRow) {
    setError('');
    setMessage('');
    if (u.isActive && !window.confirm(`Deactivate ${u.name}? They'll be signed out and can no longer log in. Their leads and history stay untouched.`)) {
      return;
    }
    setBusyUserId(u.id);
    try {
      const action = u.isActive ? 'deactivate' : 'reactivate';
      const { user } = await api<{ user: UserRow }>(`/admin/users/${u.id}/${action}`, { method: 'POST' });
      setUsers((prev) => prev.map((row) => (row.id === u.id ? user : row)));
      setMessage(`${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update account status');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onDelete(u: UserRow) {
    setError('');
    setMessage('');
    if (!window.confirm(`Permanently delete ${u.name}'s account? This can't be undone. Only works if they have no leads, tasks, or activity history.`)) {
      return;
    }
    setBusyUserId(u.id);
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((row) => row.id !== u.id));
      setMessage(`${u.name} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user');
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <>
      <h1>Users</h1>
      <p className="muted">
        Add team members — they'll get an email to set their own password. You can resend a reset link
        any time.
      </p>

      <form className="card" onSubmit={onCreate}>
        <h2>Add user</h2>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="SALES">Sales</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div className="field">
          <label>Team (optional)</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">— None —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        <button type="submit" className="btn-primary">
          Create user
        </button>
      </form>

      <div className="card">
        <h2>All users</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Team</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const busy = busyUserId === u.id;
              return (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.6 }}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => void onRoleChange(u, e.target.value as UserRow['role'])}
                      disabled={busy || isSelf}
                      title={isSelf ? "You can't change your own role" : undefined}
                    >
                      <option value="SALES">Sales</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td>{u.team?.name ?? '—'}</td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: u.isActive ? '#dcfce7' : '#f1f5f9',
                        color: u.isActive ? '#166534' : '#64748b',
                      }}
                    >
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => void onSendResetLink(u)}
                      disabled={busy}
                      style={{ marginRight: 6 }}
                    >
                      Send reset link
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => void onToggleActive(u)}
                      disabled={busy || isSelf}
                      title={isSelf ? "You can't deactivate your own account" : undefined}
                      style={{ marginRight: 6 }}
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => void onDelete(u)}
                      disabled={busy || isSelf}
                      title={isSelf ? "You can't delete your own account" : "Only works if this user has no leads, tasks, or activity"}
                      style={{ color: '#dc2626' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                  No users yet — add your first teammate above.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                  Loading…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
