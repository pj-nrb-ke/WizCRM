import { useState } from 'react';
import { api } from '../lib/api';
import {
  OPPORTUNITY_SOURCE_TYPES,
  SALES_OPP_STAGES,
  SALES_OPP_STATUSES,
  SALES_OPP_STAGE_LABELS,
  SALES_OPP_STATUS_LABELS,
} from '../lib/opportunity-labels';

type Props = {
  leadId: string;
  leadName: string;
  onCreated: () => void;
  onCancel: () => void;
};

export function SalesOpportunityForm({ leadId, leadName, onCreated, onCancel }: Props) {
  const [description, setDescription] = useState('');
  const [contactPerson, setContactPerson] = useState(leadName);
  const [isPublic, setIsPublic] = useState(true);
  const [oppStage, setOppStage] = useState('NEW_OPPORTUNITY');
  const [oppStatus, setOppStatus] = useState('NOT_STARTED');
  const [probabilityPct, setProbabilityPct] = useState(10);
  const [sourceType, setSourceType] = useState('OTHER');
  const [closeBy, setCloseBy] = useState(new Date().toISOString().slice(0, 10));
  const [budgeted, setBudgeted] = useState('');
  const [forecastedExcl, setForecastedExcl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const expected =
    forecastedExcl && !Number.isNaN(Number(forecastedExcl))
      ? Math.round(Number(forecastedExcl) * (probabilityPct / 100) * 100) / 100
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/opportunities', {
        method: 'POST',
        body: {
          leadId,
          description,
          contactPerson,
          isPublic,
          oppStage,
          oppStatus,
          probabilityPct,
          sourceType,
          closeBy: new Date(closeBy).toISOString(),
          budgeted: budgeted ? Number(budgeted) : undefined,
          forecastedExcl: forecastedExcl ? Number(forecastedExcl) : undefined,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="opp-form" onSubmit={(e) => void submit(e)}>
      <h3>New sales opportunity</h3>
      <p className="muted">Linked to lead: {leadName}</p>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <label>
        Description *
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <label>
        Contact person
        <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Public (visible to all managers)
      </label>

      <div className="form-row">
        <label>
          Stage
          <select value={oppStage} onChange={(e) => setOppStage(e.target.value)}>
            {SALES_OPP_STAGES.map((s) => (
              <option key={s} value={s}>
                {SALES_OPP_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={oppStatus} onChange={(e) => setOppStatus(e.target.value)}>
            {SALES_OPP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {SALES_OPP_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Probability %
          <input
            type="number"
            min={0}
            max={100}
            value={probabilityPct}
            onChange={(e) => setProbabilityPct(Number(e.target.value))}
          />
        </label>
        <label>
          Source
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
            {OPPORTUNITY_SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Close by
        <input type="date" value={closeBy} onChange={(e) => setCloseBy(e.target.value)} />
      </label>

      <div className="form-row">
        <label>
          Budgeted
          <input
            type="number"
            min={0}
            value={budgeted}
            onChange={(e) => setBudgeted(e.target.value)}
            placeholder="0"
          />
        </label>
        <label>
          Forecasted (excl.)
          <input
            type="number"
            min={0}
            value={forecastedExcl}
            onChange={(e) => setForecastedExcl(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      <p className="muted">
        Expected value: {expected != null ? expected.toLocaleString() : '—'} (forecast × probability)
      </p>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Create opportunity'}
        </button>
      </div>
    </form>
  );
}
