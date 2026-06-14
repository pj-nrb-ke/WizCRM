import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/roles';

type Org = {
  id: string;
  name: string;
  deskUseAi: boolean;
};

export function OrganizationPage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const canEdit = isAdmin(user?.role);

  useEffect(() => {
    api<{ organization: Org }>('/admin/organization')
      .then((d) => setName(d.organization.name))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoaded(true));
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    if (!name.trim()) {
      setError('Organization name is required.');
      return;
    }
    setMessage('');
    setError('');
    try {
      const d = await api<{ organization: Org }>('/admin/organization', {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      setName(d.organization.name);
      setMessage('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <>
      <h1>Organization</h1>
      <p className="muted">Company name shown across your WizCRM workspace.</p>
      <form className="card" onSubmit={onSave}>
        <div className="field">
          <label htmlFor="orgName">Organization name</label>
          <input
            id="orgName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        {!canEdit && <p className="muted">Managers can view; only admins can edit.</p>}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {canEdit && (
          <button type="submit" className="btn-primary" disabled={!loaded || !name.trim()}>
            Save
          </button>
        )}
      </form>
    </>
  );
}
