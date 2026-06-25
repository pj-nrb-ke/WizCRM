import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type AuditRow = {
  id: string;
  feature: string;
  model: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  approved: boolean | null;
  createdAt: string;
  user: { name: string; email: string } | null;
};

export function AuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ logs: AuditRow[] }>('/admin/audit')
      .then((d) => setLogs(d.logs))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <h1>AI audit log</h1>
      <p className="muted">Last 20 AI operations (read-only).</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="muted">No AI activity yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Feature</th>
                <th>User</th>
                <th>Status</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.feature}</td>
                  <td>{l.user?.name ?? '—'}</td>
                  <td>
                    {l.approved == null ? (
                      <span className="muted">—</span>
                    ) : l.approved ? (
                      <span style={{ color: '#16a34a' }}>Approved</span>
                    ) : (
                      <span style={{ color: '#dc2626' }}>Rejected</span>
                    )}
                  </td>
                  <td className="muted" style={{ maxWidth: 280 }}>
                    {(l.outputSummary ?? l.inputSummary ?? '').slice(0, 120)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
