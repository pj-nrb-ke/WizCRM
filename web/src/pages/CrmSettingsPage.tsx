import { FormEvent, useEffect, useState } from 'react';
import { DEFAULT_LEAD_SOURCES, DEFAULT_LOSS_REASONS } from '@wizcrm/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isAdmin } from '../lib/roles';
import { PageHeader } from '../components/PageHeader';

type LossReason = { code: string; label: string };

type SettingsPayload = {
  leadSources?: string[];
  leadTags?: string[];
  lossReasons?: LossReason[];
  staleLeadDays?: number;
};

export function CrmSettingsPage() {
  const { user } = useAuth();
  const canEdit = isAdmin(user?.role);
  const [leadSources, setLeadSources] = useState('');
  const [leadTags, setLeadTags] = useState('');
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [staleLeadDays, setStaleLeadDays] = useState(7);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{
      settings: SettingsPayload;
    }>('/admin/settings')
      .then((d) => {
        const sources =
          d.settings.leadSources && d.settings.leadSources.length > 0
            ? d.settings.leadSources
            : [...DEFAULT_LEAD_SOURCES];
        setLeadSources(sources.join('\n'));
        setLeadTags((d.settings.leadTags ?? []).join('\n'));
        setLossReasons(
          d.settings.lossReasons && d.settings.lossReasons.length > 0
            ? d.settings.lossReasons
            : DEFAULT_LOSS_REASONS.map((r) => ({ code: r.code, label: r.label })),
        );
        setStaleLeadDays(
          typeof d.settings.staleLeadDays === 'number' ? d.settings.staleLeadDays : 7,
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  function addLossReason() {
    setLossReasons((rows) => [...rows, { code: `CUSTOM_${rows.length + 1}`, label: 'New reason' }]);
  }

  function updateLossReason(index: number, field: 'code' | 'label', value: string) {
    setLossReasons((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  function removeLossReason(index: number) {
    setLossReasons((rows) => rows.filter((_, i) => i !== index));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setMessage('');
    setError('');
    const sources = leadSources
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (sources.length === 0) {
      setError('At least one lead source is required.');
      return;
    }
    if (lossReasons.length === 0) {
      setError('At least one loss reason is required.');
      return;
    }
    const tags = leadTags
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const days = Number(staleLeadDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      setError('Stale lead days must be between 1 and 90.');
      return;
    }
    try {
      await api('/admin/settings', {
        method: 'PATCH',
        body: { leadSources: sources, leadTags: tags, lossReasons, staleLeadDays: days },
      });
      setMessage('CRM settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="page-wide">
      <PageHeader
        title="CRM lists"
        subtitle="Lead sources, stale lead threshold, and structured loss reasons used when closing deals and in reports."
      />
      {!canEdit ? (
        <p className="muted">Managers can view lists in the lead drawer; admins can edit here.</p>
      ) : null}

      <form className="card crm-settings-form" onSubmit={onSave}>
        <label>
          Lead sources (one per line)
          <textarea
            rows={8}
            value={leadSources}
            onChange={(e) => setLeadSources(e.target.value)}
            disabled={!canEdit}
          />
        </label>

        <label>
          Suggested lead tags (one per line, optional)
          <textarea
            rows={5}
            value={leadTags}
            onChange={(e) => setLeadTags(e.target.value)}
            disabled={!canEdit}
            placeholder="VIP&#10;Enterprise&#10;Partner referral"
          />
        </label>

        <label>
          Stale lead threshold (days)
          <input
            type="number"
            min={1}
            max={90}
            value={staleLeadDays}
            onChange={(e) => setStaleLeadDays(Number(e.target.value))}
            disabled={!canEdit}
          />
          <span className="muted">
            Open leads with no activity for this many days appear as stale on dashboards and
            reports.
          </span>
        </label>

        <h3>Loss reasons</h3>
        <p className="muted">Code is stored on the lead; label appears in UI and reports.</p>
        <ul className="loss-reason-editor">
          {lossReasons.map((r, i) => (
            <li key={i}>
              <input
                value={r.code}
                onChange={(e) => updateLossReason(i, 'code', e.target.value)}
                disabled={!canEdit}
                aria-label="Reason code"
              />
              <input
                value={r.label}
                onChange={(e) => updateLossReason(i, 'label', e.target.value)}
                disabled={!canEdit}
                aria-label="Reason label"
              />
              {canEdit ? (
                <button type="button" className="btn-icon" onClick={() => removeLossReason(i)}>
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <button type="button" className="btn-secondary btn-sm" onClick={addLossReason}>
            Add reason
          </button>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {canEdit ? (
          <button type="submit" className="btn-primary">
            Save CRM settings
          </button>
        ) : null}
      </form>
    </div>
  );
}
