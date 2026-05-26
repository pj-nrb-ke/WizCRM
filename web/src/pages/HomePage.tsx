import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { ReportKpiRow } from '../components/ReportKpiRow';
import { BarChart } from '../components/BarChart';
import type {
  PersonalDashboardEventsResponse,
  PersonalDashboardLeadsResponse,
  PersonalDashboardMetrics,
  PersonalDashboardTasksResponse,
  ReportsSummaryResponse,
  ReportSummary,
} from '../lib/report-types';

type AdminHealth = {
  status: string;
  aiEnabled: boolean;
  deskUseAi: boolean;
  apiPublicUrl: string;
  webPublicUrl: string;
};

type QuickLink = {
  to: string;
  title: string;
  description: string;
  accent: 'indigo' | 'emerald' | 'amber' | 'sky';
};

export function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [healthError, setHealthError] = useState('');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [managerAnalyticsError, setManagerAnalyticsError] = useState('');
  const [personalError, setPersonalError] = useState('');
  const [personal, setPersonal] = useState<PersonalDashboardMetrics | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);

  useEffect(() => {
    if (!isManager(user?.role)) return;
    api<AdminHealth>('/admin/health')
      .then(setHealth)
      .catch((e) => setHealthError(e instanceof Error ? e.message : 'Failed to load system status'));
    api<ReportsSummaryResponse>('/reports/summary')
      .then((response) => setSummary(response.summary))
      .catch((e) =>
        setManagerAnalyticsError(e instanceof Error ? e.message : 'Failed to load analytics'),
      );
  }, [user?.role]);

  useEffect(() => {
    if (!user?.id) return;
    setPersonalLoading(true);
    setPersonalError('');
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const calendarQuery = new URLSearchParams({ from, to, view: 'week' });

    Promise.all([
      api<PersonalDashboardLeadsResponse>(`/leads?ownerId=${encodeURIComponent(user.id)}`),
      api<PersonalDashboardTasksResponse>('/tasks'),
      api<PersonalDashboardEventsResponse>(`/calendar/events?${calendarQuery.toString()}`),
      api<{ staleLeadDays?: number }>('/leads/crm-config'),
    ])
      .then(([leadsRes, tasksRes, eventsRes, crmConfig]) => {
        const staleDays =
          typeof crmConfig.staleLeadDays === 'number' ? crmConfig.staleLeadDays : 7;
        setPersonal(buildPersonalMetrics(leadsRes, tasksRes, eventsRes, now, staleDays));
      })
      .catch((e) => {
        setPersonalError(e instanceof Error ? e.message : 'Failed to load personal metrics');
        setPersonal(null);
      })
      .finally(() => setPersonalLoading(false));
  }, [user?.id]);

  const quickLinks: QuickLink[] = [];
  if (isManager(user?.role)) {
    quickLinks.push(
      {
        to: '/manager',
        title: 'Manager home',
        description: 'Team stats, overdue tasks, and rep performance',
        accent: 'indigo',
      },
      {
        to: '/pipeline',
        title: 'Pipeline',
        description: 'Kanban view of leads by stage',
        accent: 'sky',
      },
      {
        to: '/leads',
        title: 'Leads',
        description: 'Search, filter, and open lead details',
        accent: 'emerald',
      },
      {
        to: '/reports',
        title: 'Reports',
        description: 'Export CSV summaries for your org',
        accent: 'amber',
      },
      {
        to: '/calendar',
        title: 'My calendar',
        description: 'Day, week, and month schedule for your team',
        accent: 'sky',
      },
      {
        to: '/organization',
        title: 'Organization',
        description: 'Company profile and branding',
        accent: 'indigo',
      },
      {
        to: '/teams',
        title: 'Teams',
        description: 'Create teams and assign reps',
        accent: 'sky',
      },
    );
  }
  if (isAdmin(user?.role)) {
    quickLinks.push(
      {
        to: '/users',
        title: 'Users',
        description: 'Accounts, roles, and team assignment',
        accent: 'indigo',
      },
      {
        to: '/platform',
        title: 'AI & platform',
        description: 'Desk mode, AI health, and model settings',
        accent: 'amber',
      },
      {
        to: '/connection',
        title: 'Mobile connection',
        description: 'API URL for the field sales app',
        accent: 'emerald',
      },
      {
        to: '/audit',
        title: 'AI audit log',
        description: 'Review AI suggestions and usage',
        accent: 'sky',
      },
    );
  }

  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';
  const dashboardSubtitle = isManager(user?.role)
    ? 'Personal workload plus manager/admin controls.'
    : 'Your open leads, due tasks, stale opportunities, and upcoming events.';

  return (
    <div className="page-dashboard">
      <PageHeader title={`Good ${hourGreeting()}, ${firstName}`} subtitle={dashboardSubtitle} />

      {personalError ? <div className="alert alert-error">{personalError}</div> : null}
      {healthError ? <div className="alert alert-error">{healthError}</div> : null}
      {managerAnalyticsError ? <div className="alert alert-error">{managerAnalyticsError}</div> : null}

      <section className="card" aria-label="My personal dashboard">
        <h2 className="section-title">My dashboard</h2>
        {personalLoading && !personal ? <p className="muted">Loading your metrics...</p> : null}
        {personal ? (
          <div className="kpi-grid kpi-grid-compact">
            <KpiCard label="My open leads" value={personal.openLeads} icon="◎" />
            <KpiCard label="Tasks due" value={personal.tasksDue} icon="⏱" variant="warn" />
            <KpiCard label="Stale leads" value={personal.staleLeads} icon="⚠" variant="warn" />
            <KpiCard label="Upcoming events" value={personal.upcomingEvents} icon="📅" />
          </div>
        ) : null}
      </section>

      {health && (
        <section className="status-grid" aria-label="System status">
          <div className="status-card">
            <span className="status-label">API</span>
            <span className={`badge ${health.status === 'ok' ? 'badge-success' : 'badge-warn'}`}>
              {health.status === 'ok' ? 'Operational' : health.status}
            </span>
          </div>
          <div className="status-card">
            <span className="status-label">AI services</span>
            <span className={`badge ${health.aiEnabled ? 'badge-success' : 'badge-neutral'}`}>
              {health.aiEnabled ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div className="status-card">
            <span className="status-label">Sales desk</span>
            <span className="badge badge-info">
              {health.deskUseAi ? 'AI-ranked' : 'Rules (fast)'}
            </span>
          </div>
          <div className="status-card status-card-wide">
            <span className="status-label">Endpoints</span>
            <span className="status-endpoints">
              <a href={health.apiPublicUrl} target="_blank" rel="noreferrer">
                API
              </a>
              <span className="sep">·</span>
              <a href={health.webPublicUrl} target="_blank" rel="noreferrer">
                Web
              </a>
            </span>
          </div>
        </section>
      )}

      {isManager(user?.role) && summary ? (
        <section className="card home-analytics-snapshot" aria-label="Manager analytics snapshot">
          <div className="card-header-row">
            <h2>Manager analytics snapshot</h2>
            <Link to="/reports" className="linkish">
              Open executive dashboard
            </Link>
          </div>
          <p className="muted">
            Live conversion pulse for your current organization scope, refreshed from reports API.
          </p>
          <ReportKpiRow
            items={[
              { label: 'Open', value: summary.openLeads, tone: 'info' },
              { label: 'Won', value: summary.wonCount, tone: 'success' },
              { label: 'Lost', value: summary.lostCount, tone: 'warn' },
              { label: 'Win rate', value: summary.winRate != null ? `${summary.winRate}%` : '—' },
            ]}
          />
          <div className="analytics-grid analytics-grid-compact">
            <div className="home-analytics-panel">
              <h3 className="section-title">Top sources</h3>
              {(summary.bySource ?? []).length > 0 ? (
                <BarChart
                  ariaLabel="Top lead sources"
                  compact
                  data={summary.bySource.slice(0, 5).map((source, idx) => ({
                    label: source.source,
                    value: source.count,
                    color: idx % 2 === 0 ? 'var(--primary)' : '#818cf8',
                  }))}
                />
              ) : (
                <p className="muted">No source data yet.</p>
              )}
            </div>
            <div className="home-analytics-panel">
              <h3 className="section-title">Stage quick view</h3>
              <BarChart
                ariaLabel="Stage quick view"
                compact
                data={[
                  { label: 'New', value: summary.byStage.NEW ?? 0, color: '#6366f1' },
                  { label: 'Contacted', value: summary.byStage.CONTACTED ?? 0, color: '#818cf8' },
                  { label: 'Qualified', value: summary.byStage.QUALIFIED ?? 0, color: '#0ea5e9' },
                  { label: 'Proposal', value: summary.byStage.PROPOSAL ?? 0, color: '#22c55e' },
                  { label: 'Negotiation', value: summary.byStage.NEGOTIATION ?? 0, color: '#f59e0b' },
                ]}
              />
            </div>
          </div>
        </section>
      ) : null}

      {quickLinks.length > 0 ? (
        <section className="dashboard-section">
          <h2 className="section-title">Quick actions</h2>
          <div className="quick-grid">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to} className={`quick-tile accent-${item.accent}`}>
                <span className="quick-tile-title">{item.title}</span>
                <span className="quick-tile-desc">{item.description}</span>
                <span className="quick-tile-arrow" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="card card-tip">
        <h2 className="section-title">Mobile-first sales</h2>
        <p className="muted">
          WizCRM Lite runs on Android for reps: leads, desk, calls, notes, and card scan. This
          web app is for oversight, configuration, and reporting.
        </p>
      </div>
    </div>
  );
}

function hourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function buildPersonalMetrics(
  leadsRes: PersonalDashboardLeadsResponse,
  tasksRes: PersonalDashboardTasksResponse,
  eventsRes: PersonalDashboardEventsResponse,
  now: Date,
  staleDays = 7,
): PersonalDashboardMetrics {
  const staleCutoffMs = now.getTime() - staleDays * 24 * 60 * 60 * 1000;
  const dueCutoff = new Date(now);
  dueCutoff.setHours(23, 59, 59, 999);
  const upcomingCutoffMs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const openLeads = (leadsRes.leads ?? []).filter((lead) => !isClosedStage(lead.stage)).length;
  const staleLeads = (leadsRes.leads ?? []).filter((lead) => {
    if (isClosedStage(lead.stage)) return false;
    const lastTouch = lead.lastActivityAt ?? lead.updatedAt;
    return new Date(lastTouch).getTime() <= staleCutoffMs;
  }).length;
  const tasksDue = (tasksRes.tasks ?? []).filter((task) => {
    if (task.completedAt) return false;
    if (!task.dueAt) return false;
    return new Date(task.dueAt).getTime() <= dueCutoff.getTime();
  }).length;
  const upcomingEvents = (eventsRes.events ?? []).filter((event) => {
    const startMs = new Date(event.startAt).getTime();
    return startMs >= nowMs && startMs <= upcomingCutoffMs;
  }).length;

  return { openLeads, tasksDue, staleLeads, upcomingEvents };
}

function isClosedStage(stage: string) {
  return stage === 'WON' || stage === 'LOST';
}
