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
import { api, type Lead, type LeadInsights } from '../../lib/api';
import { LEAD_STAGES } from '../../constants/stages';
import { priorityLabel } from '../../constants/priorities';
import { markCallStarted } from '../../lib/call-return';
import { queueOfflineNote, listPendingNotes } from '../../lib/offline-notes';
import { openTel, openWhatsApp } from '../../lib/phone-links';
import { openGoogleMaps } from '../../lib/maps-links';
import { DueDatePickerModal } from '../../components/DueDatePickerModal';
import { VoiceNoteButton } from '../../components/VoiceNoteButton';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';

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

type StageSuggestion = {
  suggestedStage: string;
  reason: string;
};

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const readOnly = isManagerRole(user?.role);

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState<{ action: string; reason: string } | null>(null);
  const [stageSuggestion, setStageSuggestion] = useState<StageSuggestion | null>(null);
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [dueDateEdit, setDueDateEdit] = useState<{ taskId: string; title: string } | null>(null);
  const [insights, setInsights] = useState<LeadInsights | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  function formatDue(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Due date unknown';
    return `Due ${d.toLocaleDateString()}`;
  }

  const load = useCallback(async () => {
    if (!id) return;
    const [leadRes, actRes, taskRes, insightRes, pending] = await Promise.all([
      api<{ lead: Lead }>(`/leads/${id}`),
      api<{ activities: Activity[] }>(`/leads/${id}/activities`),
      api<{ tasks: Task[] }>(`/leads/${id}/tasks`),
      api<{ insights: LeadInsights }>(`/leads/${id}/insights`).catch(() => ({ insights: null })),
      listPendingNotes(),
    ]);
    setLead(leadRes.lead);
    setActivities(actRes.activities);
    setTasks(taskRes.tasks);
    setInsights(insightRes.insights);
    setPendingCount(pending.filter((n) => n.leadId === id).length);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function loadAi() {
    if (!id || !lead) return;
    setLoadingAi(true);
    try {
      const [s, n, st] = await Promise.all([
        api<{ summary: string }>(`/ai/leads/${id}/summary`),
        api<{ action: string; reason: string; dismissed?: boolean }>(`/ai/leads/${id}/next-action`),
        api<StageSuggestion>(`/ai/leads/${id}/stage-suggestion`).catch(() => null),
      ]);
      setSummary(s.summary);
      if (n.dismissed || !n.action) {
        setNextAction(null);
      } else {
        setNextAction({ action: n.action, reason: n.reason });
      }
      if (st && st.suggestedStage !== lead.stage) {
        setStageSuggestion(st);
      } else {
        setStageSuggestion(null);
      }
    } catch (e) {
      Alert.alert('AI', e instanceof Error ? e.message : 'AI unavailable');
    } finally {
      setLoadingAi(false);
    }
  }

  async function addNote(useAiClean: boolean) {
    if (!note.trim() || !id) return;
    const body = note.trim();
    try {
      await api(`/leads/${id}/activities`, {
        method: 'POST',
        body: { type: 'NOTE', body, useAiClean },
      });
      setNote('');
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const offline =
        msg.includes('Cannot reach') ||
        msg.includes('Network request failed') ||
        msg.includes('timed out');
      if (useAiClean && !offline) {
        try {
          await api(`/leads/${id}/activities`, {
            method: 'POST',
            body: { type: 'NOTE', body },
          });
          setNote('');
          load();
          Alert.alert('Saved', 'Note saved without AI cleanup (AI or network unavailable).');
          return;
        } catch (inner) {
          Alert.alert('Error', inner instanceof Error ? inner.message : 'Could not save note');
          return;
        }
      }
      if (offline) {
        await queueOfflineNote(id, body);
        setNote('');
        load();
        Alert.alert('Saved offline', 'Note will sync when you are back online.');
        return;
      }
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save note');
    }
  }

  async function loadDraft(channel: 'whatsapp' | 'email') {
    if (!id) return;
    try {
      const data = await api<{ draft: string }>(
        `/ai/leads/${id}/draft-message?channel=${channel}&tone=friendly`,
      );
      setDraft(data.draft);
    } catch (e) {
      Alert.alert('Draft', e instanceof Error ? e.message : 'Could not load draft');
    }
  }

  async function startCall() {
    if (!lead?.phone || !id) {
      Alert.alert('Call', 'Add a phone number on this lead first.');
      return;
    }
    await markCallStarted(id, lead.name);
    await openTel(lead.phone);
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
      setStageSuggestion(null);
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update stage');
    }
  }

  async function dismissNextAction() {
    if (!id || !nextAction) return;
    try {
      await api(`/ai/leads/${id}/next-action/dismiss`, {
        method: 'POST',
        body: { action: nextAction.action },
      });
      setNextAction(null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not dismiss');
    }
  }

  async function completeNextAction() {
    if (!id || !nextAction) return;
    try {
      await api(`/ai/leads/${id}/next-action/complete`, {
        method: 'POST',
        body: { action: nextAction.action },
      });
      setNextAction(null);
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not complete');
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {readOnly ? (
        <Text style={styles.readOnlyBadge}>Manager view (read-only)</Text>
      ) : null}
      <Text style={styles.name}>{lead.name}</Text>
      <Text style={styles.meta}>
        {lead.stage}
        {lead.priority ? ` · ${priorityLabel(lead.priority as 'HOT' | 'WARM' | 'COLD')}` : ''}
        {lead.source ? ` · ${lead.source}` : ''}
      </Text>
      {lead.company ? <Text style={styles.subMeta}>{lead.company}</Text> : null}
      {lead.address ? (
        <Text style={styles.subMeta} numberOfLines={3}>
          {lead.address}
        </Text>
      ) : null}
      {lead.googleMapsUrl || lead.address ? (
        <Pressable
          style={styles.mapsLinkBtn}
          onPress={() => openGoogleMaps(lead.googleMapsUrl ?? lead.address ?? '')}
        >
          <Text style={styles.mapsLinkText}>Open in Google Maps</Text>
        </Pressable>
      ) : null}

      {!readOnly ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.callBtn} onPress={startCall} disabled={!lead.phone}>
            <Text style={styles.callBtnText}>Call</Text>
          </Pressable>
          <Pressable
            style={[styles.callBtn, styles.waBtn]}
            onPress={() => lead.phone && openWhatsApp(lead.phone)}
            disabled={!lead.phone}
          >
            <Text style={styles.callBtnText}>WhatsApp</Text>
          </Pressable>
          <Pressable
            style={styles.editBtn}
            onPress={() => router.push({ pathname: '/lead/edit', params: { id } })}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      ) : null}

      {!readOnly ? (
        <Pressable
          style={styles.compactBarBtn}
          onPress={() =>
            router.push({
              pathname: '/lead/post-call',
              params: { leadId: id, leadName: lead.name },
            })
          }
        >
          <Text style={styles.compactBarBtnText}>Log call (AI)</Text>
        </Pressable>
      ) : null}

      {pendingCount > 0 ? (
        <Text style={styles.offlineBadge}>
          {pendingCount} note(s) waiting to sync
        </Text>
      ) : null}

      {insights ? (
        <View style={styles.insightsBox}>
          <Text style={styles.section}>Pro scores</Text>
          <Text style={styles.scoreLine}>
            Urgency {insights.scores.urgency} · Engagement {insights.scores.engagement} · Fit{' '}
            {insights.scores.fit}
          </Text>
          {insights.hygiene.length > 0 ? (
            insights.hygiene.map((h) => (
              <Text key={h} style={styles.hygieneLine}>
                • {h}
              </Text>
            ))
          ) : (
            <Text style={styles.hygieneOk}>Data looks complete</Text>
          )}
        </View>
      ) : null}

      {!readOnly ? (
        <View style={styles.draftBox}>
          <Text style={styles.section}>Message draft (approve before sending)</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.secondaryBtn} onPress={() => loadDraft('whatsapp')}>
              <Text style={styles.secondaryBtnText}>WhatsApp draft</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => loadDraft('email')}>
              <Text style={styles.secondaryBtnText}>Email draft</Text>
            </Pressable>
          </View>
          {draft ? <Text style={styles.draftText}>{draft}</Text> : null}
        </View>
      ) : null}

      <Pressable style={styles.aiBtn} onPress={loadAi} disabled={loadingAi}>
        <Text style={styles.aiBtnText}>{loadingAi ? 'Loading AI…' : 'Refresh AI insight'}</Text>
      </Pressable>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}

      {nextAction ? (
        <View style={styles.nextBox}>
          <Text style={styles.nextTitle}>{nextAction.action}</Text>
          <Text style={styles.nextReason}>{nextAction.reason}</Text>
          {!readOnly ? (
            <View style={styles.nextActions}>
              <Pressable style={styles.nextActionBtn} onPress={completeNextAction}>
                <Text style={styles.nextActionBtnText}>Done</Text>
              </Pressable>
              <Pressable style={styles.nextDismissBtn} onPress={dismissNextAction}>
                <Text style={styles.nextDismissText}>Dismiss</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {stageSuggestion && stageSuggestion.suggestedStage !== lead.stage ? (
        <View style={styles.stageSuggestBox}>
          <Text style={styles.stageSuggestTitle}>AI suggests stage: {stageSuggestion.suggestedStage}</Text>
          <Text style={styles.stageSuggestReason}>{stageSuggestion.reason}</Text>
          {!readOnly ? (
            <View style={styles.nextActions}>
              <Pressable
                style={styles.nextActionBtn}
                onPress={() => confirmStage(stageSuggestion.suggestedStage)}
              >
                <Text style={styles.nextActionBtnText}>Confirm stage</Text>
              </Pressable>
              <Pressable style={styles.nextDismissBtn} onPress={() => setStageSuggestion(null)}>
                <Text style={styles.nextDismissText}>Not now</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.section}>Follow-up tasks</Text>
      {tasks.map((t) => (
        <Pressable
          key={t.id}
          style={[styles.taskRow, t.completedAt && styles.taskDone]}
          onPress={() => !readOnly && openTaskMenu(t)}
          disabled={readOnly}
        >
          <Text style={styles.taskTitle}>{t.completedAt ? '✓ ' : ''}{t.title}</Text>
          {t.dueAt ? <Text style={styles.taskDue}>{formatDue(t.dueAt)}</Text> : null}
          {!t.completedAt && !readOnly ? (
            <Text style={styles.taskHint}>Tap to change due date or complete</Text>
          ) : null}
        </Pressable>
      ))}
      {!readOnly ? (
        <>
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
        </>
      ) : null}

      <Text style={styles.section}>Stage</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
        {LEAD_STAGES.map((s) => (
          <Pressable
            key={s}
            style={[styles.stageChip, lead.stage === s && styles.stageChipActive]}
            onPress={() => !readOnly && confirmStage(s)}
            disabled={readOnly}
          >
            <Text style={[styles.stageChipText, lead.stage === s && styles.stageChipTextActive]}>
              {s}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.section}>Quick note</Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder={readOnly ? 'Read-only' : 'Type a note or use voice…'}
        placeholderTextColor="#64748b"
        multiline
        editable={!readOnly}
      />
      {!readOnly ? (
        <>
          <VoiceNoteButton onTranscript={(text) => setNote((prev) => (prev ? `${prev}\n${text}` : text))} />
          <Pressable style={styles.aiBtn} onPress={() => addNote(true)}>
            <Text style={styles.aiBtnText}>Save note (AI clean)</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => addNote(false)}>
            <Text style={styles.secondaryBtnText}>Save note (manual)</Text>
          </Pressable>
        </>
      ) : null}

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
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 16, paddingBottom: 120 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  readOnlyBadge: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  name: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  meta: { color: '#38bdf8', marginBottom: 4 },
  subMeta: { color: '#94a3b8', marginBottom: 8 },
  mapsLinkBtn: { marginBottom: 8 },
  mapsLinkText: { color: '#38bdf8', fontWeight: '600', fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  callBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  waBtn: { backgroundColor: '#22c55e' },
  callBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14, lineHeight: 18 },
  editBtn: {
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 14, lineHeight: 18 },
  compactBarBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBarBtnText: { color: '#38bdf8', fontWeight: '600', fontSize: 14 },
  offlineBadge: { color: '#fbbf24', fontSize: 12, marginBottom: 8 },
  insightsBox: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  scoreLine: { color: '#e2e8f0', marginTop: 4 },
  hygieneLine: { color: '#fbbf24', marginTop: 4, fontSize: 13 },
  hygieneOk: { color: '#4ade80', marginTop: 4, fontSize: 13 },
  draftBox: { marginBottom: 8 },
  draftText: { color: '#e2e8f0', lineHeight: 22, marginTop: 8 },
  section: { color: '#94a3b8', fontWeight: '600', marginTop: 20, marginBottom: 8 },
  summary: { color: '#e2e8f0', lineHeight: 22 },
  nextBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginTop: 8 },
  nextTitle: { color: '#f8fafc', fontWeight: '600' },
  nextReason: { color: '#94a3b8', marginTop: 4 },
  stageSuggestBox: {
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#38bdf8',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  stageSuggestTitle: { color: '#38bdf8', fontWeight: '700' },
  stageSuggestReason: { color: '#94a3b8', marginTop: 6, lineHeight: 20 },
  nextActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  nextActionBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  nextActionBtnText: { color: '#0f172a', fontWeight: '700' },
  nextDismissBtn: {
    borderWidth: 1,
    borderColor: '#64748b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nextDismissText: { color: '#94a3b8', fontWeight: '600' },
  aiBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiBtnText: { color: '#38bdf8', fontWeight: '600', fontSize: 14 },
  secondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
    flex: 1,
  },
  secondaryBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
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
  stageChipTextActive: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
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
