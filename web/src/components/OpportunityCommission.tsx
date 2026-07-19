import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

type CommissionView = {
  hidden: boolean;
  hiddenReason: 'org' | 'person' | null;
  basisType: string | null;
  basisAmount: number | null;
  ratePctLocked: number | null;
  forecastedAmount: number | null;
  dueAmount: number | null;
  collectibleFromDate: string | null;
  totalPaidByCustomer: number;
  collectibleAmount: number;
  paidOut: number;
  pendingPayout: number;
};

const BASIS_LABELS: Record<string, string> = {
  QUOTATION: 'Quotation',
  PROFORMA_INVOICE: 'Proforma invoice',
  INVOICE: 'Invoice',
};

type Props = {
  opportunityId: string;
  /** Customer-payment and payout logging is Manager+/Admin only. */
  canManage: boolean;
  refreshKey?: number;
};

function money(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export function OpportunityCommission({ opportunityId, canManage, refreshKey }: Props) {
  const [commission, setCommission] = useState<CommissionView | null>(null);
  const [error, setError] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api<{ commission: CommissionView }>(`/opportunities/${opportunityId}/commission`);
      setCommission(res.commission);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load commission');
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function logPayment(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(paymentAmount);
    if (!value || value <= 0) return;
    setSaving(true);
    setError('');
    try {
      await api(`/opportunities/${opportunityId}/customer-payments`, {
        method: 'POST',
        body: { amount: value },
      });
      setPaymentAmount('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log payment');
    } finally {
      setSaving(false);
    }
  }

  async function logPayout(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(payoutAmount);
    if (!value || value <= 0) return;
    setSaving(true);
    setError('');
    try {
      await api(`/opportunities/${opportunityId}/payouts`, {
        method: 'POST',
        body: { amount: value },
      });
      setPayoutAmount('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log payout');
    } finally {
      setSaving(false);
    }
  }

  if (!commission) return null;

  if (commission.hidden) {
    return (
      <section className="opportunity-commission">
        <h4>Commission</h4>
        <p className="muted">
          Commission is currently turned off{' '}
          {commission.hiddenReason === 'org' ? 'for the organization' : 'for this salesperson'}.
        </p>
      </section>
    );
  }

  let statusLine: string;
  if (commission.basisType == null) {
    statusLine = 'No commission yet — no quotation, proforma invoice, or invoice logged.';
  } else if (commission.dueAmount != null) {
    if (!commission.collectibleFromDate) {
      statusLine = `Due: ${money(commission.dueAmount)} — collectible once an LPO is uploaded.`;
    } else if (commission.pendingPayout > 0) {
      statusLine = `Collectible now: ${money(commission.collectibleAmount)} of ${money(commission.dueAmount)}.`;
    } else if (commission.collectibleAmount > 0) {
      statusLine = `Paid: ${money(commission.paidOut)} · Pending: ${money(commission.pendingPayout)}.`;
    } else {
      statusLine = `Due: ${money(commission.dueAmount)} — collectible from ${new Date(commission.collectibleFromDate).toLocaleDateString()}, pending customer payment.`;
    }
  } else {
    statusLine = `Forecast: ${money(commission.forecastedAmount)} — not owed yet.`;
  }

  return (
    <section className="opportunity-commission">
      <h4>Commission</h4>
      {error ? <p className="error">{error}</p> : null}
      <p>{statusLine}</p>
      <p className="muted">
        Basis: {commission.basisType ? BASIS_LABELS[commission.basisType] : '—'} ·{' '}
        {money(commission.basisAmount)} · rate {commission.ratePctLocked ?? '—'}%
      </p>
      {commission.dueAmount != null ? (
        <p className="muted">
          Paid by customer: {money(commission.totalPaidByCustomer)} · Paid out:{' '}
          {money(commission.paidOut)} · Pending: {money(commission.pendingPayout)}
        </p>
      ) : null}

      {canManage && commission.dueAmount != null ? (
        <div className="commission-manage-row">
          <form onSubmit={(e) => void logPayment(e)} className="expense-form-row">
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Customer payment"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              style={{ width: 140 }}
            />
            <button type="submit" className="btn-secondary btn-sm" disabled={saving || !paymentAmount}>
              Log payment
            </button>
          </form>
          <form onSubmit={(e) => void logPayout(e)} className="expense-form-row">
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="Payout amount"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              style={{ width: 140 }}
            />
            <button
              type="submit"
              className="btn-secondary btn-sm"
              disabled={saving || !payoutAmount || commission.pendingPayout <= 0}
            >
              Log payout
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
