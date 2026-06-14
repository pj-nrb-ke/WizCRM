/**
 * GaugeMeterRow — four enterprise-grade semi-circle meters on the dashboard.
 *
 * Scores are computed from live API data (summary + orgStats) with graceful
 * fallbacks when data is still loading.
 *
 * Meters:
 *   1. Pipeline Health Score      – closure ratio + activity velocity + win rate
 *   2. Sales Target Achievement   – win rate vs 60 % enterprise stretch target
 *   3. Team Productivity Score    – overdue tasks + lead freshness + activity vol
 *   4. AI Lead Quality Score      – conversion quality + engagement + pipeline health
 */

import { Activity, Target, Users, Zap } from 'lucide-react';
import type { ReportSummary } from '../../lib/report-types';
import { EnterpriseGauge } from './gauges/EnterpriseGauge';

type OrgStats = {
  open: number;
  won: number;
  stale: number;
  overdue: number;
};

type Props = {
  summary: ReportSummary | null;
  orgStats: OrgStats | null;
  loading?: boolean;
};

// ── score calculators ────────────────────────────────────────────────────────

function pipelineHealthScore(won: number, open: number, activities: number, winRate: number): number {
  return Math.min(
    100,
    Math.round(
      (won / Math.max(won + open, 1)) * 40 +
        Math.min(activities / 50, 1) * 35 +
        Math.min(winRate / 60, 1) * 25,
    ),
  );
}

function targetAchievementScore(winRate: number | null, wonCount: number, totalLeads: number): number {
  const wr = winRate ?? 0;
  // Win rate relative to 60 % enterprise stretch target = 75 pts
  const wrScore = Math.min(75, Math.round((wr / 60) * 75));
  // Lead-to-won conversion efficiency = 25 pts
  const convScore = Math.min(25, Math.round((wonCount / Math.max(totalLeads, 1)) * 100));
  return Math.min(100, wrScore + convScore);
}

function productivityScore(open: number, stale: number, overdue: number, activities: number): number {
  const staleRatio = stale / Math.max(open, 1);
  // Overdue task pressure (40 pts): penalise overdue relative to pipeline size
  const overdueScore = Math.max(0, 1 - overdue / Math.max(open + 4, 1)) * 40;
  // Lead freshness (35 pts): penalise stale ratio
  const freshnessScore = Math.max(0, 1 - staleRatio) * 35;
  // Activity velocity (25 pts): 60 activities/month ≈ full score
  const activityScore = Math.min(1, activities / 60) * 25;
  return Math.min(100, Math.round(overdueScore + freshnessScore + activityScore));
}

function aiLeadQualityScore(summary: ReportSummary): number {
  const { winRate, wonCount, totalLeads, staleCount, activitiesLast30Days } = summary;
  const wr = winRate ?? 0;
  // Win-rate quality signal (40 pts): 50 % win rate = full component
  const qualScore = Math.min(40, Math.round((wr / 50) * 40));
  // Engagement velocity (30 pts): 80 activities = full component
  const engScore = Math.min(30, Math.round(Math.min(1, activitiesLast30Days / 80) * 30));
  // Pipeline health ratio (30 pts): freshness + closure contribution
  const healthRatio =
    (1 - staleCount / Math.max(totalLeads, 1)) * 0.65 +
    (wonCount / Math.max(totalLeads, 1)) * 0.35;
  const healthScore = Math.min(30, Math.round(healthRatio * 30));
  return Math.min(100, qualScore + engScore + healthScore);
}

// ── component ────────────────────────────────────────────────────────────────

export function GaugeMeterRow({ summary, orgStats, loading = false }: Props) {
  const isLoading = loading || !summary || !orgStats;

  const pipeline = isLoading
    ? 0
    : pipelineHealthScore(orgStats!.won, orgStats!.open, summary!.activitiesLast30Days, summary!.winRate ?? 0);

  const target = isLoading
    ? 0
    : targetAchievementScore(summary!.winRate, summary!.wonCount, summary!.totalLeads);

  const productivity = isLoading
    ? 0
    : productivityScore(orgStats!.open, orgStats!.stale, orgStats!.overdue, summary!.activitiesLast30Days);

  const aiQuality = isLoading ? 0 : aiLeadQualityScore(summary!);

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 items-center justify-center rounded-md"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
          >
            <Activity size={11} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-700 uppercase tracking-widest text-slate-400">
            Performance Meters
          </span>
        </div>
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] text-slate-300 font-500">Live · computed</span>
      </div>

      {/* 4-column responsive gauge grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))' }}
      >
        <EnterpriseGauge
          gaugeId="pipeline"
          label="Pipeline Health"
          score={pipeline}
          description="All teams · live score"
          tooltip="Composite of deal closure ratio (40%), 30-day activity volume (35%), and win rate vs 60% target (25%). Reflects overall pipeline vitality."
          loading={isLoading}
          delay={0}
        />

        <EnterpriseGauge
          gaugeId="target"
          label="Sales Target Achievement"
          score={target}
          description="Win rate vs 60 % target"
          tooltip="Measures win rate against a 60% enterprise stretch target (75 pts) plus lead-to-won conversion efficiency (25 pts). 60% win rate = 100 score."
          loading={isLoading}
          delay={90}
        />

        <EnterpriseGauge
          gaugeId="productivity"
          label="Team Productivity"
          score={productivity}
          description="Tasks · freshness · velocity"
          tooltip="Composite of overdue-task pressure (40 pts), lead freshness vs stale threshold (35 pts), and monthly activity velocity (25 pts)."
          loading={isLoading}
          delay={180}
        />

        <EnterpriseGauge
          gaugeId="ailead"
          label="AI Lead Quality"
          score={aiQuality}
          description="Conversion · engagement signals"
          tooltip="AI-computed quality signal: win-rate quality (40 pts), engagement velocity — activities per month (30 pts), and pipeline freshness + closure ratio (30 pts)."
          loading={isLoading}
          delay={270}
        />
      </div>

      {/* Meter legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5">
        {[
          { color: '#10b981', label: 'Strong  ≥ 70' },
          { color: '#f59e0b', label: 'Moderate  40–69' },
          { color: '#ef4444', label: 'At Risk  < 40' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-[10px] text-slate-400">
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            {label}
          </span>
        ))}
        <span className="ml-auto text-[10px] text-slate-300 hidden sm:block">
          Score 0–100
        </span>
      </div>
    </div>
  );
}

// Re-export icon helpers used only by this row (tree-shake friendly)
export { Activity, Target, Users, Zap };
