import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../lib/api';

type TaskRow = {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
};

type Props = {
  opportunityId: string;
};

export function OpportunityTasks({ opportunityId }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ tasks: TaskRow[] }>(`/tasks?opportunityId=${opportunityId}`);
      setTasks(res.tasks ?? []);
    } catch {
      /* silent when offline */
    }
  }, [opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTask() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api('/tasks', { method: 'POST', body: { title: trimmed, opportunityId } });
      setTitle('');
      await load();
    } catch (e) {
      Alert.alert('Task', e instanceof Error ? e.message : 'Could not add task');
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: TaskRow) {
    try {
      await api(`/tasks/${task.id}`, { method: 'PATCH', body: { completed: !task.completedAt } });
      await load();
    } catch (e) {
      Alert.alert('Task', e instanceof Error ? e.message : 'Could not update task');
    }
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Tasks</Text>
      {tasks.length === 0 ? (
        <Text style={styles.muted}>No tasks on this opportunity yet.</Text>
      ) : (
        tasks.map((t) => (
          <Pressable key={t.id} style={styles.row} onPress={() => void toggleDone(t)}>
            <Text style={[styles.taskText, t.completedAt ? styles.taskDone : null]}>
              {t.completedAt ? '☑' : '☐'} {t.title}
            </Text>
            {t.dueAt ? <Text style={styles.meta}>due {new Date(t.dueAt).toLocaleDateString()}</Text> : null}
          </Pressable>
        ))
      )}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Finalize the quote today"
          placeholderTextColor="#64748b"
          value={title}
          onChangeText={setTitle}
        />
        <Pressable style={[styles.btn, saving && styles.btnDisabled]} onPress={() => void addTask()} disabled={saving}>
          <Text style={styles.btnText}>{saving ? '…' : 'Add'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 12, backgroundColor: '#1e293b', borderRadius: 10 },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  muted: { color: '#64748b', fontSize: 13 },
  row: { marginBottom: 8 },
  taskText: { color: '#e2e8f0', fontSize: 14 },
  taskDone: { textDecorationLine: 'line-through', color: '#64748b' },
  meta: { color: '#94a3b8', fontSize: 11 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  input: {
    flex: 1,
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
