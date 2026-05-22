import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type Member = { id: string; name: string; email: string; role: string };
type TeamRow = {
  id: string;
  name: string;
  memberCount: number;
  members: Member[];
};
type AssignableUser = { id: string; name: string; email: string; teamId: string | null };

export function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  function load() {
    return Promise.all([
      api<{ teams: TeamRow[] }>('/admin/teams').then((d) => setTeams(d.teams)),
      api<{ users: AssignableUser[] }>('/teams/assignable-users').then((d) =>
        setAssignable(d.users),
      ),
    ]);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setFormName('');
    setSelectedMembers(new Set());
    setError('');
    setMessage('');
  }

  function startEdit(team: TeamRow) {
    setCreating(false);
    setEditingId(team.id);
    setFormName(team.name);
    setSelectedMembers(new Set(team.members.map((m) => m.id)));
    setError('');
    setMessage('');
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setFormName('');
    setSelectedMembers(new Set());
  }

  function toggleMember(userId: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function saveTeam(e: FormEvent) {
    e.preventDefault();
    const trimmed = formName.trim();
    if (!trimmed) {
      setError('Team name is required.');
      return;
    }
    setError('');
    setMessage('');
    try {
      let teamId = editingId;
      if (creating) {
        const created = await api<{ team: { id: string } }>('/teams', {
          method: 'POST',
          body: { name: trimmed },
        });
        teamId = created.team.id;
      } else if (editingId) {
        await api(`/teams/${editingId}`, { method: 'PATCH', body: { name: trimmed } });
      }
      if (teamId) {
        await api(`/teams/${teamId}/members`, {
          method: 'PUT',
          body: { userIds: [...selectedMembers] },
        });
      }
      setMessage(creating ? 'Team created.' : 'Team updated.');
      cancelForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function deleteTeam(team: TeamRow) {
    if (!window.confirm(`Delete team "${team.name}"? Members will be unassigned.`)) return;
    setError('');
    try {
      await api(`/teams/${team.id}`, { method: 'DELETE' });
      setMessage('Team deleted.');
      if (editingId === team.id) cancelForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const showForm = creating || editingId !== null;

  return (
    <>
      <h1>Teams</h1>
      <p className="muted">Create and manage sales teams and member assignments (WEB-012).</p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <div className="toolbar">
        <button type="button" className="btn-primary" onClick={startCreate}>
          + New team
        </button>
      </div>

      {showForm ? (
        <div className="card">
          <h2>{creating ? 'New team' : 'Edit team'}</h2>
          <form onSubmit={saveTeam}>
            <label>
              Team name
              <input value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </label>
            <p className="muted" style={{ marginTop: 16 }}>
              Assign sales reps (checkboxes)
            </p>
            <div className="member-grid">
              {assignable.map((u) => (
                <label key={u.id} className="member-check">
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(u.id)}
                    onChange={() => toggleMember(u.id)}
                  />
                  <span>
                    {u.name} <span className="muted">({u.email})</span>
                  </span>
                </label>
              ))}
            </div>
            {assignable.length === 0 ? (
              <p className="muted">No sales users yet. Add users on the Users page.</p>
            ) : null}
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {creating ? 'Create team' : 'Save changes'}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {teams.map((t) => (
        <div key={t.id} className="card">
          <div className="card-header-row">
            <h2>
              {t.name} <span className="muted">({t.memberCount} members)</span>
            </h2>
            <div className="card-actions">
              <button type="button" className="btn-secondary" onClick={() => startEdit(t)}>
                Edit
              </button>
              <button type="button" className="btn-danger" onClick={() => deleteTeam(t)}>
                Delete
              </button>
            </div>
          </div>
          {t.members.length === 0 ? (
            <p className="muted">No members assigned.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {t.members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{m.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {teams.length === 0 && !showForm ? <p className="muted">No teams yet. Create one above.</p> : null}
    </>
  );
}
