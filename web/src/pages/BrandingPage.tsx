import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

type SettingsPayload = {
  brandDisplayName?: string;
  logoUrl?: string;
  primaryColorHex?: string;
  supportEmail?: string;
};

export function BrandingPage() {
  const { user } = useAuth();
  const canEdit = isAdmin(user?.role);
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColorHex, setPrimaryColorHex] = useState('#4f46e5');
  const [supportEmail, setSupportEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ settings: SettingsPayload }>('/admin/settings')
      .then((d) => {
        setDisplayName(d.settings.brandDisplayName ?? '');
        setLogoUrl(d.settings.logoUrl ?? '');
        setPrimaryColorHex(d.settings.primaryColorHex ?? '#4f46e5');
        setSupportEmail(d.settings.supportEmail ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMessage('');
    setError('');
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: {
          brandDisplayName: displayName.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          primaryColorHex: primaryColorHex.trim() || undefined,
          supportEmail: supportEmail.trim() || undefined,
        },
      });
      setMessage('Branding saved. Refresh to apply sidebar colours.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="Branding"
        subtitle="Logo, accent colour, and support contact (PRO-013)."
      />
      <form className="card crm-settings-form" onSubmit={onSave}>
        <label>
          Display name (sidebar)
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!canEdit} />
        </label>
        <label>
          Logo URL
          <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} disabled={!canEdit} />
        </label>
        <label>
          Primary accent colour
          <input
            type="color"
            value={primaryColorHex}
            onChange={(e) => setPrimaryColorHex(e.target.value)}
            disabled={!canEdit}
          />
        </label>
        <label>
          Support email (MGT-021)
          <input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            disabled={!canEdit}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {canEdit ? (
          <button type="submit" className="btn-primary">
            Save branding
          </button>
        ) : null}
      </form>
    </div>
  );
}
