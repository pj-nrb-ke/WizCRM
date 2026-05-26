import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LEAD_STAGES } from '../lib/stages';
import { api, downloadAuthenticated } from '../lib/api';
import { useAuth } from '../lib/auth';
import { filterSearchParams, readManagerFilter, reportsQueryPath } from '../lib/manager-query';
import type { ReportsSummaryResponse, ReportSummary } from '../lib/report-types';
import type { TeamsResponse } from '../lib/types';
import { PageHeader } from '../components/PageHeader';
import { TeamFilterBar } from '../components/TeamFilterBar';
import { ChartCard } from '../components/ChartCard';
import { ReportKpiRow } from '../components/ReportKpiRow';
import { BarChart } from '../components/BarChart';
import { DonutChart } from '../components/DonutChart';

type LeaderboardRow = {
  id: string;
  name: string;
  teamName: string;
  openLeads: number;
  overdueTasks: number;
  staleLeads: number;
  lastActivityAt: string | null;
};

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoDateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatReportDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatLastActivity(iso: string | null): string {
  if (!iso) return 'No recent activity';
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export function ReportsPage() {
  const navigate = useNavigate();
  const { entitlements } = useAuth();
  const pro = entitlements?.features.advancedReports ?? false;
  const [search] = useSearchParams();
  const filter = readManagerFilter(search);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [forecast, setForecast] = useState<{
    weightedPipeline: number;
    openOpportunities: number;
    openLeads: number;
  } | null>(null);
  const [teams, setTeams] = useState<TeamsResponse['teams']>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => isoDateDaysAgo(90));
  const [dateTo, setDateTo] = useState(() => isoDateToday());

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api<ReportsSummaryResponse>(
        reportsQueryPath(filter, {
          dateFrom: new Date(dateFrom + 'T00:00:00').toISOString(),
          dateTo: new Date(dateTo + 'T23:59:59').toISOString(),
        }),
      ),
      api<TeamsResponse>('/teams'),
    ])
      .then(([rep, t]) => {
        setSummary(rep.summary);
        setTeams(t.teams);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [search.toString(), dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!pro) return;
    api<{ weightedPipeline: number; openOpportunities: number; openLeads: number }>(
      '/reports/forecast',
    )
      .then(setForecast)
      .catch(() => setForecast(null));
  }, [pro]);

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

  const stageData = useMemo(
    () =>
      LEAD_STAGES.map((stage) => ({
        label: stage,
        value: summary?.byStage[stage] ?? 0,
      })),
    [summary],
  );

  const funnelData = useMemo(
    () =>
      stageData
        .filter((stage) => stage.label !== 'LOST')
        .map((stage, idx) => ({
          ...stage,
          color: `hsl(${238 + idx * 10} 78% ${47 + idx * 4}%)`,
        })),
    [stageData],
  );

  const sourceData = useMemo(
    () =>
      (summary?.bySource ?? []).slice(0, 8).map((row, idx) => ({
        label: row.source,
        value: row.count,
        color: idx % 2 === 0 ? 'var(--primary)' : '#818cf8',
      })),
    [summary],
  );

  const stageDonutData = useMemo(
    () =>
      stageData
        .filter((stage) => stage.value > 0)
        .map((stage, idx) => ({
          label: stage.label,
          value: stage.value,
          color:
            ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#22c55e', '#f59e0b', '#ef4444'][idx % 7],
        })),
    [stageData],
  );

  const ownerRows = useMemo(
    () => (summary?.byOwner ?? []).slice(0, 10),
    [summary],
  );

  const lossReasonData = useMemo(
    () =>
      (summary?.wonLoss.lossReasons ?? []).slice(0, 6).map((row, idx) => ({
        label: row.reason,
        value: row.count,
        color: idx % 2 === 0 ? '#f43f5e' : '#fb7185',
      })),
    [summary],
  );

  const conversionFunnelData = useMemo(
    () =>
      (summary?.conversionFunnel ?? []).map((row, idx) => ({
        label: row.stage,
        value: row.reached,
        color: `hsl(${220 + idx * 12} 70% ${50 + idx * 3}%)`,
      })),
    [summary],
  );

  const timeInStageData = useMemo(
    () =>
      (summary?.timeInStage ?? [])
        .filter((row) => row.samples > 0)
        .map((row, idx) => ({
          label: row.stage,
          value: row.avgDays,
          color: idx % 2 === 0 ? '#0ea5e9' : '#38bdf8',
        })),
    [summary],
  );

  const leaderboard = useMemo<LeaderboardRow[]>(
    () =>
      teams
        .flatMap((team) =>
          team.members.map((member) => ({
            id: member.id,
            name: member.name,
            teamName: team.name,
            openLeads: member.stats.openLeads,
            overdueTasks: member.stats.overdueTasks,
            staleLeads: member.stats.staleLeads,
            lastActivityAt: member.stats.lastActivityAt,
          })),
        )
        .sort((a, b) => {
          if (b.openLeads !== a.openLeads) return b.openLeads - a.openLeads;
          if (a.overdueTasks !== b.overdueTasks) return a.overdueTasks - b.overdueTasks;
          return a.staleLeads - b.staleLeads;
        })
        .slice(0, 8),
    [teams],
  );

  const chartActions = (
    <>
      <label className="field-inline">
        From
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </label>
      <label className="field-inline">
        To
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </label>
      <label className="field-inline">
        Team
        <select
          value={filter.teamId ?? ''}
          onChange={(e) => {
            const teamId = e.target.value;
            const team = teams.find((t) => t.id === teamId);
            const params = teamId ? filterSearchParams({ teamId, title: team?.name }) : '';
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
    </>
  );

  return (
    <div className="report-dashboard page-wide">
      <PageHeader
        title="Executive reports"
        subtitle="Funnel health, conversion analytics, win/loss, and rep performance (Phase 1–2)."
        actions={chartActions}
      />
      <TeamFilterBar basePath="/reports" />
      {error ? <div className="alert alert-error">{error}</div> : null}

      {forecast ? (
        <div className="card">
          <strong>Weighted pipeline forecast (PRO-007):</strong>{' '}
          {forecast.weightedPipeline.toLocaleString(undefined, {
            style: 'currency',
            currency: 'ZAR',
          })}{' '}
          <span className="muted">
            · {forecast.openOpportunities} opportunities · {forecast.openLeads} open leads
          </span>
        </div>
      ) : null}

      {loading ? (
        <p className="muted">Loading report dashboard…</p>
      ) : summary ? (
        <>
          <p className="report-range muted">
            Reporting window: {formatReportDate(summary.dateFrom)} — {formatReportDate(summary.dateTo)}
            {' · '}
            Stale threshold: {summary.staleDays}+ days without activity
          </p>

          <ReportKpiRow
            items={[
              { label: 'Total leads', value: summary.totalLeads, tone: 'default' },
              { label: 'Open pipeline', value: summary.openLeads, tone: 'info' },
              { label: 'Stale', value: summary.staleCount, tone: 'warn', hint: 'open & idle' },
              { label: 'Won', value: summary.wonCount, tone: 'success' },
              { label: 'Lost', value: summary.lostCount, tone: 'warn' },
              {
                label: 'Win rate',
                value: summary.winRate != null ? `${summary.winRate}%` : '—',
                hint: 'won / closed',
                tone: 'default',
              },
              {
                label: 'Open → won',
                value:
                  summary.conversionRateOpenToWon != null
                    ? `${summary.conversionRateOpenToWon}%`
                    : '—',
                tone: 'info',
              },
              {
                label: 'Activities (30d)',
                value: summary.activitiesLast30Days,
                tone: 'default',
              },
            ]}
          />

          <section className="analytics-grid">
            <ChartCard
              title="Funnel progression"
              subtitle="Lead count by stage to identify flow drop-offs."
              className="analytics-span-2"
            >
              <BarChart data={funnelData} ariaLabel="Funnel progression by stage" />
            </ChartCard>

            <ChartCard title="Stage mix" subtitle="Distribution of leads across current lifecycle stages.">
              <DonutChart
                ariaLabel="Lead distribution by stage"
                data={stageDonutData}
                centerLabel="Total"
                centerValue={summary.totalLeads.toLocaleString()}
              />
            </ChartCard>

            <ChartCard title="Source performance" subtitle="Top channels feeding the pipeline.">
              {sourceData.length > 0 ? (
                <BarChart data={sourceData} ariaLabel="Top lead sources" compact />
              ) : (
                <p className="muted">No source data yet.</p>
              )}
            </ChartCard>

            <ChartCard title="Win / loss panel" subtitle="Closed-outcome quality for this selected scope.">
              <div className="win-loss-panel">
                <DonutChart
                  ariaLabel="Win and loss split"
                  data={[
                    { label: 'Won', value: summary.wonCount, color: '#10b981' },
                    { label: 'Lost', value: summary.lostCount, color: '#f43f5e' },
                  ]}
                  centerLabel="Closed"
                  centerValue={`${summary.wonCount + summary.lostCount}`}
                  size={180}
                  thickness={18}
                />
                <dl className="win-loss-stats">
                  <div>
                    <dt>Win rate</dt>
                    <dd>{summary.winRate != null ? `${summary.winRate}%` : '—'}</dd>
                  </div>
                  <div>
                    <dt>Wins</dt>
                    <dd>{summary.wonCount.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Losses</dt>
                    <dd>{summary.lostCount.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
            </ChartCard>

            {lossReasonData.length > 0 ? (
              <ChartCard title="Loss reasons" subtitle="Why deals were marked lost in this period.">
                <BarChart data={lossReasonData} ariaLabel="Loss reasons breakdown" compact />
              </ChartCard>
            ) : null}

            {conversionFunnelData.length > 0 ? (
              <ChartCard
                title="Conversion funnel (reached)"
                subtitle="Leads that reached each open pipeline stage in the selected period."
                className="analytics-span-2"
              >
                <BarChart data={conversionFunnelData} ariaLabel="Conversion funnel by stage reached" />
                <table className="funnel-meta-table" style={{ marginTop: 12, width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>% of cohort</th>
                      <th>% from previous</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.conversionFunnel ?? []).map((row) => (
                      <tr key={row.stage}>
                        <td>{row.stage}</td>
                        <td>{row.pctOfTotal}%</td>
                        <td>{row.pctFromPrevious != null ? `${row.pctFromPrevious}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartCard>
            ) : null}

            {timeInStageData.length > 0 ? (
              <ChartCard
                title="Avg time in stage (days)"
                subtitle="Dwell time from stage history in the reporting window."
              >
                <BarChart data={timeInStageData} ariaLabel="Average days in each stage" compact />
              </ChartCard>
            ) : null}

            <ChartCard
              title="Rep performance (period)"
              subtitle="Lead volume and outcomes by owner for the selected date range."
              className="analytics-span-2"
            >
              {ownerRows.length === 0 ? (
                <p className="muted">No owner data in this period.</p>
              ) : (
                <div className="report-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Rep</th>
                        <th scope="col">Total</th>
                        <th scope="col">Open</th>
                        <th scope="col">Won</th>
                        <th scope="col">Lost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownerRows.map((row, index) => (
                        <tr key={row.ownerId}>
                          <td>
                            <strong>
                              #{index + 1} {row.ownerName}
                            </strong>
                            <div className="muted">{row.ownerEmail}</div>
                          </td>
                          <td>{row.count.toLocaleString()}</td>
                          <td>{row.openCount.toLocaleString()}</td>
                          <td>{row.wonCount.toLocaleString()}</td>
                          <td>{row.lostCount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>

            <ChartCard
              title="Team workload (live)"
              subtitle="Current open, overdue, and stale counts from team roster."
              className="analytics-span-2"
            >
              {leaderboard.length === 0 ? (
                <p className="muted">No team members available for ranking.</p>
              ) : (
                <div className="report-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Rep</th>
                        <th scope="col">Team</th>
                        <th scope="col">Open</th>
                        <th scope="col">Overdue</th>
                        <th scope="col">Stale</th>
                        <th scope="col">Last activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row, index) => (
                        <tr key={row.id}>
                          <td>
                            <strong>
                              #{index + 1} {row.name}
                            </strong>
                          </td>
                          <td>{row.teamName}</td>
                          <td>{row.openLeads.toLocaleString()}</td>
                          <td>{row.overdueTasks.toLocaleString()}</td>
                          <td>{row.staleLeads.toLocaleString()}</td>
                          <td>{formatLastActivity(row.lastActivityAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </section>
        </>
      ) : null}
    </div>
  );
}
