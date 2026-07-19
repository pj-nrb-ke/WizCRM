import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  canManage: boolean;
  refreshKey?: number;
};

function money(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export function OpportunityCommission({ opportunityId, canManage, refreshKey }: Props) {
  const [commission, setCommission] = useState<CommissionView | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ commission: CommissionView }>(`/opportunities/${opportunityId}/commission`);
      setCommission(res.commission);
    } catch {
      /* silent when offline */
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function logPayment() {
    const value = Number(paymentAmount);
    if (!value || value <= 0) return;
    setSaving(true);
    try {
      await api(`/opportunities/${opportunityId}/customer-payments`, { method: 'POST', body: { amount: value } });
      setPaymentAmount('');
      await load();
    } catch (e) {
      Alert.alert('Payment', e instanceof Error ? e.message : 'Could not log payment');
    } finally {
      setSaving(false);
    }
  }

  async function logPayout() {
    const value = Number(payoutAmount);
    if (!value || value <= 0) return;
    setSaving(true);
    try {
      await api(`/opportunities/${opportunityId}/payouts`, { method: 'POST', body: { amount: value } });
      setPayoutAmount('');
      await load();
    } catch (e) {
      Alert.alert('Payout', e instanceof Error ? e.message : 'Could not log payout');
    } finally {
      setSaving(false);
    }
  }

  if (!commission) return null;

  if (commission.hidden) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>Commission</Text>
        <Text style={styles.muted}>
          Commission is currently turned off {commission.hiddenReason === 'org' ? 'for the organization' : 'for this salesperson'}.
        </Text>
      </View>
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
    <View style={styles.box}>
      <Text style={styles.title}>Commission</Text>
      <Text style={styles.rowText}>{statusLine}</Text>
      <Text style={styles.meta}>
        Basis: {commission.basisType ? BASIS_LABELS[commission.basisType] : '—'} · {money(commission.basisAmount)} · rate{' '}
        {commission.ratePctLocked ?? '—'}%
      </Text>
      {commission.dueAmount != null ? (
        <Text style={styles.meta}>
          Paid by customer: {money(commission.totalPaidByCustomer)} · Paid out: {money(commission.paidOut)} · Pending:{' '}
          {money(commission.pendingPayout)}
        </Text>
      ) : null}

      {canManage && commission.dueAmount != null ? (
        <View style={{ marginTop: 8 }}>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Customer payment"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />
            <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={() => void logPayment()} disabled={saving}>
              <Text style={styles.btnText}>Log</Text>
            </Pressable>
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Payout amount"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={payoutAmount}
              onChangeText={setPayoutAmount}
            />
            <Pressable
              style={[styles.btn, (saving || commission.pendingPayout <= 0) && styles.btnDisabled]}
              onPress={() => void logPayout()}
              disabled={saving || commission.pendingPayout <= 0}
            >
              <Text style={styles.btnText}>Log</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 12, backgroundColor: '#1e293b', borderRadius: 10 },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  muted: { color: '#64748b', fontSize: 13 },
  rowText: { color: '#e2e8f0', fontSize: 14 },
  meta: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
  },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600' },
});
