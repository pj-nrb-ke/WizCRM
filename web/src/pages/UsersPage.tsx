import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Key,
  Mail,
  MoreVertical,
  Pencil,
  Power,
  Search,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users as UsersIcon,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';

type Role = 'SALES' | 'MANAGER' | 'ADMIN';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  team?: { id: string; name: string } | null;
};

type TeamOption = { id: string; name: string };
type StatusFilter = 'all' | 'active' | 'inactive';

const ROLE_STYLE: Record<Role, { bg: string; fg: string; label: string }> = {
  SALES: { bg: '#ecfdf5', fg: '#059669', label: 'Sales' },
  MANAGER: { bg: '#f0f9ff', fg: '#0284c7', label: 'Manager' },
  ADMIN: { bg: '#f5f3ff', fg: '#7c3aed', label: 'Admin' },
};

const AVATAR_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#059669', '#db2777', '#1A56DB', '#dc2626', '#0d9488'];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const PAGE_SIZE = 10;

function RowMenu({
  user,
  isSelf,
  busy,
  onToggleActive,
  onDelete,
}: {
  user: UserRow;
  isSelf: boolean;
  busy: boolean;
  onToggleActive: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="kebab-btn" onClick={() => setOpen((v) => !v)} disabled={busy}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="kebab-menu">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onToggleActive(user);
            }}
            disabled={isSelf}
            title={isSelf ? "You can't deactivate your own account" : undefined}
          >
            <Power size={14} />
            {user.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setOpen(false);
              onDelete(user);
            }}
            disabled={isSelf}
            title={isSelf ? "You can't delete your own account" : 'Only works if this user has no leads, tasks, or activity'}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('SALES');
  const [teamId, setTeamId] = useState('');

  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.team?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, query, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

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

  async function onRoleChange(u: UserRow, nextRole: Role) {
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

  function startEditName(u: UserRow) {
    setError('');
    setMessage('');
    setEditingUserId(u.id);
    setEditingName(u.name);
  }

  function cancelEditName() {
    setEditingUserId(null);
    setEditingName('');
  }

  async function onSaveName(u: UserRow) {
    const trimmed = editingName.trim();
    if (!trimmed || trimmed === u.name) {
      cancelEditName();
      return;
    }
    setError('');
    setMessage('');
    setBusyUserId(u.id);
    try {
      const { user } = await api<{ user: UserRow }>(`/admin/users/${u.id}`, {
        method: 'PATCH',
        body: { name: trimmed },
      });
      setUsers((prev) => prev.map((row) => (row.id === u.id ? user : row)));
      cancelEditName();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename user');
    } finally {
      setBusyUserId(null);
    }
  }

  async function onToggleActive(u: UserRow) {
    setError('');
    setMessage('');
    if (
      u.isActive &&
      !window.confirm(`Deactivate ${u.name}? They'll be signed out and can no longer log in. Their leads and history stay untouched.`)
    ) {
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
      <PageHeader title="Users" subtitle="Manage team members and access." />

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <UserPlus size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Add user</h2>
            <p className="muted" style={{ margin: 0 }}>Create a new team member and set their access.</p>
          </div>
        </div>

        <form onSubmit={onCreate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="field">
              <label>Email</label>
              <div className="input-icon-wrap">
                <Mail size={15} />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Name</label>
              <div className="input-icon-wrap">
                <UserIcon size={15} />
                <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
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
          </div>

          {error ? <p className="error">{error}</p> : null}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: message ? 'space-between' : 'flex-end', gap: 12 }}>
            {message ? (
              <div className="alert alert-success" style={{ margin: 0, flex: 1 }}>
                <CheckCircle2 size={16} />
                {message}
              </div>
            ) : null}
            <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <UserPlus size={15} />
              Create user
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            All users
            <span className="badge badge-info">{filtered.length}</span>
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="table-search">
              <Search size={15} />
              <input placeholder="Search by name, email or team…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div ref={filterRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px' }}
                onClick={() => setFilterOpen((v) => !v)}
              >
                <Filter size={15} />
              </button>
              {filterOpen && (
                <div className="kebab-menu" style={{ minWidth: 150 }}>
                  {(['all', 'active', 'inactive'] as StatusFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setStatusFilter(f);
                        setFilterOpen(false);
                      }}
                      style={{ fontWeight: statusFilter === f ? 700 : 500 }}
                    >
                      {f === 'all' ? 'All users' : f === 'active' ? 'Active only' : 'Deactivated only'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Team</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((u) => {
              const isSelf = u.id === me?.id;
              const busy = busyUserId === u.id;
              const rs = ROLE_STYLE[u.role];
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar-circle" style={{ background: avatarColor(u.id) }}>
                        {initials(u.name)}
                      </div>
                      {editingUserId === u.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void onSaveName(u);
                              if (e.key === 'Escape') cancelEditName();
                            }}
                            style={{ padding: '5px 8px', fontSize: '0.9rem', width: 160 }}
                            disabled={busy}
                          />
                          <button
                            type="button"
                            className="icon-btn"
                            title="Save"
                            onClick={() => void onSaveName(u)}
                            disabled={busy}
                          >
                            <Check size={14} />
                          </button>
                          <button type="button" className="icon-btn" title="Cancel" onClick={cancelEditName} disabled={busy}>
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit name"
                            onClick={() => startEditName(u)}
                            disabled={busy}
                          >
                            <Pencil size={13} />
                          </button>
                          {!u.isActive ? <span className="badge badge-neutral">Deactivated</span> : null}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <select
                      className="role-pill-select"
                      style={{ background: rs.bg, color: rs.fg }}
                      value={u.role}
                      onChange={(e) => void onRoleChange(u, e.target.value as Role)}
                      disabled={busy || isSelf}
                      title={isSelf ? "You can't change your own role" : undefined}
                    >
                      <option value="SALES">Sales</option>
                      <option value="MANAGER">Manager</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="muted">
                    {u.team ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <UsersIcon size={13} />
                        {u.team.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => void onSendResetLink(u)}
                        disabled={busy}
                      >
                        <Key size={13} />
                        Reset password
                      </button>
                      <RowMenu
                        user={u}
                        isSelf={isSelf}
                        busy={busy}
                        onToggleActive={(row) => void onToggleActive(row)}
                        onDelete={(row) => void onDelete(row)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  {users.length === 0 ? 'No users yet — add your first teammate above.' : 'No users match your search.'}
                </td>
              </tr>
            ) : null}
            {loading ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 24, textAlign: 'center' }}>
                  Loading…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        {filtered.length > 0 ? (
          <div className="pagination-row">
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              Showing {(clampedPage - 1) * PAGE_SIZE + 1} to {Math.min(clampedPage * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} users
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage <= 1}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={clampedPage >= pageCount}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
