import { useCallback, useState } from 'react';
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
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api, type Lead } from '../../lib/api';
import { LEAD_STAGES } from '../../constants/stages';
import { DueDatePickerModal } from '../../components/DueDatePickerModal';

type Activity = {
  id: string;
  type: string;
  subject?: string | null;
  body: string;
  createdAt: string;
};

type Task = {
  id: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
};

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState<{ action: string; reason: string } | null>(null);
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [dueDateEdit, setDueDateEdit] = useState<{ taskId: string; title: string } | null>(null);

  function formatDue(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Due date unknown';
    return `Due ${d.toLocaleDateString()}`;
  }

  const load = useCallback(async () => {
    if (!id) return;
    const [leadRes, actRes, taskRes] = await Promise.all([
      api<{ lead: Lead }>(`/leads/${id}`),
      api<{ activities: Activity[] }>(`/leads/${id}/activities`),
      api<{ tasks: Task[] }>(`/leads/${id}/tasks`),
    ]);
    setLead(leadRes.lead);
    setActivities(actRes.activities);
    setTasks(taskRes.tasks);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function loadAi() {
    if (!id) return;
    setLoadingAi(true);
    try {
      const [s, n] = await Promise.all([
        api<{ summary: string }>(`/ai/leads/${id}/summary`),
        api<{ action: string; reason: string }>(`/ai/leads/${id}/next-action`),
      ]);
      setSummary(s.summary);
      setNextAction(n);
    } catch (e) {
      Alert.alert('AI', e instanceof Error ? e.message : 'AI unavailable');
    } finally {
      setLoadingAi(false);
    }
  }

  async function addNote() {
    if (!note.trim() || !id) return;
    try {
      await api(`/leads/${id}/activities`, {
        method: 'POST',
        body: { type: 'NOTE', body: note.trim(), useAiClean: true },
      });
      setNote('');
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save note');
    }
  }

  async function addTask() {
    if (!taskTitle.trim() || !id) return;
    const due = new Date();
    due.setDate(due.getDate() + 1);
    try {
      await api('/tasks', {
        method: 'POST',
        body: { leadId: id, title: taskTitle.trim(), dueAt: due.toISOString() },
      });
      setTaskTitle('');
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add task');
    }
  }

  async function updateTaskDue(taskId: string, dueAt: Date) {
    const normalized = new Date(dueAt);
    normalized.setHours(12, 0, 0, 0);
    try {
      await api(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: { dueAt: normalized.toISOString() },
      });
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update due date');
    }
  }

  function openDueDatePicker(task: Task) {
    if (task.dueAt) {
      const initial = new Date(task.dueAt);
      if (Number.isNaN(initial.getTime())) {
        Alert.alert('Error', 'This task has an invalid due date.');
        return;
      }
    }
    setDueDateEdit({ taskId: task.id, title: task.title });
  }

  function openTaskMenu(task: Task) {
    if (task.completedAt) {
      Alert.alert(task.title, 'This task is already complete.');
      return;
    }
    Alert.alert(task.title, undefined, [
      { text: 'Change due date', onPress: () => openDueDatePicker(task) },
      { text: 'Mark complete', onPress: () => completeTask(task.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function completeTask(taskId: string) {
    try {
      await api(`/tasks/${taskId}`, { method: 'PATCH', body: { completed: true } });
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not complete task');
    }
  }

  async function confirmStage(toStage: string) {
    if (!id) return;
    try {
      await api(`/leads/${id}`, {
        method: 'PATCH',
        body: { stage: toStage, confirmStageSuggestion: true },
      });
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update stage');
    }
  }

  if (!lead) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.name}>{lead.name}</Text>
      <Text style={styles.meta}>{lead.stage}</Text>

      <Pressable
        style={styles.callBtn}
        onPress={() =>
          router.push({
            pathname: '/lead/post-call',
            params: { leadId: id, leadName: lead.name },
          })
        }
      >
        <Text style={styles.callBtnText}>Log call (AI)</Text>
      </Pressable>

      <Pressable style={styles.aiBtn} onPress={loadAi} disabled={loadingAi}>
        <Text style={styles.aiBtnText}>{loadingAi ? 'Loading AI…' : 'Refresh AI insight'}</Text>
      </Pressable>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
      {nextAction ? (
        <View style={styles.nextBox}>
          <Text style={styles.nextTitle}>{nextAction.action}</Text>
          <Text style={styles.nextReason}>{nextAction.reason}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Follow-up tasks</Text>
      {tasks.map((t) => (
        <Pressable
          key={t.id}
          style={[styles.taskRow, t.completedAt && styles.taskDone]}
          onPress={() => openTaskMenu(t)}
        >
          <Text style={styles.taskTitle}>{t.completedAt ? '✓ ' : ''}{t.title}</Text>
          {t.dueAt ? <Text style={styles.taskDue}>{formatDue(t.dueAt)}</Text> : null}
          {!t.completedAt ? (
            <Text style={styles.taskHint}>Tap to change due date or complete</Text>
          ) : null}
        </Pressable>
      ))}
      <DueDatePickerModal
        visible={dueDateEdit !== null}
        title={dueDateEdit?.title}
        onClose={() => setDueDateEdit(null)}
        onSelect={(date) => {
          if (dueDateEdit) {
            void updateTaskDue(dueDateEdit.taskId, date);
          }
        }}
      />
      <TextInput
        style={styles.taskInput}
        value={taskTitle}
        onChangeText={setTaskTitle}
        placeholder="New task title…"
        placeholderTextColor="#64748b"
      />
      <Pressable style={styles.aiBtn} onPress={addTask}>
        <Text style={styles.aiBtnText}>Add task (due tomorrow)</Text>
      </Pressable>

      <Text style={styles.section}>Stage</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {LEAD_STAGES.map((s) => (
          <Pressable
            key={s}
            style={[styles.stageChip, lead.stage === s && styles.stageChipActive]}
            onPress={() => confirmStage(s)}
          >
            <Text style={styles.stageChipText}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.section}>Quick note</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="Type or paste voice transcript…"
        placeholderTextColor="#64748b"
        multiline
      />
      <Pressable style={styles.aiBtn} onPress={addNote}>
        <Text style={styles.aiBtnText}>Save note (AI clean)</Text>
      </Pressable>

      <Text style={styles.section}>Timeline</Text>
      {activities.map((a) => (
        <View key={a.id} style={styles.activity}>
          <Text style={styles.activityType}>{a.type}</Text>
          <Text style={styles.activityBody}>{a.body}</Text>
          <Text style={styles.activityDate}>{new Date(a.createdAt).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  name: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  meta: { color: '#38bdf8', marginBottom: 8 },
  callBtn: {
    backgroundColor: '#38bdf8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  callBtnText: { color: '#0f172a', fontWeight: '700' },
  section: { color: '#94a3b8', fontWeight: '600', marginTop: 20, marginBottom: 8 },
  summary: { color: '#e2e8f0', lineHeight: 22 },
  nextBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginTop: 8 },
  nextTitle: { color: '#f8fafc', fontWeight: '600' },
  nextReason: { color: '#94a3b8', marginTop: 4 },
  aiBtn: {
    backgroundColor: '#334155',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  aiBtnText: { color: '#38bdf8', fontWeight: '600' },
  taskRow: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  taskDone: { opacity: 0.6 },
  taskTitle: { color: '#f8fafc' },
  taskDue: { color: '#64748b', fontSize: 12, marginTop: 4 },
  taskHint: { color: '#475569', fontSize: 11, marginTop: 6 },
  taskInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  stageChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  stageChipActive: { backgroundColor: '#38bdf8' },
  stageChipText: { color: '#f8fafc', fontSize: 12 },
  noteInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    minHeight: 80,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  activity: {
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    paddingLeft: 12,
    marginBottom: 12,
  },
  activityType: { color: '#64748b', fontSize: 12 },
  activityBody: { color: '#f8fafc', marginTop: 4 },
  activityDate: { color: '#475569', fontSize: 11, marginTop: 4 },
});
