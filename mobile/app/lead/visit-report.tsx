import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../../lib/api';
import { queueOfflineMutation, isOfflineError } from '../../lib/offline-queue';

const OUTCOME_CHIPS = [
  'Interested',
  'Needs follow-up',
  'Requested quote',
  'Not now',
  'Closed-won',
  'Closed-lost',
];

const DUE_CHIPS: { label: string; days: number }[] = [
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
];

/** Deterministic per calendar day (17:00), so chip equality checks stay stable across re-renders. */
function dueFromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

export default function VisitReportScreen() {
  const { leadId, leadName } = useLocalSearchParams<{ leadId: string; leadName?: string }>();
  const [outcome, setOutcome] = useState('');
  const [whoMet, setWhoMet] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [objection, setObjection] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [attachLocation, setAttachLocation] = useState(true);
  const [saving, setSaving] = useState(false);

  async function getCoords(): Promise<{ lat: number; lng: number } | undefined> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return undefined;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return undefined;
    }
  }

  async function submit() {
    if (!leadId || !outcome.trim()) {
      Alert.alert('Visit report', 'Add an outcome before saving.');
      return;
    }
    setSaving(true);
    try {
      const location = attachLocation ? await getCoords() : undefined;
      const payload = {
        outcome: outcome.trim(),
        whoMet: whoMet.trim() || undefined,
        competitor: competitor.trim() || undefined,
        objection: objection.trim() || undefined,
        nextStep: nextStep.trim() || undefined,
        nextStepDueAt: nextStep.trim() && nextDue ? nextDue : undefined,
        notes: notes.trim() || undefined,
        location,
        capturedAt: new Date().toISOString(),
      };
      try {
        await api(`/leads/${leadId}/visit-report`, { method: 'POST', body: payload });
        Alert.alert(
          'Saved',
          nextStep.trim() ? 'Visit logged and follow-up task created.' : 'Visit logged to CRM.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (isOfflineError(msg)) {
          await queueOfflineMutation({ type: 'VISIT_REPORT', leadId, payload });
          Alert.alert(
            'Saved offline',
            'Visit report queued — it will sync when you are back online.',
            [{ text: 'OK', onPress: () => router.back() }],
          );
        } else {
          Alert.alert('Error', msg || 'Could not save visit report');
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Visit report{leadName ? `: ${leadName}` : ''}</Text>
      <Text style={styles.hint}>Capture what happened. Works offline — it syncs when signal returns.</Text>

      <Text style={styles.label}>Outcome *</Text>
      <View style={styles.chipRow}>
        {OUTCOME_CHIPS.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, outcome === c && styles.chipActive]}
            onPress={() => setOutcome(c)}
          >
            <Text style={[styles.chipText, outcome === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={outcome}
        onChangeText={setOutcome}
        placeholder="Outcome of the visit"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Who did you meet?</Text>
      <TextInput
        style={styles.input}
        value={whoMet}
        onChangeText={setWhoMet}
        placeholder="Name / title"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Competitor mentioned</Text>
      <TextInput
        style={styles.input}
        value={competitor}
        onChangeText={setCompetitor}
        placeholder="e.g. incumbent supplier"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Objection raised</Text>
      <TextInput
        style={styles.input}
        value={objection}
        onChangeText={setObjection}
        placeholder="e.g. price, timing, approval"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Next step</Text>
      <TextInput
        style={styles.input}
        value={nextStep}
        onChangeText={setNextStep}
        placeholder="Creates a follow-up task"
        placeholderTextColor="#64748b"
      />
      {nextStep.trim() ? (
        <View style={styles.chipRow}>
          {DUE_CHIPS.map((d) => {
            const iso = dueFromDays(d.days);
            const active = nextDue === iso;
            return (
              <Pressable
                key={d.label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setNextDue(active ? null : iso)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Anything else worth recording…"
        placeholderTextColor="#64748b"
        multiline
      />

      <Pressable style={styles.locationRow} onPress={() => setAttachLocation((v) => !v)}>
        <View style={[styles.checkbox, attachLocation && styles.checkboxOn]}>
          {attachLocation ? <Text style={styles.checkboxTick}>✓</Text> : null}
        </View>
        <Text style={styles.locationText}>📍 Attach my location &amp; time</Text>
      </Pressable>

      <Pressable style={styles.primaryBtn} onPress={submit} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.primaryText}>Save visit report</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 6 },
  hint: { color: '#94a3b8', marginBottom: 16, lineHeight: 20 },
  label: { color: '#38bdf8', fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
  checkboxTick: { color: '#0f172a', fontWeight: '900', fontSize: 14 },
  locationText: { color: '#cbd5e1' },
  primaryBtn: {
    backgroundColor: '#38bdf8',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  primaryText: { color: '#0f172a', fontWeight: '700' },
});
