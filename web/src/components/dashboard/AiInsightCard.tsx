import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { LiveIndicator } from './LiveIndicator';

type InsightType = 'positive' | 'warning' | 'info' | 'achievement';
type Priority = 'high' | 'medium' | 'low';

type Insight = {
  type: InsightType;
  title: string;
  body: string;
  priority?: Priority;
  confidence?: number;
  actions?: string[];
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string }> = {
  high:   { label: 'High',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  low:    { label: 'Low',    color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
};

const INSIGHT_CONFIG: Record<InsightType, {
  icon: typeof Sparkles;
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
}> = {
  positive: {
    icon: TrendingUp,
    bg: 'linear-gradient(135deg, rgba(240,253,244,0.8) 0%, rgba(255,255,255,0.6) 100%)',
    border: 'rgba(16, 185, 129, 0.3)',
    iconColor: '#059669',
    titleColor: '#065f46',
  },
  warning: {
    icon: AlertCircle,
    bg: 'linear-gradient(135deg, rgba(255,251,235,0.8) 0%, rgba(255,255,255,0.6) 100%)',
    border: 'rgba(245, 158, 11, 0.3)',
    iconColor: '#d97706',
    titleColor: '#92400e',
  },
  info: {
    icon: Sparkles,
    bg: 'linear-gradient(135deg, rgba(245,243,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
    border: 'rgba(139, 92, 246, 0.28)',
    iconColor: '#7c3aed',
    titleColor: '#4c1d95',
  },
  achievement: {
    icon: CheckCircle2,
    bg: 'linear-gradient(135deg, rgba(239,246,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
    border: 'rgba(59, 130, 246, 0.28)',
    iconColor: '#2563eb',
    titleColor: '#1e3a8a',
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="text-[10px] text-slate-400 font-500 w-16 flex-shrink-0">Confidence</span>
      <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-700 w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

function InsightItem({ insight }: { insight: Insight }) {
  const cfg = INSIGHT_CONFIG[insight.type];
  const Icon = cfg.icon;
  const priority = insight.priority ?? 'medium';
  const pc = PRIORITY_CONFIG[priority];

  return (
    <div
      className="rounded-xl border p-3 transition-all duration-150 hover:shadow-sm"
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <div className="flex gap-2.5">
        <div
          className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: 'white', color: cfg.iconColor, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <Icon size={13} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className="text-xs font-700 leading-tight" style={{ color: cfg.titleColor }}>
              {insight.title}
            </span>
            <span
              className="text-[9px] font-800 uppercase tracking-wider rounded-full px-1.5 py-0.5"
              style={{ color: pc.color, background: pc.bg }}
            >
              {pc.label}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed m-0">{insight.body}</p>
          {insight.confidence !== undefined && <ConfidenceBar value={insight.confidence} />}
        </div>
      </div>

      {/* action chips */}
      {insight.actions && insight.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 ml-9">
          {insight.actions.map((action) => (
            <button
              key={action}
              type="button"
              className="flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-700 transition-all hover:bg-white/80 cursor-pointer"
              style={{
                borderColor: cfg.border,
                color: cfg.iconColor,
                background: 'rgba(255,255,255,0.5)',
              }}
            >
              <ArrowRight size={9} strokeWidth={2.5} />
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Props = {
  insights: Insight[];
  loading?: boolean;
  aiEnabled?: boolean;
};

export function AiInsightCard({ insights, loading, aiEnabled }: Props) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'linear-gradient(145deg, #1a1640 0%, #1e1b4b 40%, #1e2d6b 100%)',
        borderColor: 'rgba(99, 102, 241, 0.28)',
        boxShadow: '0 4px 20px rgba(79, 70, 229, 0.18)',
      }}
    >
      {/* header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: 'rgba(99, 102, 241, 0.28)', color: '#a5b4fc' }}
          >
            <Sparkles size={15} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-700 text-white leading-tight">AI Intelligence</div>
            <div className="text-[11px]" style={{ color: 'rgba(165, 180, 252, 0.65)' }}>
              {aiEnabled ? 'Powered by WizAI · GPT-4' : 'Pipeline analysis engine'}
            </div>
          </div>
        </div>
        <LiveIndicator color="#10b981" size={7} label="Live" />
      </div>

      {/* AI summary conversational line */}
      {insights.length > 0 && !loading && (
        <div
          className="rounded-xl px-3 py-2 mb-3 text-xs leading-relaxed"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(165,180,252,0.15)',
            color: 'rgba(224,231,255,0.85)',
          }}
        >
          <Zap size={11} className="inline mr-1.5 opacity-70" strokeWidth={2} />
          <span>
            {insights.length === 1
              ? 'I found 1 key insight that needs your attention.'
              : `I found ${insights.length} insights — ${insights.filter((i) => i.type === 'warning').length} require action.`}
          </span>
        </div>
      )}

      {/* insights list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{ height: 72, background: 'rgba(255, 255, 255, 0.07)' }}
            />
          ))}
          <div className="flex items-center gap-1.5 text-[11px] mt-1" style={{ color: 'rgba(165,180,252,0.5)' }}>
            <RefreshCw size={10} className="animate-spin" />
            Analyzing pipeline data…
          </div>
        </div>
      ) : insights.length === 0 ? (
        <div
          className="rounded-xl p-4 text-center text-xs"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(165,180,252,0.55)' }}
        >
          {aiEnabled
            ? 'AI is analyzing your pipeline…'
            : 'Enable AI in Platform settings for intelligent insights.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {insights.map((ins, i) => (
            <InsightItem key={i} insight={ins} />
          ))}
        </div>
      )}

      {/* footer */}
      <div
        className="mt-3 pt-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <span className="text-[10px]" style={{ color: 'rgba(165,180,252,0.4)' }}>
          Updated just now
        </span>
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] font-600 transition-opacity hover:opacity-80"
          style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0 }}
        >
          View all insights <ArrowRight size={10} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
