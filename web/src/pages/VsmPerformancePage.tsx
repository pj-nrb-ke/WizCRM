import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';

interface VsmKpiTargets {
  taskCompletionRatePct?: number;
  medianResponseHours?: number;
  staleLeadReductionPct?: number;
  planEditRateCeilingPct?: number;
}

interface VsmPerformanceSnapshot {
  taskCompletionRatePct: number | null;
  medianResponseHours: number | null;
  currentStaleLeadCount: number;
  staleLeadReductionPct: number | null;
  planEditRatePct: number | null;
  sampleSizes: { tasksConsidered: number; morningRunsConsidered: number };
}

interface AutoModeEligibility {
  eligible: boolean;
  uneditedCount: number;
  totalCount: number;
  reason: string;
}

// Direction the metric should move to be "good" — used to color actual vs. target.
type Direction = 'higher-is-better' | 'lower-is-better';

function metricStatus(actual: number | null, target: number | undefined, direction: Direction): 'good' | 'bad' | 'neutral' {
  if (actual === null || target === undefined) return 'neutral';
  const met = direction === 'higher-is-better' ? actual >= target : actual <= target;
  return met ? 'good' : 'bad';
}

const STATUS_STYLE: Record<'good' | 'bad' | 'neutral', { bg: string; fg: string }> = {
  good: { bg: '#f0fdf4', fg: '#15803d' },
  bad: { bg: '#fef2f2', fg: '#dc2626' },
  neutral: { bg: '#f8fafc', fg: '#64748b' },
};

export function VsmPerformancePage() {
  const [performance, setPerformance] = useState<VsmPerformanceSnapshot | null>(null);
  const [targets, setTargets] = useState<VsmKpiTargets>({});
  const [eligibility, setEligibility] = useState<AutoModeEligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      api<{ performance: VsmPerformanceSnapshot; kpiTargets: VsmKpiTargets }>('/vsm/performance'),
      api<{ eligibility: AutoModeEligibility }>('/vsm/auto-mode-eligibility'),
    ])
      .then(([p, e]) => {
        setPerformance(p.performance);
        setTargets(p.kpiTargets ?? {});
        setEligibility(e.eligibility);
      })
      .catch(() => setError('Failed to load VSM performance.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function saveTargets() {
    setSaving(true);
    setError(null);
    try {
      await api('/vsm/config', { method: 'PATCH', body: { kpiTargets: targets } });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save KPI targets.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !performance) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading VSM performance…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
            VSM Performance
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
            The CEO's own KPIs for the VSM itself — actual vs. target, trailing 30 days. The same evidence used to decide
            when auto mode unlocks.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <Section title="Metrics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <MetricCard
            label="Task completion rate"
            actual={performance.taskCompletionRatePct}
            actualSuffix="%"
            target={targets.taskCompletionRatePct}
            targetSuffix="%"
            direction="higher-is-better"
            onTargetChange={(v) => setTargets((t) => ({ ...t, taskCompletionRatePct: v }))}
            note={`${performance.sampleSizes.tasksConsidered} VSM task${performance.sampleSizes.tasksConsidered === 1 ? '' : 's'} considered`}
          />
          <MetricCard
            label="Median first-response time"
            actual={performance.medianResponseHours}
            actualSuffix="h"
            target={targets.medianResponseHours}
            targetSuffix="h"
            direction="lower-is-better"
            onTargetChange={(v) => setTargets((t) => ({ ...t, medianResponseHours: v }))}
          />
          <MetricCard
            label="Stale-lead reduction"
            actual={performance.staleLeadReductionPct}
            actualSuffix="%"
            target={targets.staleLeadReductionPct}
            targetSuffix="%"
            direction="higher-is-better"
            onTargetChange={(v) => setTargets((t) => ({ ...t, staleLeadReductionPct: v }))}
            note={`${performance.currentStaleLeadCount} stale lead${performance.currentStaleLeadCount === 1 ? '' : 's'} right now`}
          />
          <MetricCard
            label="Plan-edit rate"
            actual={performance.planEditRatePct}
            actualSuffix="%"
            target={targets.planEditRateCeilingPct}
            targetSuffix="%"
            targetLabel="Ceiling"
            direction="lower-is-better"
            onTargetChange={(v) => setTargets((t) => ({ ...t, planEditRateCeilingPct: v }))}
            note={`${performance.sampleSizes.morningRunsConsidered} morning plan${performance.sampleSizes.morningRunsConsidered === 1 ? '' : 's'} considered`}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            onClick={saveTargets}
            disabled={saving}
            style={{
              padding: '8px 20px', background: saving ? '#94a3b8' : '#1A56DB', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save targets'}
          </button>
        </div>
      </Section>

      {eligibility && (
        <Section title="Auto mode">
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: eligibility.eligible ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${eligibility.eligible ? '#bbf7d0' : '#e2e8f0'}`,
              fontSize: 13,
              color: eligibility.eligible ? '#15803d' : '#475569',
            }}
          >
            {eligibility.eligible ? '✓ Eligible for auto mode. ' : 'Not yet eligible for auto mode. '}
            {eligibility.reason}
          </div>
        </Section>
      )}
    </div>
  );
}

function MetricCard({
  label,
  actual,
  actualSuffix,
  target,
  targetSuffix,
  targetLabel = 'Target',
  direction,
  onTargetChange,
  note,
}: {
  label: string;
  actual: number | null;
  actualSuffix: string;
  target: number | undefined;
  targetSuffix: string;
  targetLabel?: string;
  direction: Direction;
  onTargetChange: (v: number | undefined) => void;
  note?: string;
}) {
  const status = metricStatus(actual, target, direction);
  const style = STATUS_STYLE[status];
  return (
    <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 22, fontWeight: 700, color: style.fg, background: style.bg, padding: '2px 8px', borderRadius: 6,
          }}
        >
          {actual === null ? '—' : `${actual}${actualSuffix}`}
        </span>
        {note && <span style={{ fontSize: 11, color: '#94a3b8' }}>{note}</span>}
      </div>
      <label style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
        {targetLabel}
        <input
          type="number"
          min={0}
          value={target ?? ''}
          placeholder="not set"
          onChange={(e) => onTargetChange(e.target.value === '' ? undefined : Number(e.target.value))}
          style={{ width: 70, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12 }}
        />
        {targetSuffix}
      </label>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      {children}
    </div>
  );
}
