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

type VisitMissingReport = {
  count: number;
  visits: {
    id: string;
    visitNumber: number;
    occurredAt: string;
    lead: { id: string; name: string; company: string | null; stage: string };
    user: { id: string; name: string };
  }[];
};

export function DataHygienePage() {
  const { entitlements } = useAuth();
  const pro = entitlements?.features.dataHygiene ?? false;
  const [report, setReport] = useState<HygieneReport | null>(null);
  const [error, setError] = useState('');
  const [visitsMissing, setVisitsMissing] = useState<VisitMissingReport | null>(null);
  const [visitsError, setVisitsError] = useState('');

  useEffect(() => {
    if (!pro) return;
    api<HygieneReport>('/reports/data-hygiene')
      .then(setReport)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load report'));
  }, [pro]);

  useEffect(() => {
    api<VisitMissingReport>('/reports/visits-missing-report')
      .then(setVisitsMissing)
      .catch((e) => setVisitsError(e instanceof Error ? e.message : 'Failed to load report'));
  }, []);

  const visitsMissingSection = (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <strong>Visits without a report</strong>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Field effort logged with no outcome captured yet — a nudge to file the report, or a sign the visit didn't
          happen as planned.
        </p>
      </div>
      {visitsError ? (
        <p className="error" style={{ padding: 16 }}>
          {visitsError}
        </p>
      ) : !visitsMissing ? (
        <p className="muted" style={{ padding: 16 }}>
          Loading…
        </p>
      ) : visitsMissing.visits.length === 0 ? (
        <p className="muted" style={{ padding: 16 }}>
          Every logged visit has a report. Nice.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Lead</th>
              <th>Visit</th>
              <th>Rep</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {visitsMissing.visits.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link to={`/leads?open=${v.lead.id}`}>{v.lead.name}</Link>
                  {v.lead.company ? <div className="muted">{v.lead.company}</div> : null}
                </td>
                <td>Visit {v.visitNumber}</td>
                <td>{v.user.name}</td>
                <td>{new Date(v.occurredAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  if (!pro) {
    return (
      <div className="page-wide">
        <PageHeader
          title="Data hygiene"
          subtitle="Find missing fields, stale leads, and possible duplicates (WizCRM Pro)."
        />
        {visitsMissingSection}
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
      {visitsMissingSection}
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
