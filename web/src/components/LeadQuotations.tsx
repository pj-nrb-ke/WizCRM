import { useCallback, useEffect, useState } from 'react';
import { erpSyncStatusLabel, type ErpSyncStatus } from '@wizcrm/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isManager } from '../lib/roles';

type QuotationLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
};

type Quotation = {
  id: string;
  referenceNumber: string;
  status: string;
  taxRatePct: number;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  lines: QuotationLine[];
  notes: string | null;
  validUntil: string | null;
  erpSyncStatus: ErpSyncStatus;
  erpReference: string | null;
  owner: { name: string };
};

const EMPTY_LINE: QuotationLine = { description: '', quantity: 1, unitPrice: 0, discountPct: 0 };

type Props = {
  leadId: string;
};

export function LeadQuotations({ leadId }: Props) {
  const { user, entitlements } = useAuth();
  const manager = isManager(user?.role);
  const proQuotes = entitlements?.features.quotations ?? false;
  const [rows, setRows] = useState<Quotation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<QuotationLine[]>([{ ...EMPTY_LINE }]);
  const [taxRatePct, setTaxRatePct] = useState(15);
  const [notes, setNotes] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api<{ quotations: Quotation[] }>(`/quotations/lead/${leadId}`)
      .then((d) => setRows(d.quotations ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load quotations'))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  function updateLine(idx: number, patch: Partial<QuotationLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function createQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!manager) return;
    setSaving(true);
    setError('');
    try {
      await api('/quotations', {
        method: 'POST',
        body: {
          leadId,
          taxRatePct,
          notes: notes.trim() || undefined,
          lines: lines.filter((l) => l.description.trim()),
        },
      });
      setShowForm(false);
      setLines([{ ...EMPTY_LINE }]);
      setNotes('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function syncToErp(id: string) {
    setSaving(true);
    setError('');
    try {
      await api(`/quotations/${id}/erp-sync`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ERP sync failed');
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(id: string, status: string) {
    setSaving(true);
    setError('');
    try {
      await api(`/quotations/${id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (!proQuotes) {
    return (
      <p className="muted">
        Quotations are available on <strong>Pro</strong>. Upgrade plan in Platform settings.
      </p>
    );
  }

  return (
    <>
      <h3>Quotations</h3>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <p className="muted">Loading quotations…</p>
      ) : rows.length === 0 ? (
        <p className="muted">No quotations yet.</p>
      ) : (
        <ul className="mini-list">
          {rows.map((q) => (
            <li key={q.id}>
              <strong>{q.referenceNumber}</strong> — {q.status} ·{' '}
              {Number(q.total).toLocaleString(undefined, { style: 'currency', currency: 'ZAR' })}
              <span className="muted"> · {q.owner.name}</span>
              <span
                className={`erp-sync-badge erp-sync-badge--${q.erpSyncStatus.toLowerCase()}`}
              >
                {erpSyncStatusLabel(q.erpSyncStatus)}
                {q.erpReference ? ` (${q.erpReference})` : ''}
              </span>
              {manager && q.status !== 'DRAFT' && q.erpSyncStatus !== 'SYNCED' ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ marginLeft: 8 }}
                  disabled={saving}
                  onClick={() => void syncToErp(q.id)}
                >
                  Sync to ERP
                </button>
              ) : null}
              {manager && q.status === 'DRAFT' ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ marginLeft: 8 }}
                  disabled={saving}
                  onClick={() => void patchStatus(q.id, 'SENT')}
                >
                  Mark sent
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {manager && !showForm ? (
        <button type="button" className="btn-secondary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
          New quotation
        </button>
      ) : null}
      {manager && showForm ? (
        <form className="quotation-form" onSubmit={(e) => void createQuotation(e)} style={{ marginTop: 12 }}>
          <p className="muted">Line items, tax, and totals are computed server-side.</p>
          {lines.map((line, idx) => (
            <div key={idx} className="quotation-line-row">
              <input
                placeholder="Description"
                value={line.description}
                onChange={(e) => updateLine(idx, { description: e.target.value })}
                required={idx === 0}
              />
              <input
                type="number"
                min={0.01}
                step="any"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                step="any"
                placeholder="Unit price"
                value={line.unitPrice}
                onChange={(e) => updateLine(idx, { unitPrice: Number(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Disc %"
                value={line.discountPct ?? 0}
                onChange={(e) => updateLine(idx, { discountPct: Number(e.target.value) })}
              />
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
          >
            Add line
          </button>
          <label>
            Tax rate %
            <input
              type="number"
              min={0}
              max={100}
              value={taxRatePct}
              onChange={(e) => setTaxRatePct(Number(e.target.value))}
            />
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create quotation'}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
