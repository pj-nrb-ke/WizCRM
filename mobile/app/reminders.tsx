import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { createReminder, deleteReminder, fetchReminders, type UserReminderRow } from '../lib/reminders';
import { fetchCrmConfig } from '../lib/crm-config';
import { ProjectTagsEditor } from '../components/ProjectTagsEditor';
import { rescheduleLocalReminders } from '../lib/notifications';
import { api } from '../lib/api';
import { toLocalDatetimeInput, parseLocalDatetimeInput } from '../lib/calendar-utils';

export default function RemindersScreen() {
  const [items, setItems] = useState<UserReminderRow[]>([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [when, setWhen] = useState(toLocalDatetimeInput(new Date(Date.now() + 3600000).toISOString()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 60 * 86400000).toISOString();
    const [rem, crm, tasksRes, eventsRes] = await Promise.all([
      fetchReminders(from, to),
      fetchCrmConfig(),
      api<{ tasks: { id: string; title: string; dueAt: string | null; completedAt?: string | null }[] }>('/tasks'),
      api<{ events: { id: string; title: string; startAt: string; reminderMinutes?: number | null }[] }>(
        `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      ).catch(() => ({ events: [] })),
    ]);
    setItems(rem.reminders);
    setTagSuggestions(crm.leadTags ?? []);
    void rescheduleLocalReminders({
      tasks: tasksRes.tasks ?? [],
      events: eventsRes.events ?? [],
      customReminders: rem.reminders,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load()
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, [load]),
  );

  async function add() {
    if (!title.trim()) {
      Alert.alert('Title required', 'Enter a reminder title.');
      return;
    }
    setSaving(true);
    try {
      await createReminder({
        title: title.trim(),
        notes: notes.trim() || undefined,
        remindAt: parseLocalDatetimeInput(when),
        tags,
      });
      setTitle('');
      setNotes('');
      setTags([]);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteReminder(id);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete');
    }
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#38bdf8" />}
    >
      <Stack.Screen options={{ title: 'Reminders' }} />
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.hint}>Custom reminders fire as local notifications (alarm sound).</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Call supplier" />
      <Text style={styles.label}>When</Text>
      <TextInput style={styles.input} value={when} onChangeText={setWhen} />
      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline />
      <ProjectTagsEditor tags={tags} suggestions={tagSuggestions} onChange={setTags} />
      <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={() => void add()} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Add reminder'}</Text>
      </Pressable>

      <Text style={styles.section}>Upcoming</Text>
      {loading && items.length === 0 ? <ActivityIndicator color="#38bdf8" /> : null}
      {items.length === 0 && !loading ? <Text style={styles.empty}>No reminders scheduled.</Text> : null}
      {items.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{r.title}</Text>
            <Text style={styles.rowMeta}>{new Date(r.remindAt).toLocaleString()}</Text>
            {r.tags.length > 0 ? <Text style={styles.tags}>{r.tags.join(' · ')}</Text> : null}
          </View>
          <Pressable onPress={() => void remove(r.id)}>
            <Text style={styles.del}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  back: { color: '#38bdf8', marginBottom: 8, fontWeight: '600' },
  hint: { color: '#64748b', marginBottom: 16, fontSize: 13 },
  label: { color: '#94a3b8', marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveBtn: {
    marginTop: 16,
    backgroundColor: '#38bdf8',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  saveText: { color: '#0f172a', fontWeight: '700' },
  section: { color: '#94a3b8', fontWeight: '600', marginTop: 24, marginBottom: 8 },
  empty: { color: '#64748b' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  rowTitle: { color: '#f8fafc', fontWeight: '600' },
  rowMeta: { color: '#64748b', fontSize: 12, marginTop: 2 },
  tags: { color: '#38bdf8', fontSize: 12, marginTop: 4 },
  del: { color: '#f87171', fontWeight: '600' },
});
