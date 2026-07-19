import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { isManagerRole } from '../lib/roles';
import {
  SALES_OPP_STAGES,
  SALES_OPP_STATUSES,
  SALES_OPP_STAGE_LABELS,
  SALES_OPP_STATUS_LABELS,
} from '../lib/opportunity-labels';

type Props = {
  visible: boolean;
  leadId: string;
  leadName: string;
  saving: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function SalesOpportunitySheet({
  visible,
  leadId,
  leadName,
  saving,
  onClose,
  onCreated,
}: Props) {
  const { user } = useAuth();
  const canSetBudget = isManagerRole(user?.role);
  const [description, setDescription] = useState('');
  const [contactPerson, setContactPerson] = useState(leadName);
  const [oppStage, setOppStage] = useState('NEW_OPPORTUNITY');
  const [oppStatus, setOppStatus] = useState('NOT_STARTED');
  const [probabilityPct, setProbabilityPct] = useState('25');
  const [forecastedExcl, setForecastedExcl] = useState('');
  const [budgeted, setBudgeted] = useState('');
  const [error, setError] = useState('');

  async function submit() {
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    setError('');
    try {
      const closeBy = new Date();
      closeBy.setDate(closeBy.getDate() + 30);
      await api('/opportunities', {
        method: 'POST',
        body: {
          leadId,
          description: description.trim(),
          contactPerson: contactPerson.trim() || leadName,
          oppStage,
          oppStatus,
          probabilityPct: Number(probabilityPct) || 0,
          sourceType: 'OTHER',
          closeBy: closeBy.toISOString(),
          forecastedExcl: forecastedExcl ? Number(forecastedExcl) : undefined,
          budgeted: canSetBudget && budgeted ? Number(budgeted) : undefined,
        },
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>New sales opportunity</Text>
            <Text style={styles.sub}>Linked to {leadName}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#64748b"
            />
            <Text style={styles.label}>Contact person</Text>
            <TextInput
              style={styles.input}
              value={contactPerson}
              onChangeText={setContactPerson}
              placeholderTextColor="#64748b"
            />
            <Text style={styles.label}>Stage</Text>
            <View style={styles.chips}>
              {SALES_OPP_STAGES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, oppStage === s && styles.chipActive]}
                  onPress={() => setOppStage(s)}
                >
                  <Text style={[styles.chipText, oppStage === s && styles.chipTextActive]}>
                    {SALES_OPP_STAGE_LABELS[s] ?? s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Status</Text>
            <View style={styles.chips}>
              {SALES_OPP_STATUSES.slice(0, 4).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, oppStatus === s && styles.chipActive]}
                  onPress={() => setOppStatus(s)}
                >
                  <Text style={[styles.chipText, oppStatus === s && styles.chipTextActive]}>
                    {SALES_OPP_STATUS_LABELS[s] ?? s}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Probability %</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={probabilityPct}
              onChangeText={setProbabilityPct}
            />
            <Text style={styles.label}>Forecast value (excl.)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={forecastedExcl}
              onChangeText={setForecastedExcl}
              placeholderTextColor="#64748b"
            />
            {canSetBudget ? (
              <>
                <Text style={styles.label}>Budgeted</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  value={budgeted}
                  onChangeText={setBudgeted}
                  placeholderTextColor="#64748b"
                />
              </>
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.save} disabled={saving} onPress={() => void submit()}>
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Create'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  sub: { color: '#64748b', marginBottom: 12 },
  label: { color: '#94a3b8', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#e2e8f0', fontSize: 11 },
  chipTextActive: { color: '#0f172a' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 8 },
  cancel: { flex: 1, padding: 14, alignItems: 'center' },
  cancelText: { color: '#94a3b8' },
  save: {
    flex: 1,
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  saveText: { color: '#0f172a', fontWeight: '700' },
  error: { color: '#f87171', marginBottom: 8 },
});
