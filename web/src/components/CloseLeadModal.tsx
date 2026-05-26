import { useEffect, useState } from 'react';
import { lossReasonLabel } from '@wizcrm/shared';

export type CrmConfig = {
  leadSources: string[];
  leadTags?: string[];
  lossReasons: { code: string; label: string }[];
  staleLeadDays?: number;
};

type WonForm = {
  wonValue: string;
  wonStartAt: string;
  wonProducts: string;
  note: string;
};

type LostForm = {
  lossReason: string;
  note: string;
};

type Props = {
  mode: 'WON' | 'LOST';
  leadName: string;
  config: CrmConfig | null;
  initialWon?: { wonValue?: number | null; wonStartAt?: string | null; wonProducts?: string | null };
  initialLost?: { lossReason?: string | null };
  saving: boolean;
  onClose: () => void;
  onSubmitWon: (data: {
    wonValue: number;
    wonStartAt: string;
    wonProducts?: string;
    stageNote?: string;
  }) => void;
  onSubmitLost: (data: { lossReason: string; stageNote?: string }) => void;
};

function toLocalDateTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CloseLeadModal({
  mode,
  leadName,
  config,
  initialWon,
  initialLost,
  saving,
  onClose,
  onSubmitWon,
  onSubmitLost,
}: Props) {
  const [won, setWon] = useState<WonForm>(() => ({
    wonValue: initialWon?.wonValue != null ? String(initialWon.wonValue) : '',
    wonStartAt: initialWon?.wonStartAt
      ? toLocalDateTime(new Date(initialWon.wonStartAt))
      : toLocalDateTime(new Date()),
    wonProducts: initialWon?.wonProducts ?? '',
    note: '',
  }));
  const [lost, setLost] = useState<LostForm>(() => ({
    lossReason: initialLost?.lossReason ?? config?.lossReasons[0]?.code ?? 'PRICE',
    note: '',
  }));

  useEffect(() => {
    if (mode === 'LOST' && config?.lossReasons.length && !lost.lossReason) {
      setLost((l) => ({ ...l, lossReason: config.lossReasons[0]!.code }));
    }
  }, [config, mode, lost.lossReason]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'WON') {
      const value = Number(won.wonValue);
      if (!Number.isFinite(value) || value < 0) return;
      onSubmitWon({
        wonValue: value,
        wonStartAt: new Date(won.wonStartAt).toISOString(),
        wonProducts: won.wonProducts.trim() || undefined,
        stageNote: won.note.trim() || undefined,
      });
      return;
    }
    onSubmitLost({
      lossReason: lost.lossReason,
      stageNote: lost.note.trim() || undefined,
    });
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel close-lead-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'WON' ? 'Close as Won' : 'Close as Lost'}</h2>
        <p className="muted">
          {leadName} — {mode === 'WON' ? 'Record deal value and what was sold.' : 'Capture why this opportunity was lost.'}
        </p>
        <form onSubmit={handleSubmit}>
          {mode === 'WON' ? (
            <>
              <label>
                Deal value *
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={won.wonValue}
                  onChange={(e) => setWon({ ...won, wonValue: e.target.value })}
                  placeholder="0.00"
                />
              </label>
              <label>
                Start date
                <input
                  type="datetime-local"
                  value={won.wonStartAt}
                  onChange={(e) => setWon({ ...won, wonStartAt: e.target.value })}
                />
              </label>
              <label>
                Products / services
                <textarea
                  rows={3}
                  value={won.wonProducts}
                  onChange={(e) => setWon({ ...won, wonProducts: e.target.value })}
                  placeholder="What was sold?"
                />
              </label>
              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  value={won.note}
                  onChange={(e) => setWon({ ...won, note: e.target.value })}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Loss reason *
                <select
                  value={lost.lossReason}
                  onChange={(e) => setLost({ ...lost, lossReason: e.target.value })}
                  required
                >
                  {(config?.lossReasons ?? []).map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted close-lead-preview">
                Reporting as: <strong>{lossReasonLabel(lost.lossReason)}</strong>
              </p>
              <label>
                Additional notes (optional)
                <textarea
                  rows={3}
                  value={lost.note}
                  onChange={(e) => setLost({ ...lost, note: e.target.value })}
                  placeholder="Competitor name, timing details…"
                />
              </label>
            </>
          )}
          <div className="form-actions calendar-form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={mode === 'WON' ? 'btn-primary' : 'btn-danger'}
              disabled={saving}
            >
              {saving ? 'Saving…' : mode === 'WON' ? 'Mark as Won' : 'Mark as Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
