import { lossReasonLabel } from '@wizcrm/shared';

type StageChange = {
  id: string;
  fromStage: string;
  toStage: string;
  note: string | null;
  createdAt: string;
  user: { name: string };
};

type Activity = {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  createdAt: string;
  user: { name: string };
};

type Props = {
  stageChanges: StageChange[];
  activities: Activity[];
};

type TimelineItem =
  | { kind: 'stage'; at: string; data: StageChange }
  | { kind: 'activity'; at: string; data: Activity };

export function LeadAuditTrail({ stageChanges, activities }: Props) {
  const items: TimelineItem[] = [
    ...stageChanges.map((s) => ({ kind: 'stage' as const, at: s.createdAt, data: s })),
    ...activities.map((a) => ({ kind: 'activity' as const, at: a.createdAt, data: a })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (items.length === 0) {
    return <p className="muted">No history yet.</p>;
  }

  return (
    <ul className="audit-trail">
      {items.map((item) => {
        if (item.kind === 'stage') {
          const s = item.data;
          return (
            <li key={`stage-${s.id}`} className="audit-item audit-item-stage">
              <span className="audit-badge">Stage</span>
              <div>
                <strong>
                  {s.fromStage} → {s.toStage}
                </strong>
                {s.note ? <p className="audit-body">{s.note}</p> : null}
                <span className="audit-meta">
                  {s.user.name} · {formatWhen(s.createdAt)}
                </span>
              </div>
            </li>
          );
        }
        const a = item.data;
        return (
          <li key={`act-${a.id}`} className="audit-item">
            <span className="audit-badge">{a.type}</span>
            <div>
              {a.subject ? <strong>{a.subject}</strong> : null}
              <p className="audit-body">{a.body}</p>
              <span className="audit-meta">
                {a.user.name} · {formatWhen(a.createdAt)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CloseOutcomeBanner({
  stage,
  wonValue,
  wonStartAt,
  wonProducts,
  lossReason,
}: {
  stage: string;
  wonValue?: number | string | null;
  wonStartAt?: string | null;
  wonProducts?: string | null;
  lossReason?: string | null;
}) {
  if (stage === 'WON') {
    return (
      <div className="close-outcome close-outcome-won">
        <strong>Won</strong>
        <span>
          {wonValue != null ? formatMoney(wonValue) : '—'}
          {wonStartAt ? ` · from ${formatDate(wonStartAt)}` : ''}
        </span>
        {wonProducts ? <p className="muted">{wonProducts}</p> : null}
      </div>
    );
  }
  if (stage === 'LOST') {
    return (
      <div className="close-outcome close-outcome-lost">
        <strong>Lost</strong>
        <span>{lossReasonLabel(lossReason)}</span>
      </div>
    );
  }
  return null;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

function formatMoney(v: number | string) {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
