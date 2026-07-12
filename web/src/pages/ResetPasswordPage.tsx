import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { BrandMark } from '../components/BrandMark';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword }, auth: false });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <BrandMark size={60} />
          <h1>WizCRM</h1>
          <p>Set a new password</p>
        </div>
        <div className="login-card">
          {!token ? (
            <>
              <h2>Invalid link</h2>
              <p className="muted">This reset link is missing its token. Request a new one.</p>
              <Link className="btn-primary btn-block" to="/forgot-password" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Request new link
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <h2>New password</h2>
              <p className="muted">Choose a password with at least 12 characters.</p>
              <div className="field">
                <label htmlFor="newPassword">New password</label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error ? <div className="alert alert-error">{error}</div> : null}
              <button type="submit" className="btn-primary btn-block" disabled={loading}>
                {loading ? 'Saving…' : 'Reset password'}
              </button>
              <p className="login-api-hint">
                <Link to="/login">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
