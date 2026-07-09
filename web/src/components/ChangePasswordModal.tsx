import { FormEvent, useState } from 'react';
import { api } from '../lib/api';

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  function close() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setDone(false);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (next.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }
    setSaving(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '100%' }}>
        <h2>Change password</h2>
        {done ? (
          <>
            <p className="success">Password changed. Use your new password next time you sign in.</p>
            <button type="button" className="btn-primary" onClick={close}>
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Current password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>New password</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={12}
              />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={12}
              />
            </div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              At least 12 characters; avoid common words, your name or email.
            </span>
            {error ? <p className="error">{error}</p> : null}
            <div className="toolbar" style={{ marginTop: 8 }}>
              <button type="button" className="btn-secondary btn-sm" onClick={close} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
