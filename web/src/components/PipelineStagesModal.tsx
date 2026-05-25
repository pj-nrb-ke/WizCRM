import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export type PipelineStageConfig = {
  stage: string;
  label: string;
  order: number;
  inPipeline: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: (stages: PipelineStageConfig[]) => void;
};

export function PipelineStagesModal({ open, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<PipelineStageConfig[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    api<{ stages: PipelineStageConfig[] }>('/leads/pipeline/config')
      .then((d) => setRows(d.stages))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [open]);

  if (!open) return null;

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    const copy = [...rows];
    const [a] = copy.splice(index, 1);
    copy.splice(next, 0, a);
    setRows(copy.map((r, i) => ({ ...r, order: i })));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await api<{ stages: PipelineStageConfig[] }>('/leads/pipeline/config', {
        method: 'PATCH',
        body: { stages: rows },
      });
      onSaved(res.stages);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setRows([
      { stage: 'NEW', label: 'New', order: 0, inPipeline: true },
      { stage: 'CONTACTED', label: 'Contacted', order: 1, inPipeline: true },
      { stage: 'QUALIFIED', label: 'Qualified', order: 2, inPipeline: true },
      { stage: 'PROPOSAL', label: 'Proposal', order: 3, inPipeline: true },
      { stage: 'NEGOTIATION', label: 'Negotiation', order: 4, inPipeline: true },
    ]);
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pipeline-stages-title">
      <div className="modal-panel">
        <h2 id="pipeline-stages-title">Customize pipeline stages</h2>
        <p className="muted">
          Rename columns and change their order. Drag-and-drop on the board uses these stages.
        </p>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <ul className="stage-editor-list">
          {rows.map((row, index) => (
            <li key={row.stage} className="stage-editor-row">
              <span className="stage-editor-key">{row.stage}</span>
              <input
                type="text"
                value={row.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setRows((prev) =>
                    prev.map((r, i) => (i === index ? { ...r, label } : r)),
                  );
                }}
                aria-label={`Label for ${row.stage}`}
              />
              <div className="stage-editor-actions">
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => move(index, 1)}
                  disabled={index === rows.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={resetDefaults}>
            Reset labels
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save stages'}
          </button>
        </div>
      </div>
    </div>
  );
}
