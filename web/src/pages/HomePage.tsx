import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';

type AdminHealth = {
  status: string;
  aiEnabled: boolean;
  deskUseAi: boolean;
  apiPublicUrl: string;
  webPublicUrl: string;
};

export function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isManager(user?.role)) return;
    api<AdminHealth>('/admin/health')
      .then(setHealth)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [user?.role]);

  return (
    <>
      <h1>Welcome, {user?.name}</h1>
      <p className="muted">Central settings for WizCRM — mobile stays the main app for reps.</p>

      {error ? <p className="error">{error}</p> : null}

      {health && (
        <div className="card">
          <h2>System status</h2>
          <ul className="status-list">
            <li>API: {health.status === 'ok' ? 'OK' : health.status}</li>
            <li>AI configured: {health.aiEnabled ? 'Yes' : 'No'}</li>
            <li>Desk mode: {health.deskUseAi ? 'AI-ranked (slower)' : 'Rules (fast)'}</li>
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Quick links</h2>
        <ul className="link-list">
          {isManager(user?.role) && (
            <li>
              <Link to="/organization">Organization profile</Link>
            </li>
          )}
          {isAdmin(user?.role) && (
            <>
              <li>
                <Link to="/users">Manage users</Link>
              </li>
              <li>
                <Link to="/platform">AI & platform settings</Link>
              </li>
              <li>
                <Link to="/connection">Mobile API URL</Link>
              </li>
            </>
          )}
          {isManager(user?.role) && (
            <>
              <li>
                <Link to="/manager">Manager home</Link>
              </li>
              <li>
                <Link to="/pipeline">Pipeline board</Link>
              </li>
              <li>
                <Link to="/leads">Leads table</Link>
              </li>
              <li>
                <Link to="/reports">Reports & CSV</Link>
              </li>
              <li>
                <Link to="/teams">Teams</Link>
              </li>
            </>
          )}
        </ul>
      </div>
      <style>{`
        .status-list, .link-list { margin: 0; padding-left: 20px; color: #e2e8f0; }
        .status-list li, .link-list li { margin-bottom: 8px; }
      `}</style>
    </>
  );
}
