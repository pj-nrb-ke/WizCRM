import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { BrandMark } from '../components/BrandMark';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: email.trim() }, auth: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
          <p>Reset your password</p>
        </div>
        <div className="login-card">
          {sent ? (
            <>
              <h2>Check your email</h2>
              <p className="muted">
                If {email.trim()} has an account, a reset link is on its way. It expires in 1 hour.
              </p>
              <Link className="btn-primary btn-block" to="/login" style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <h2>Forgot password</h2>
              <p className="muted">Enter your account email and we'll send you a reset link.</p>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error ? <div className="alert alert-error">{error}</div> : null}
              <button type="submit" className="btn-primary btn-block" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
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
