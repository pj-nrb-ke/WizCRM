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
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { api } from '../../lib/api';
import { queueOfflineMutation, isOfflineError } from '../../lib/offline-queue';
import {
  attachmentPayload,
  buildVoiceAttachment,
  capturePhoto,
  isAttachmentTooLarge,
  readBase64FromUri,
  summarizeAttachments,
  uploadAttachment,
  type CapturedAttachment,
} from '../../lib/attachments';

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
  const [attachments, setAttachments] = useState<CapturedAttachment[]>([]);
  const [saving, setSaving] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const [voiceBusy, setVoiceBusy] = useState(false);

  async function addPhoto(source: 'camera' | 'gallery') {
    try {
      const file = await capturePhoto(source);
      if (!file) return;
      if (isAttachmentTooLarge(file.dataBase64)) {
        Alert.alert('Photo', 'That photo is too large (max ~5MB). Try again.');
        return;
      }
      setAttachments((prev) => [...prev, file]);
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : 'Could not add the photo.');
    }
  }

  async function toggleVoice() {
    if (voiceBusy) return;
    try {
      if (!recState.isRecording) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Microphone', 'Allow microphone access to record a voice note.');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } else {
        setVoiceBusy(true);
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) {
          Alert.alert('Recording', 'No audio captured. Try again.');
          return;
        }
        const base64 = await readBase64FromUri(uri);
        if (isAttachmentTooLarge(base64)) {
          Alert.alert('Voice note', 'That recording is too large (max ~5MB). Keep it under a couple of minutes.');
          return;
        }
        setAttachments((prev) => [...prev, buildVoiceAttachment(base64)]);
      }
    } catch (e) {
      Alert.alert('Voice note', e instanceof Error ? e.message : 'Could not record. Try again.');
    } finally {
      setVoiceBusy(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

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
      const attachSummary = summarizeAttachments(attachments);
      const baseNotes = notes.trim();
      const notesOut = attachSummary
        ? `${baseNotes}${baseNotes ? '\n\n' : ''}[Attached: ${attachSummary}]`
        : baseNotes || undefined;
      const payload = {
        outcome: outcome.trim(),
        whoMet: whoMet.trim() || undefined,
        competitor: competitor.trim() || undefined,
        objection: objection.trim() || undefined,
        nextStep: nextStep.trim() || undefined,
        nextStepDueAt: nextStep.trim() && nextDue ? nextDue : undefined,
        notes: notesOut,
        location,
        capturedAt: new Date().toISOString(),
      };

      // 1) Save the report (falls back to the offline queue on a network error).
      let offline = false;
      try {
        await api(`/leads/${leadId}/visit-report`, { method: 'POST', body: payload });
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (!isOfflineError(msg)) {
          Alert.alert('Error', msg || 'Could not save visit report');
          return;
        }
        await queueOfflineMutation({ type: 'VISIT_REPORT', leadId, payload });
        offline = true;
      }

      // 2) Upload each attachment — or queue it if we are (or go) offline.
      let uploaded = 0;
      let queued = 0;
      let failed = 0;
      for (const file of attachments) {
        if (offline) {
          await queueOfflineMutation({ type: 'ATTACHMENT', leadId, payload: attachmentPayload(file) });
          queued += 1;
          continue;
        }
        try {
          await uploadAttachment(leadId, file);
          uploaded += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          if (isOfflineError(msg)) {
            await queueOfflineMutation({ type: 'ATTACHMENT', leadId, payload: attachmentPayload(file) });
            queued += 1;
          } else {
            failed += 1;
          }
        }
      }

      // 3) Report the outcome.
      const lines: string[] = [
        offline
          ? 'Visit report queued — it will sync when you are back online.'
          : nextStep.trim()
            ? 'Visit logged and follow-up task created.'
            : 'Visit logged to CRM.',
      ];
      if (uploaded) lines.push(`${uploaded} attachment${uploaded > 1 ? 's' : ''} uploaded.`);
      if (queued) lines.push(`${queued} attachment${queued > 1 ? 's' : ''} queued.`);
      if (failed) lines.push(`${failed} attachment${failed > 1 ? 's' : ''} failed — reopen the lead to retry.`);
      Alert.alert(offline ? 'Saved offline' : 'Saved', lines.join(' '), [
        { text: 'OK', onPress: () => router.back() },
      ]);
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

      <Text style={styles.label}>Photos &amp; voice notes</Text>
      <View style={styles.chipRow}>
        <Pressable style={styles.attachBtn} onPress={() => addPhoto('camera')}>
          <Text style={styles.attachBtnText}>📷 Photo</Text>
        </Pressable>
        <Pressable style={styles.attachBtn} onPress={() => addPhoto('gallery')}>
          <Text style={styles.attachBtnText}>🖼 Gallery</Text>
        </Pressable>
        <Pressable
          style={[styles.attachBtn, recState.isRecording && styles.attachBtnRec]}
          onPress={toggleVoice}
          disabled={voiceBusy}
        >
          {voiceBusy ? (
            <ActivityIndicator color="#f8fafc" />
          ) : (
            <Text style={styles.attachBtnText}>{recState.isRecording ? '⏺ Stop' : '🎙 Voice'}</Text>
          )}
        </Pressable>
      </View>
      {recState.isRecording ? (
        <Text style={styles.recHint}>Recording… tap Stop when done.</Text>
      ) : null}
      {attachments.length > 0 ? (
        <View style={styles.attachList}>
          {attachments.map((a) => (
            <View key={a.id} style={styles.attachItem}>
              <Text style={styles.attachItemText} numberOfLines={1}>
                {a.kind === 'photo' ? '📷' : '🎙'} {a.fileName} · {a.sizeLabel}
              </Text>
              <Pressable onPress={() => removeAttachment(a.id)} hitSlop={8}>
                <Text style={styles.attachRemove}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

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
  attachBtn: {
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 88,
    alignItems: 'center',
  },
  attachBtnRec: { backgroundColor: '#f87171' },
  attachBtnText: { color: '#f8fafc', fontWeight: '600', fontSize: 13 },
  recHint: { color: '#f87171', fontSize: 12, marginBottom: 4 },
  attachList: { marginTop: 4, gap: 8 },
  attachItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  attachItemText: { color: '#cbd5e1', fontSize: 13, flex: 1 },
  attachRemove: { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
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
