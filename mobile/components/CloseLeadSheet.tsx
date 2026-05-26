import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DEFAULT_LOSS_REASONS } from '@wizcrm/shared';

type Props = {
  visible: boolean;
  mode: 'WON' | 'LOST';
  lossReasons?: { code: string; label: string }[];
  saving: boolean;
  onClose: () => void;
  onSubmitWon: (data: { wonValue: number; wonProducts?: string }) => void;
  onSubmitLost: (data: { lossReason: string }) => void;
};

export function CloseLeadSheet({
  visible,
  mode,
  lossReasons,
  saving,
  onClose,
  onSubmitWon,
  onSubmitLost,
}: Props) {
  const reasons =
    lossReasons && lossReasons.length > 0
      ? lossReasons
      : DEFAULT_LOSS_REASONS.map((r) => ({ code: r.code, label: r.label }));
  const [wonValue, setWonValue] = useState('');
  const [wonProducts, setWonProducts] = useState('');
  const [lossReason, setLossReason] = useState(reasons[0]?.code ?? 'PRICE');

  useEffect(() => {
    if (visible) {
      setWonValue('');
      setWonProducts('');
      setLossReason(reasons[0]?.code ?? 'PRICE');
    }
  }, [visible, mode]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{mode === 'WON' ? 'Close as Won' : 'Close as Lost'}</Text>
            {mode === 'WON' ? (
              <>
                <Text style={styles.label}>Deal value *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={wonValue}
                  onChangeText={setWonValue}
                  placeholder="0"
                  placeholderTextColor="#64748b"
                />
                <Text style={styles.label}>Products / services</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  multiline
                  value={wonProducts}
                  onChangeText={setWonProducts}
                  placeholderTextColor="#64748b"
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Loss reason *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {reasons.map((r) => (
                    <Pressable
                      key={r.code}
                      style={[styles.chip, lossReason === r.code && styles.chipActive]}
                      onPress={() => setLossReason(r.code)}
                    >
                      <Text style={[styles.chipText, lossReason === r.code && styles.chipTextActive]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}
            <View style={styles.actions}>
              <Pressable style={styles.btnSecondary} onPress={onClose} disabled={saving}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                disabled={saving}
                onPress={() => {
                  if (mode === 'WON') {
                    const value = Number(wonValue);
                    if (!Number.isFinite(value) || value < 0) return;
                    onSubmitWon({
                      wonValue: value,
                      wonProducts: wonProducts.trim() || undefined,
                    });
                    return;
                  }
                  onSubmitLost({ lossReason });
                }}
              >
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    marginBottom: 8,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#334155',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#e2e8f0', fontSize: 12 },
  chipTextActive: { color: '#0f172a', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnSecondary: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '600' },
  btnPrimary: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#0f172a', fontWeight: '700' },
});
