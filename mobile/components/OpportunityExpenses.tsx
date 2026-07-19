import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';

type ExpenseRow = {
  id: string;
  description: string;
  category: string;
  amount: number | string;
  date: string;
  loggedBy: { id: string; name: string };
};

const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: 'Travel',
  SAMPLES: 'Samples',
  LABOR: 'Labor',
  OTHER: 'Other',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS);

type Props = {
  opportunityId: string;
  /** Only the opportunity owner can log expenses. */
  canLog: boolean;
  onChanged?: () => void;
};

export function OpportunityExpenses({ opportunityId, canLog, onChanged }: Props) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ expenses: ExpenseRow[] }>(`/opportunities/${opportunityId}/expenses`);
      setExpenses(res.expenses ?? []);
    } catch {
      /* silent when offline */
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addExpense() {
    const trimmed = description.trim();
    const value = Number(amount);
    if (!trimmed || !value || value <= 0) return;
    setSaving(true);
    try {
      await api(`/opportunities/${opportunityId}/expenses`, {
        method: 'POST',
        body: { description: trimmed, category, amount: value },
      });
      setDescription('');
      setAmount('');
      await load();
      onChanged?.();
    } catch (e) {
      Alert.alert('Expense', e instanceof Error ? e.message : 'Could not add expense');
    } finally {
      setSaving(false);
    }
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Expenses</Text>
      {expenses.length === 0 ? (
        <Text style={styles.muted}>No expenses logged on this opportunity yet.</Text>
      ) : (
        <>
          {expenses.map((ex) => (
            <View key={ex.id} style={styles.row}>
              <Text style={styles.rowText}>{ex.description}</Text>
              <Text style={styles.meta}>
                {CATEGORY_LABELS[ex.category] ?? ex.category} · {Number(ex.amount).toLocaleString()} ·{' '}
                {new Date(ex.date).toLocaleDateString()} · {ex.loggedBy.name}
              </Text>
            </View>
          ))}
          <Text style={styles.meta}>Total spent: {total.toLocaleString()}</Text>
        </>
      )}
      {canLog ? (
        <View style={styles.addBox}>
          <TextInput
            style={styles.input}
            placeholder="e.g. Fuel to site visit"
            placeholderTextColor="#64748b"
            value={description}
            onChangeText={setDescription}
          />
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => setCategory(c)}
              >
                <Text style={styles.chipText}>{CATEGORY_LABELS[c]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Amount"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <Pressable
              style={[styles.btn, saving && styles.btnDisabled]}
              onPress={() => void addExpense()}
              disabled={saving}
            >
              <Text style={styles.btnText}>{saving ? '…' : 'Log'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.muted}>Only the opportunity owner can log expenses.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 12, backgroundColor: '#1e293b', borderRadius: 10 },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  muted: { color: '#64748b', fontSize: 13 },
  row: { marginBottom: 8 },
  rowText: { color: '#e2e8f0', fontSize: 14 },
  meta: { color: '#94a3b8', fontSize: 11 },
  addBox: { marginTop: 8 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { color: '#e2e8f0', fontSize: 12 },
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
