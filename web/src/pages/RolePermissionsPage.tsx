import { useEffect, useState } from 'react';
import { FEATURE_KEYS, FEATURE_LABELS, CONFIGURABLE_ROLES, type FeatureKey, type ConfigurableRole, type OrgSettings } from '@wizcrm/shared';
import { api } from '../lib/api';

const ROLE_LABELS: Record<ConfigurableRole, string> = {
  MANAGER: 'Manager',
  SALES: 'Sales',
};

type PermState = Record<ConfigurableRole, Partial<Record<FeatureKey, boolean>>>;

export function RolePermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermState>({ MANAGER: {}, SALES: {} });

  useEffect(() => {
    api<{ settings: OrgSettings }>('/admin/settings')
      .then((data) => {
        setPerms({
          MANAGER: data.settings.rolePermissions?.MANAGER ?? {},
          SALES: data.settings.rolePermissions?.SALES ?? {},
        });
      })
      .catch(() => setError('Failed to load permission settings.'))
      .finally(() => setLoading(false));
  }, []);

  function isAllowed(role: ConfigurableRole, key: FeatureKey): boolean {
    return perms[role][key] !== false;
  }

  function toggle(role: ConfigurableRole, key: FeatureKey) {
    setPerms((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: !isAllowed(role, key) },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: { rolePermissions: perms },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save permission settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading permission settings…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            Roles &amp; Permissions
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            Choose which pages Managers and Sales reps can access. Admin always has full access — this
            cannot be changed here. Users, Data Sources, and Organisation settings always stay admin-only.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px',
              background: saving ? '#94a3b8' : '#1A56DB',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 100px 100px',
          padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span>Feature</span>
          {CONFIGURABLE_ROLES.map((role) => (
            <span key={role} style={{ textAlign: 'center' }}>{ROLE_LABELS[role]}</span>
          ))}
        </div>

        {FEATURE_KEYS.map((key, idx) => {
          const meta = FEATURE_LABELS[key];
          return (
            <div
              key={key}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                alignItems: 'center', padding: '14px 20px',
                borderBottom: idx < FEATURE_KEYS.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{meta.label}</div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{meta.description}</div>
              </div>
              {CONFIGURABLE_ROLES.map((role) => {
                const allowed = isAllowed(role, key);
                return (
                  <div key={role} style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowed}
                      aria-label={`${meta.label} for ${ROLE_LABELS[role]}`}
                      onClick={() => toggle(role, key)}
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        border: 'none',
                        background: allowed ? '#1A56DB' : '#e2e8f0',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: allowed ? 22 : 2,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                          transition: 'left 0.2s',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0',
        borderRadius: 8, fontSize: 13, color: '#64748b', lineHeight: 1.5,
      }}>
        Turning a feature off hides its page and blocks the underlying API for that role — reps see it
        disappear from their sidebar immediately after they next reload the app.
      </div>
    </div>
  );
}
