import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/roles';

type Org = {
  id: string;
  name: string;
  deskUseAi: boolean;
  settings?: { businessDescription?: string };
};

export function OrganizationPage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [businessDescription, setBusinessDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const canEdit = isAdmin(user?.role);

  useEffect(() => {
    api<{ organization: Org }>('/admin/organization')
      .then((d) => {
        setName(d.organization.name);
        setBusinessDescription(d.organization.settings?.businessDescription ?? '');
      })
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
      await api('/admin/settings', {
        method: 'PATCH',
        body: { businessDescription: businessDescription.trim() || undefined },
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
        <div className="field">
          <label htmlFor="businessDescription">What your company sells</label>
          <textarea
            id="businessDescription"
            rows={3}
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            disabled={!canEdit}
            placeholder="e.g. accounting and ERP software for mid-market manufacturers in Kenya"
          />
          <p className="muted">
            Used to ground AI features like Expo Finder's positioning advice — without this, recommendations stay generic.
          </p>
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
