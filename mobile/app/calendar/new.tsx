import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { api, type Lead } from '../../lib/api';
import {
  defaultNewEventTimes,
  parseLocalDatetimeInput,
  toLocalDatetimeInput,
} from '../../lib/calendar-utils';

export default function NewCalendarEventScreen() {
  const times = defaultNewEventTimes();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [meetingAddress, setMeetingAddress] = useState('');
  const [startAt, setStartAt] = useState(toLocalDatetimeInput(times.startAt));
  const [endAt, setEndAt] = useState(toLocalDatetimeInput(times.endAt));
  const [leadId, setLeadId] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ leads: Lead[] }>('/leads')
      .then((d) => setLeads((d.leads ?? []).slice(0, 50)))
      .catch(() => setLeads([]));
  }, []);

  async function save() {
    if (!title.trim()) {
      Alert.alert('Title required', 'Enter an event title.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        notes: notes.trim() || undefined,
        startAt: parseLocalDatetimeInput(startAt),
        endAt: parseLocalDatetimeInput(endAt),
        meetingAddress: meetingAddress.trim() || undefined,
      };
      if (leadId) body.leadId = leadId;
      await api('/calendar/events', { method: 'POST', body });
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create event');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Meeting title" />

      <Text style={styles.label}>Start</Text>
      <TextInput style={styles.input} value={startAt} onChangeText={setStartAt} />

      <Text style={styles.label}>End</Text>
      <TextInput style={styles.input} value={endAt} onChangeText={setEndAt} />

      <Text style={styles.label}>Meeting address</Text>
      <TextInput
        style={styles.input}
        value={meetingAddress}
        onChangeText={setMeetingAddress}
        placeholder="Optional visit location"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {leads.length > 0 ? (
        <>
          <Text style={styles.label}>Link to lead (optional)</Text>
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, !leadId && styles.chipActive]}
              onPress={() => setLeadId('')}
            >
              <Text style={styles.chipText}>None</Text>
            </Pressable>
            {leads.slice(0, 15).map((l) => (
              <Pressable
                key={l.id}
                style={[styles.chip, leadId === l.id && styles.chipActive]}
                onPress={() => setLeadId(l.id)}
              >
                <Text style={[styles.chipText, leadId === l.id && styles.chipTextActive]} numberOfLines={1}>
                  {l.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Pressable style={styles.saveBtn} disabled={saving} onPress={() => void save()}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Create event'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: 140,
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#e2e8f0', fontSize: 12 },
  chipTextActive: { color: '#0f172a' },
  saveBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
});
