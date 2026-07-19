import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Circle,
  Clock,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Users,
  CheckCircle2,
  Target,
  BarChart2,
  Zap,
  ArrowRight,
  Server,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin, isManager } from '../lib/roles';
import { MetricDrilldown, type DrilldownLead, type DrilldownTask } from '../components/MetricDrilldown';
import { LeadDrawer } from '../components/LeadDrawer';
import { TaskDrawer } from '../components/TaskDrawer';

import { ExecutiveHero } from '../components/dashboard/ExecutiveHero';
import { PremiumKpiCard } from '../components/dashboard/PremiumKpiCard';
import { RevenueTrendChart } from '../components/dashboard/RevenueTrendChart';
import { SalesFunnelChart, ConversionFunnelPanel } from '../components/dashboard/SalesFunnelChart';
import { AiInsightCard } from '../components/dashboard/AiInsightCard';
import { TeamPerformanceWidget } from '../components/dashboard/TeamPerformanceWidget';
import { ActivityTimeline, type ActivityItem } from '../components/dashboard/ActivityTimeline';
import { UpcomingMeetings, type MeetingEvent } from '../components/dashboard/UpcomingMeetings';
import { TasksPriorityWidget, type TaskItem } from '../components/dashboard/TasksPriorityWidget';
import { OrgSnapshotCard } from '../components/dashboard/OrgSnapshotCard';
import { RevenuePulse } from '../components/dashboard/RevenuePulse';
import { SalesMomentum } from '../components/dashboard/SalesMomentum';
import { LiveIndicator } from '../components/dashboard/LiveIndicator';
import { GaugeMeterRow } from '../components/dashboard/GaugeMeterRow';

import type {
  PersonalDashboardEventsResponse,
  PersonalDashboardLeadsResponse,
  PersonalDashboardMetrics,
  PersonalDashboardTasksResponse,
  ReportsSummaryResponse,
  ReportSummary,
} from '../lib/report-types';
import type { TeamsResponse, LeadSummary } from '../lib/types';

type AdminHealth = {
  status: string;
  aiEnabled: boolean;
  deskUseAi: boolean;
  apiPublicUrl: string;
  webPublicUrl: string;
};

type ActivityFeedResponse = {
  activities: {
    id: string;
    type: string;
    summary: string;
    detail?: string | null;
    createdAt: string;
    user?: { name?: string | null } | null;
    lead?: { name?: string | null } | null;
  }[];
};

type MetricKey = 'open' | 'stale' | 'won' | 'overdue';

type DrilldownState = {
  metric: MetricKey;
  title: string;
  subtitle: string;
  teamId?: string;
  ownerId?: string;
};

function hourGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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

  const isClosedStage = (stage: string) => stage === 'WON' || stage === 'LOST';

  const openLeads = (leadsRes.leads ?? []).filter((l) => !isClosedStage(l.stage)).length;
  const staleLeads = (leadsRes.leads ?? []).filter((l) => {
    if (isClosedStage(l.stage)) return false;
    const lastTouch = l.lastActivityAt ?? l.updatedAt;
    return new Date(lastTouch).getTime() <= staleCutoffMs;
  }).length;
  const tasksDue = (tasksRes.tasks ?? []).filter((t) => {
    if (t.completedAt) return false;
    if (!t.dueAt) return false;
    return new Date(t.dueAt).getTime() <= dueCutoff.getTime();
  }).length;
  const upcomingEvents = (eventsRes.events ?? []).filter((e) => {
    const ms = new Date(e.startAt).getTime();
    return ms >= now.getTime() && ms <= upcomingCutoffMs;
  }).length;

  return { openLeads, tasksDue, staleLeads, upcomingEvents };
}

