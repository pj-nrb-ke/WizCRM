import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LEAD_STAGES } from '../lib/stages';
import { api, downloadAuthenticated } from '../lib/api';
import { filterSearchParams, readManagerFilter, reportsQueryPath } from '../lib/manager-query';
import type { ReportSummary, TeamsResponse } from '../lib/types';
import { TeamFilterBar } from '../components/TeamFilterBar';

export function ReportsPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const filter = readManagerFilter(search);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [teams, setTeams] = useState<TeamsResponse['teams']>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api<{ summary: ReportSummary }>(reportsQueryPath(filter)),
      api<TeamsResponse>('/teams'),
    ])
      .then(([rep, t]) => {
        setSummary(rep.summary);
        setTeams(t.teams);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [search.toString()]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    setError('');
    try {
      const qs = filter.teamId ? `?teamId=${encodeURIComponent(filter.teamId)}` : '';
      await downloadAuthenticated(`/reports/export.csv${qs}`, 'wizcrm-leads.csv');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <h1>Reports</h1>
      <p className="muted">Conversion by stage and source. Export all matching leads as CSV.</p>
      <TeamFilterBar basePath="/reports" />
      {error ? <p className="error">{error}</p> : null}

      <div className="toolbar">
        <label className="field-inline">
          Team filter
          <select
            value={filter.teamId ?? ''}
            onChange={(e) => {
              const teamId = e.target.value;
              const team = teams.find((t) => t.id === teamId);
              const params = teamId
                ? filterSearchParams({ teamId, title: team?.name })
                : '';
              navigate(`/reports${params}`);
            }}
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={exporting}
          onClick={() => void exportCsv()}
        >
          {exporting ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : summary ? (
        <>
          <div className="card">
            <h2>Summary</h2>
            <div className="stat-row">
              <div className="stat-pill">
                <span className="stat-pill-value">{summary.totalLeads}</span>
                <span className="stat-pill-label">Total leads</span>
              </div>
              <div className="stat-pill">
                <span className="stat-pill-value">{summary.openLeads}</span>
                <span className="stat-pill-label">Open</span>
              </div>
              <div className="stat-pill">
                <span className="stat-pill-value">{summary.wonCount}</span>
                <span className="stat-pill-label">Won</span>
              </div>
              <div className="stat-pill">
                <span className="stat-pill-value">{summary.lostCount}</span>
                <span className="stat-pill-label">Lost</span>
              </div>
              <div className="stat-pill">
                <span className="stat-pill-value">
                  {summary.winRate != null ? `${summary.winRate}%` : '—'}
                </span>
                <span className="stat-pill-label">Win rate (won / closed)</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>By stage</h2>
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {LEAD_STAGES.map((stage) => (
                  <tr key={stage}>
                    <td>{stage}</td>
                    <td>{summary.byStage[stage] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>By source</h2>
            {summary.bySource.length === 0 ? (
              <p className="muted">No source data yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bySource.map((row) => (
                    <tr key={row.source}>
                      <td>{row.source}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
