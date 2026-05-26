import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { isManagerRole } from '../lib/roles';

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
  total: string | number;
  owner: { name: string };
};

const EMPTY_LINE: QuotationLine = { description: '', quantity: 1, unitPrice: 0, discountPct: 0 };

type Props = { leadId: string };

export function LeadQuotations({ leadId }: Props) {
  const { user } = useAuth();
  const manager = isManagerRole(user?.role);
  const [rows, setRows] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<QuotationLine[]>([{ ...EMPTY_LINE }]);
  const [taxRatePct, setTaxRatePct] = useState('15');

  const load = useCallback(() => {
    setLoading(true);
    api<{ quotations: Quotation[] }>(`/quotations/lead/${leadId}`)
      .then((d) => setRows(d.quotations ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setSaving(true);
    try {
      await api('/quotations', {
        method: 'POST',
        body: {
          leadId,
          taxRatePct: Number(taxRatePct) || 0,
          lines: lines.filter((l) => l.description.trim()),
        },
      });
      setShowForm(false);
      setLines([{ ...EMPTY_LINE }]);
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Quotations</Text>
      {loading ? (
        <ActivityIndicator color="#38bdf8" />
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>No quotations yet.</Text>
      ) : (
        rows.map((q) => (
          <View key={q.id} style={styles.row}>
            <Text style={styles.ref}>{q.referenceNumber}</Text>
            <Text style={styles.meta}>
              {q.status} · {Number(q.total).toLocaleString()} · {q.owner.name}
            </Text>
            {manager && q.status === 'DRAFT' ? (
              <Pressable
                onPress={() =>
                  void api(`/quotations/${q.id}`, { method: 'PATCH', body: { status: 'SENT' } }).then(load)
                }
              >
                <Text style={styles.action}>Mark sent</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      {manager && !showForm ? (
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>New quotation</Text>
        </Pressable>
      ) : null}
      {manager && showForm ? (
        <View style={styles.form}>
          {lines.map((line, idx) => (
            <View key={idx} style={styles.lineRow}>
              <TextInput
                style={styles.input}
                placeholder="Description"
                placeholderTextColor="#64748b"
                value={line.description}
                onChangeText={(v) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: v } : l)))
                }
              />
              <View style={styles.lineNums}>
                <TextInput
                  style={styles.numInput}
                  keyboardType="decimal-pad"
                  value={String(line.quantity)}
                  onChangeText={(v) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, quantity: Number(v) || 0 } : l)),
                    )
                  }
                />
                <TextInput
                  style={styles.numInput}
                  keyboardType="decimal-pad"
                  placeholder="Price"
                  placeholderTextColor="#64748b"
                  value={String(line.unitPrice)}
                  onChangeText={(v) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, unitPrice: Number(v) || 0 } : l)),
                    )
                  }
                />
              </View>
            </View>
          ))}
          <Pressable onPress={() => setLines((p) => [...p, { ...EMPTY_LINE }])}>
            <Text style={styles.action}>+ Add line</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Tax %"
            placeholderTextColor="#64748b"
            keyboardType="decimal-pad"
            value={taxRatePct}
            onChangeText={setTaxRatePct}
          />
          <View style={styles.formActions}>
            <Pressable style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void create()}>
              <Text style={styles.saveBtnText}>{saving ? '…' : 'Create'}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  section: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  muted: { color: '#64748b' },
  row: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ref: { color: '#f8fafc', fontWeight: '600' },
  meta: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
  action: { color: '#38bdf8', marginTop: 6, fontWeight: '600' },
  addBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  addBtnText: { color: '#e2e8f0', fontWeight: '600' },
  form: { marginTop: 12, gap: 8 },
  lineRow: { gap: 6 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
  },
  lineNums: { flexDirection: 'row', gap: 8 },
  numInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#94a3b8' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0f172a', fontWeight: '700' },
});
