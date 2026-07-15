import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';

type HygieneReport = {
  staleDays: number;
  summary: {
    missingContact: number;
    missingCompany: number;
    stale: number;
    newNotContacted: number;
    overdueTasks: number;
    duplicateEmailGroups: number;
    duplicatePhoneGroups: number;
  };
  topIssues: {
    leadId: string;
    name: string;
    stage: string;
    ownerName: string;
    issues: string[];
  }[];
};

export function DataHygienePage() {
  const { entitlements } = useAuth();
  const pro = entitlements?.features.dataHygiene ?? false;
  const [report, setReport] = useState<HygieneReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pro) return;
    api<HygieneReport>('/reports/data-hygiene')
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load report'));
  }, [pro]);

  if (!pro) {
    return (
      <div className="page-wide">
        <PageHeader
          title="Data hygiene"
          subtitle="Find missing fields, stale leads, and possible duplicates (Pro feature)."
        />
        <div className="card">
          <p>Upgrade to <strong>Pro</strong> to run the org-wide hygiene report.</p>
        </div>
      </div>
    );
  }

  const s = report?.summary;

  return (
    <div className="page-wide">
      <PageHeader
        title="Data hygiene"
        subtitle="Open leads with data quality issues across your organization."
      />
      {error ? <p className="error">{error}</p> : null}
      {!report ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi-card warn">
              <span className="kpi-label">Stale ({report.staleDays}d+)</span>
              <strong>{s?.stale ?? 0}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Missing contact</span>
              <strong>{s?.missingContact ?? 0}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Missing company</span>
              <strong>{s?.missingCompany ?? 0}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">New, not contacted</span>
              <strong>{s?.newNotContacted ?? 0}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Overdue tasks</span>
              <strong>{s?.overdueTasks ?? 0}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Dup. emails</span>
              <strong>{s?.duplicateEmailGroups ?? 0}</strong>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Dup. phones</span>
              <strong>{s?.duplicatePhoneGroups ?? 0}</strong>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Stage</th>
                  <th>Owner</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {report.topIssues.map((row) => (
                  <tr key={row.leadId}>
                    <td>
                      <Link to={`/leads?open=${row.leadId}`}>{row.name}</Link>
                    </td>
                    <td>{row.stage}</td>
                    <td>{row.ownerName}</td>
                    <td>{row.issues.join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.topIssues.length === 0 ? (
              <p className="muted" style={{ padding: 16 }}>
                No hygiene issues found on open leads.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