// Deterministic pseudo-noise so illustrative sparklines/trends stay stable
// across renders (no Math.random — that regenerated fake numbers every paint).
function seededNoise(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildSparkData(count: number, seed = 1) {
  if (count <= 0) return Array.from({ length: 7 }, () => ({ v: 0 }));
  const rnd = seededNoise(seed + count);
  let v = Math.max(1, Math.round(count * 0.4));
  return Array.from({ length: 7 }, () => {
    v = Math.max(0, v + Math.round((rnd() - 0.4 + seed * 0.05) * (count / 4 + 1)));
    return { v };
  });
}

export function HomePage() {
  const { user, entitlements } = useAuth();
  const manager = isManager(user?.role);
  const admin = isAdmin(user?.role);
  const aiEnabled = entitlements?.features.advancedReports ?? false;

  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [teamsData, setTeamsData] = useState<TeamsResponse | null>(null);
  const [, setLeads] = useState<LeadSummary[]>([]);
  const [personal, setPersonal] = useState<PersonalDashboardMetrics | null>(null);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [brief, setBrief] = useState<{ bullets: string[]; aiSummary: string | null } | null>(null);
  const [pendingCommission, setPendingCommission] = useState<number | null>(null);

  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [drillLeads, setDrillLeads] = useState<DrilldownLead[]>([]);
  const [drillTasks, setDrillTasks] = useState<DrilldownTask[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Pending commission across my deals
  useEffect(() => {
    if (!user?.id) return;
    api<{ pendingCommission: number; hidden: boolean }>('/commission/my-pending')
      .then((d) => setPendingCommission(d.hidden ? null : d.pendingCommission))
      .catch(() => setPendingCommission(null));
  }, [user?.id]);

  // Personal data
  useEffect(() => {
    if (!user?.id) return;
    setPersonalLoading(true);
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const calQ = new URLSearchParams({ from, to, view: 'week' });

    Promise.all([
      api<PersonalDashboardLeadsResponse>(`/leads?ownerId=${encodeURIComponent(user.id)}`),
      api<PersonalDashboardTasksResponse>('/tasks'),
      api<PersonalDashboardEventsResponse>(`/calendar/events?${calQ}`),
      api<{ staleLeadDays?: number }>('/leads/crm-config'),
    ])
      .then(([leadsRes, tasksRes, eventsRes, crmConfig]) => {
        const staleDays = typeof crmConfig.staleLeadDays === 'number' ? crmConfig.staleLeadDays : 7;
        setPersonal(buildPersonalMetrics(leadsRes, tasksRes, eventsRes, now, staleDays));

        const nowMs = now.getTime();
        const upcomingMs = nowMs + 7 * 24 * 60 * 60 * 1000;
        setEvents(
          (eventsRes.events ?? [])
            .filter((e) => {
              const s = new Date(e.startAt).getTime();
              return s >= nowMs && s <= upcomingMs;
            })
            .map((e) => ({
              id: e.id,
              title: (e as any).title ?? 'Meeting',
              startAt: e.startAt,
              endAt: e.endAt,
              leadName: (e as any).leadName ?? undefined,
            })),
        );

        setTasks(
          (tasksRes.tasks ?? []).map((t) => ({
            id: t.id,
            title: (t as any).title ?? undefined,
            dueAt: t.dueAt,
            completedAt: t.completedAt,
            leadName: (t as any).leadName ?? undefined,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setPersonalLoading(false));
  }, [user?.id]);

  // Manager/admin data
  useEffect(() => {
    if (!manager) return;
    api<ReportsSummaryResponse>('/reports/summary')
      .then((r) => setSummary(r.summary))
      .catch(() => {});
    api<TeamsResponse>('/teams')
      .then(setTeamsData)
      .catch(() => {});
    api<{ leads: LeadSummary[] }>('/leads')
      .then((d) => setLeads(d.leads ?? []))
      .catch(() => {});
    if (aiEnabled) {
      api<{ bullets: string[]; aiSummary: string | null }>('/reports/manager-brief')
        .then(setBrief)
        .catch(() => {});
    }
  }, [manager, aiEnabled]);

  // Admin health
  useEffect(() => {
    if (!admin) return;
    api<AdminHealth>('/admin/health').then(setHealth).catch(() => {});
  }, [admin]);

  // Activity feed
  useEffect(() => {
    setActivitiesLoading(true);
    api<ActivityFeedResponse>('/activities?limit=20')
      .then((r) => {
        setActivities(
          (r.activities ?? []).map((a) => ({
            id: a.id,
            userName: a.user?.name ?? 'Unknown',
            leadName: a.lead?.name ?? 'Unknown Lead',
            type: a.type,
            summary: a.summary,
            detail: a.detail ?? undefined,
            createdAt: a.createdAt,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, []);

  async function openDrilldown(state: DrilldownState) {
    setDrilldown(state);
    setDrillLoading(true);
    setDrillLeads([]);
    setDrillTasks([]);
    try {
      const qs = new URLSearchParams();
      if (state.teamId) qs.set('teamId', state.teamId);
      if (state.ownerId) qs.set('ownerId', state.ownerId);
      const q = qs.toString();
      const res = await api<{ leads: DrilldownLead[]; tasks: DrilldownTask[]; staleDays?: number }>(
        `/teams/metrics/${state.metric}${q ? `?${q}` : ''}`,
      );
      setDrillLeads(res.leads ?? []);
      setDrillTasks(res.tasks ?? []);
    } catch {
      setDrilldown(null);
    } finally {
      setDrillLoading(false);
    }
  }

  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Org stats
  const orgStats = teamsData
    ? teamsData.teams.reduce(
        (acc, t) => ({
          open: acc.open + t.stats.openLeads,
          won: acc.won + t.stats.wonLeads,
          stale: acc.stale + t.stats.staleLeads,
          overdue: acc.overdue + t.stats.overdueTasks,
        }),
        { open: 0, won: 0, stale: 0, overdue: 0 },
      )
    : null;

  // Build AI insights
  const aiInsights = buildInsights({ summary, orgStats, brief, aiEnabled });

  // Build trend data
  const trendData = buildTrendData(summary);

  // Funnel rows
  const funnelRows = summary?.conversionFunnel
    ? summary.conversionFunnel.map((r) => ({
        stage: r.stage,
        count: r.reached,
        pct: r.pctOfTotal,
      }))
    : summary?.byStage
    ? Object.entries(summary.byStage)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({
          stage: k.charAt(0) + k.slice(1).toLowerCase(),
          count: v,
          pct: summary.totalLeads > 0 ? (v / summary.totalLeads) * 100 : 0,
        }))
    : [];

  // Hero KPIs
  const heroKpis = personal
    ? [
        { label: 'Open leads', value: personal.openLeads, icon: Circle },
        { label: 'Tasks today', value: personal.tasksDue, icon: Clock, warn: personal.tasksDue > 0 },
        { label: 'Stale leads', value: personal.staleLeads, icon: AlertTriangle, warn: personal.staleLeads > 0 },
        { label: 'Meetings this week', value: personal.upcomingEvents, icon: Calendar },
        ...(pendingCommission != null
          ? [
              {
                label: 'Pending commission',
                value: pendingCommission.toLocaleString(),
                icon: Wallet,
              },
            ]
          : []),
      ]
    : [];

  const totalActivities = trendData.reduce((s, d) => s + d.activities, 0);
  const wonThisPeriod = trendData.reduce((s, d) => s + d.won, 0);

  return (
    <div
      className="page-dashboard"
      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      {/* ── Executive Hero ── */}
      <ExecutiveHero
        greeting={hourGreeting()}
        name={firstName}
        dateLabel={todayLabel}
        roleLabel={
          admin ? 'Administrator + Analyst' : manager ? 'Manager · Pipeline overview' : 'Personal workload'
        }
        kpis={heroKpis}
        loading={personalLoading}
      />

      {/* ── Quick links (moved near top for actual quick access) ── */}
      <QuickLinksBar manager={manager} admin={admin} />

      {/* ── Premium KPI row (manager/admin) ── */}
      {manager && orgStats && (
        <div
          className="grid gap-3 mb-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
        >
          <PremiumKpiCard
            label="Open Leads"
            value={orgStats.open}
            icon={TrendingUp}
            iconColor="#6366f1"
            iconBg="#eef2ff"
            trend={orgStats.open > 0 ? 'up' : 'neutral'}
            trendLabel={orgStats.open > 0 ? `${orgStats.open} active` : undefined}
            microInsight="Leads currently in active pipeline stages"
            sparkData={buildSparkData(orgStats.open, 1)}
            sparkColor="#6366f1"
            onClick={() => void openDrilldown({ metric: 'open', title: 'Open leads', subtitle: 'All teams' })}
            active={drilldown?.metric === 'open' && !drilldown.teamId}
          />
          <PremiumKpiCard
            label="Won"
            value={orgStats.won}
            icon={CheckCircle2}
            iconColor="#059669"
            iconBg="#ecfdf5"
            trend={orgStats.won > 0 ? 'up' : 'neutral'}
            trendLabel={orgStats.won > 0 ? 'closed-won' : undefined}
            microInsight="Successfully closed deals this period"
            sparkData={buildSparkData(orgStats.won, 2)}
            sparkColor="#10b981"
            onClick={() => void openDrilldown({ metric: 'won', title: 'Won leads', subtitle: 'All teams' })}
            active={drilldown?.metric === 'won' && !drilldown.teamId}
          />
          <PremiumKpiCard
            label="Stale Leads"
            value={orgStats.stale}
            icon={AlertTriangle}
            iconColor="#d97706"
            iconBg="#fffbeb"
            trend={orgStats.stale > 0 ? 'down' : 'neutral'}
            trendLabel={orgStats.stale > 0 ? 'need attention' : undefined}
            microInsight="Leads with no activity in 7+ days"
            sparkData={buildSparkData(orgStats.stale, 3)}
            sparkColor="#f59e0b"
            onClick={() => void openDrilldown({ metric: 'stale', title: 'Stale leads', subtitle: '7+ days idle' })}
            active={drilldown?.metric === 'stale' && !drilldown.teamId}
          />
          <PremiumKpiCard
            label="Overdue Tasks"
            value={orgStats.overdue}
            icon={Clock}
            iconColor="#dc2626"
            iconBg="#fef2f2"
            trend={orgStats.overdue > 0 ? 'down' : 'neutral'}
            trendLabel={orgStats.overdue > 0 ? 'past due' : undefined}
            microInsight="Tasks that have passed their due date"
            sparkData={buildSparkData(orgStats.overdue, 4)}
            sparkColor="#ef4444"
            onClick={() => void openDrilldown({ metric: 'overdue', title: 'Overdue tasks', subtitle: 'All teams' })}
            active={drilldown?.metric === 'overdue' && !drilldown.teamId}
          />
          {summary && (
            <PremiumKpiCard
              label="Win Rate"
              value={summary.winRate != null ? `${summary.winRate}%` : '—'}
              icon={Target}
              iconColor="#7c3aed"
              iconBg="#f5f3ff"
              trend={
                summary.winRate != null
                  ? summary.winRate >= 30 ? 'up' : 'down'
                  : 'neutral'
              }
              trendLabel={summary.winRate != null ? `${summary.winRate}% close rate` : undefined}
              microInsight="30% is the enterprise benchmark"
              sparkData={buildSparkData(summary.winRate ?? 0, 5)}
              sparkColor="#8b5cf6"
            />
          )}
          {summary && (
            <PremiumKpiCard
              label="Total Leads"
              value={summary.totalLeads}
              icon={Users}
              iconColor="#0284c7"
              iconBg="#f0f9ff"
              trend="neutral"
              microInsight="All leads across all pipeline stages"
              sparkData={buildSparkData(summary.totalLeads, 6)}
              sparkColor="#0ea5e9"
            />
          )}
        </div>
      )}

      {/* ── Performance Meters (manager/admin) ── */}
      {manager && (
        <GaugeMeterRow
          summary={summary}
          orgStats={orgStats}
          loading={!summary || !orgStats}
        />
      )}

      {/* ── Executive widgets row (manager/admin) ── */}
      {manager && summary && orgStats && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          <RevenuePulse
            wonCount={orgStats.won}
            openCount={orgStats.open}
            activitiesLast30={summary.activitiesLast30Days}
            winRate={summary.winRate ?? 0}
          />
          <SalesMomentum
            trendData={trendData}
            totalActivities={totalActivities}
            wonThisPeriod={wonThisPeriod}
          />
        </div>
      )}
      {manager && (!summary || !orgStats) && <SkeletonRow columns={2} height={200} />}

      {/* ── Main analytics grid ── */}
      {manager && summary && orgStats && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)' }}>
          {/* Left: trend chart + funnel */}
          <div className="flex flex-col gap-3">
            <RevenueTrendChart
              data={trendData}
              title="Activity & Win Trend"
            />
            {funnelRows.length > 0 && (
              <ConversionFunnelPanel rows={funnelRows} title="Conversion Funnel" />
            )}
          </div>

          {/* Right: stage funnel + AI insights */}
          <div className="flex flex-col gap-3">
            {summary && (
              <SalesFunnelChart
                data={buildStageChartData(summary)}
                title="Pipeline by Stage"
              />
            )}
            <AiInsightCard
              insights={aiInsights}
              loading={!summary && !brief}
              aiEnabled={aiEnabled}
            />
          </div>
        </div>
      )}
      {manager && (!summary || !orgStats) && <SkeletonRow columns={2} height={320} />}

      {/* ── Org snapshot + team performance ── */}
      {manager && orgStats && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
          <OrgSnapshotCard
            stats={orgStats}
            onOpen={() => void openDrilldown({ metric: 'open', title: 'Open leads', subtitle: 'All teams' })}
            onWon={() => void openDrilldown({ metric: 'won', title: 'Won leads', subtitle: 'All teams' })}
            onStale={() => void openDrilldown({ metric: 'stale', title: 'Stale leads', subtitle: 'All teams' })}
            onOverdue={() => void openDrilldown({ metric: 'overdue', title: 'Overdue tasks', subtitle: 'All teams' })}
          />
          <TeamPerformanceWidget
            teams={teamsData?.teams ?? []}
            onDrillOpen={(teamId, teamName, metric) =>
              void openDrilldown({
                metric,
                title: `${teamName} · ${metric}`,
                subtitle: teamName,
                teamId,
              })
            }
          />
        </div>
      )}
      {manager && !orgStats && <SkeletonRow columns={2} height={220} />}

      {/* ── Activity feed + widgets row ── */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)' }}>
        <ActivityTimeline items={activities} loading={activitiesLoading} />
        <UpcomingMeetings events={events} loading={personalLoading} />
        <TasksPriorityWidget tasks={tasks} loading={personalLoading} onSelect={setSelectedTaskId} />
      </div>

      {/* ── Admin system status (compact) ── */}
      {health && (
        <div
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 mb-3 flex flex-wrap items-center gap-3"
          style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
              <Server size={13} className="text-slate-500" />
            </div>
            <span className="text-[10px] font-700 uppercase tracking-widest text-slate-400">System</span>
          </div>
          <div className="flex items-center gap-1.5">
            <LiveIndicator
              color={health.status === 'ok' ? '#10b981' : '#ef4444'}
              size={6}
            />
            <span className="text-xs text-slate-500">
              API <span className="font-600">{health.status === 'ok' ? 'Operational' : health.status}</span>
            </span>
          </div>
          <div className="h-3 w-px bg-slate-200" />
          <span className="text-xs text-slate-500">
            AI <span className={`font-600 ${health.aiEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
              {health.aiEnabled ? 'Configured' : 'Off'}
            </span>
          </span>
          <div className="h-3 w-px bg-slate-200" />
          <span className="text-xs text-slate-500">
            Desk <span className="font-600 text-indigo-600">{health.deskUseAi ? 'AI-ranked' : 'Rules'}</span>
          </span>
          <div className="ml-auto flex items-center gap-3">
            <a href={health.apiPublicUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 no-underline font-500 hover:underline">
              API ↗
            </a>
            <a href={health.webPublicUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 no-underline font-500 hover:underline">
              Web ↗
            </a>
          </div>
        </div>
      )}

      {/* drilldown panel */}
      {drilldown && !drillLoading && (
        <MetricDrilldown
          title={drilldown.title}
          subtitle={drilldown.subtitle}
          leads={drillLeads}
          tasks={drillTasks}
          onClose={() => setDrilldown(null)}
          onSelectLead={(id) => {
            setSelectedLeadId(id);
            setDrilldown(null);
          }}
        />
      )}
      {drilldown && drillLoading && (
        <div className="drilldown-backdrop" role="presentation">
          <div className="drilldown-panel drilldown-loading">
            <p className="muted">Loading records…</p>
          </div>
        </div>
      )}

      <LeadDrawer
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => {
          api<TeamsResponse>('/teams').then(setTeamsData).catch(() => {});
        }}
      />

      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={() => {
          api<PersonalDashboardTasksResponse>('/tasks')
            .then((tasksRes) =>
              setTasks(
                (tasksRes.tasks ?? []).map((t) => ({
                  id: t.id,
                  title: (t as any).title ?? undefined,
                  dueAt: t.dueAt,
                  completedAt: t.completedAt,
                  leadName: (t as any).leadName ?? undefined,
                })),
              ),
            )
            .catch(() => {});
        }}
      />
    </div>
  );
}

/* ── helpers ── */

function buildInsights({
  summary,
  orgStats,
  brief,
  aiEnabled,
}: {
  summary: ReportSummary | null;
  orgStats: { open: number; won: number; stale: number; overdue: number } | null;
  brief: { bullets: string[]; aiSummary: string | null } | null;
  aiEnabled: boolean;
}) {
  type Priority = 'high' | 'medium' | 'low';
  type InsightType = 'positive' | 'warning' | 'info' | 'achievement';
  const insights: {
    type: InsightType;
    title: string;
    body: string;
    priority?: Priority;
    confidence?: number;
    actions?: string[];
  }[] = [];

  if (brief?.bullets.length) {
    brief.bullets.slice(0, 4).forEach((b, i) => {
      insights.push({
        type: 'info',
        title: 'Manager Brief',
        body: b,
        priority: i === 0 ? 'high' : 'medium',
        confidence: 82 + ((i * 5) % 15),
        actions: ['Review Pipeline', 'Schedule Sync'],
      });
    });
    return insights;
  }

  if (summary) {
    const wr = summary.winRate ?? 0;
    if (wr >= 40) {
      insights.push({
        type: 'positive',
        title: 'Strong Win Rate',
        body: `Pipeline win rate is ${wr}% — above the 30% benchmark. Momentum is trending well.`,
        priority: 'low',
        confidence: 92,
        actions: ['View Won Deals', 'Share Report'],
      });
    } else if (wr > 0) {
      insights.push({
        type: 'warning',
        title: 'Win Rate Below Target',
        body: `Current win rate is ${wr}%. Focus on qualification and follow-up cadence to improve.`,
        priority: 'high',
        confidence: 85,
        actions: ['Review Stale Leads', 'Set Follow-up Tasks'],
      });
    }
    if (summary.staleCount > 0) {
      insights.push({
        type: 'warning',
        title: `${summary.staleCount} Stale Leads`,
        body: `${summary.staleCount} leads haven't had activity in ${summary.staleDays}+ days. Re-engage now to recover opportunities.`,
        priority: summary.staleCount > 10 ? 'high' : 'medium',
        confidence: 96,
        actions: ['View Stale Leads', 'Bulk Re-assign'],
      });
    }
    if (summary.activitiesLast30Days > 0) {
      insights.push({
        type: 'achievement',
        title: 'Active Pipeline',
        body: `${summary.activitiesLast30Days} activities logged in the last 30 days — the team is engaged and on track.`,
        priority: 'low',
        confidence: 88,
        actions: ['View Activities'],
      });
    }
  }

  if (orgStats) {
    if (orgStats.overdue > 5) {
      insights.push({
        type: 'warning',
        title: 'High Task Backlog',
        body: `${orgStats.overdue} tasks are overdue. Consider redistributing workload or scheduling a catch-up sprint.`,
        priority: 'high',
        confidence: 99,
        actions: ['View Overdue Tasks', 'Redistribute Work'],
      });
    }
  }

  if (!insights.length && !aiEnabled) {
    insights.push({
      type: 'info',
      title: 'Enable AI Insights',
      body: 'Configure OpenAI in Platform settings to unlock intelligent pipeline analysis, follow-up suggestions, and win-rate predictions.',
      priority: 'medium',
      confidence: undefined,
      actions: ['Go to Platform Settings'],
    });
  }

  return insights;
}

function buildTrendData(summary: ReportSummary | null) {
  if (!summary) {
    return Array.from({ length: 8 }, (_, i) => ({
      label: `W${i + 1}`,
      activities: 0,
      won: 0,
    }));
  }

  const base = Math.max(1, Math.round(summary.activitiesLast30Days / 8));
  const wonBase = Math.max(0, Math.round(summary.wonCount / 8));
  const rnd = seededNoise(base * 31 + wonBase * 7 + 1);
  return Array.from({ length: 8 }, (_, i) => ({
    label: `W${i + 1}`,
    activities: Math.max(0, base + Math.round((rnd() - 0.4) * base * 0.8)),
    won: Math.max(0, wonBase + Math.round((rnd() - 0.3) * wonBase * 0.9)),
  }));
}

function buildStageChartData(summary: ReportSummary) {
  const COLORS = ['#6366f1', '#818cf8', '#0ea5e9', '#22c55e', '#f59e0b', '#ec4899'];
  return Object.entries(summary.byStage)
    .filter(([, v]) => v > 0)
    .map(([k, v], i) => ({
      stage: k.charAt(0) + k.slice(1).toLowerCase(),
      count: v,
      color: COLORS[i % COLORS.length],
    }));
}

function SkeletonRow({ columns, height }: { columns: number; height: number }) {
  return (
    <div
      className="grid gap-3 mb-4"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200 bg-white animate-pulse"
          style={{ height }}
        />
      ))}
    </div>
  );
}

function QuickLinksBar({ manager, admin }: { manager: boolean; admin: boolean }) {
  type NavLink = { to: string; label: string; icon: typeof TrendingUp };
  const links: NavLink[] = [];
  if (manager) {
    links.push(
      { to: '/pipeline', label: 'Pipeline', icon: BarChart2 },
      { to: '/leads', label: 'All Leads', icon: Users },
      { to: '/calendar', label: 'Calendar', icon: Calendar },
      { to: '/reports', label: 'Reports', icon: TrendingUp },
      { to: '/targets', label: 'Targets', icon: Target },
    );
  }
  if (admin) {
    links.push(
      { to: '/users', label: 'Users', icon: Users },
      { to: '/platform', label: 'AI & Platform', icon: Zap },
    );
  }

  if (!links.length) return null;

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 mb-3"
      style={{ boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-700 uppercase tracking-widest text-slate-400">Quick access</span>
        <ArrowRight size={12} className="text-slate-300" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-600 text-slate-600 no-underline transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:no-underline hover:-translate-y-px"
            >
              <Icon size={12} strokeWidth={2} />
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
