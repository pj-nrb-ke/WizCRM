import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  team?: { id: string; name: string } | null;
};

type TeamOption = { id: string; name: string };

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'SALES' | 'MANAGER' | 'ADMIN'>('SALES');
  const [teamId, setTeamId] = useState('');

  // Admin-triggered "send reset link"
  const [sendingResetFor, setSendingResetFor] = useState<string | null>(null);

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
    setSendingResetFor(u.id);
    try {
      await api(`/admin/users/${u.id}/reset-password`, { method: 'POST' });
      setMessage(`Reset link sent to ${u.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link');
    } finally {
      setSendingResetFor(null);
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.team?.name ?? '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => void onSendResetLink(u)}
                    disabled={sendingResetFor === u.id}
                  >
                    {sendingResetFor === u.id ? 'Sending…' : 'Send reset link'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 16, textAlign: 'center' }}>
                  No users yet — add your first teammate above.
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 16, textAlign: 'center' }}>
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
