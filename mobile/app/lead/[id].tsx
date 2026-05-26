import { useCallback, useMemo, useState } from 'react';
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
import {
  queueOfflineNote,
  flushOfflineQueue,
  listPendingMutations,
  queueOfflineMutation,
  isOfflineError,
} from '../../lib/offline-queue';
import { LeadTeamChat } from '../../components/LeadTeamChat';
import { openTel, openWhatsApp } from '../../lib/phone-links';
import { openGoogleMaps } from '../../lib/maps-links';
import { DueDatePickerModal } from '../../components/DueDatePickerModal';
import { VoiceNoteButton } from '../../components/VoiceNoteButton';
import { CloseLeadSheet } from '../../components/CloseLeadSheet';
import { LogActivitySheet } from '../../components/LogActivitySheet';
import { fetchCrmConfig, type CrmConfig } from '../../lib/crm-config';
import { mergeLeadTimeline } from '../../lib/lead-timeline';
import { lossReasonLabel } from '../../lib/close-lead';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';
import { LeadQuotations } from '../../components/LeadQuotations';
import { LeadOpportunities } from '../../components/LeadOpportunities';
import { loadLeadDetailCache, saveLeadDetailCache } from '../../lib/offline-leads-cache';

type Activity = {
  id: string;
  type: string;
  subject?: string | null;
  body: string;
  createdAt: string;
  user?: { name: string };
};

type StageChange = {
  id: string;
  fromStage: string;
  toStage: string;
  note: string | null;
  createdAt: string;
  user: { name: string };
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
  const isManager = isManagerRole(user?.role);
  const readOnly = isManager;
  const [assignableUsers, setAssignableUsers] = useState<{ id: string; name: string }[]>([]);

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
  const [stageChanges, setStageChanges] = useState<StageChange[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [cacheSavedAt, setCacheSavedAt] = useState('');
  const [loadError, setLoadError] = useState('');
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(null);
  const [closeMode, setCloseMode] = useState<'WON' | 'LOST' | null>(null);
  const [closeSaving, setCloseSaving] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [logSaving, setLogSaving] = useState(false);

  function formatDue(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Due date unknown';
    return `Due ${d.toLocaleDateString()}`;
  }

  const refreshPending = useCallback(async () => {
    if (!id) return;
    const pending = await listPendingMutations();
    setPendingCount(pending.filter((m) => m.leadId === id).length);
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    setFromCache(false);
    setLoadError('');
    try {
      const [leadRes, taskRes, insightRes, pending, crm] = await Promise.all([
        api<{ lead: Lead }>(`/leads/${id}`),
        api<{ tasks: Task[] }>(`/leads/${id}/tasks`),
        api<{ insights: LeadInsights }>(`/leads/${id}/insights`).catch(() => ({ insights: null })),
        listPendingMutations(),
        fetchCrmConfig(),
      ]);
      const leadData = leadRes.lead;
      let activityRows: Activity[];
      if (leadData.activities?.length) {
        activityRows = leadData.activities;
      } else {
        const actRes = await api<{ activities: Activity[] }>(`/leads/${id}/activities`);
        activityRows = actRes.activities;
      }
      const stageRows = leadData.stageChanges ?? [];
      setLead(leadData);
      setCrmConfig(crm);
      setActivities(activityRows);
      setStageChanges(stageRows);
      setTasks(taskRes.tasks);
      setInsights(insightRes.insights);
      setPendingCount(pending.filter((n) => n.leadId === id).length);
      void saveLeadDetailCache(id, {
        savedAt: new Date().toISOString(),
        lead: leadData,
        tasks: taskRes.tasks,
        activities: activityRows,
        stageChanges: stageRows,
      });
      if (isManagerRole(user?.role)) {
        api<{ users: { id: string; name: string }[] }>('/teams/assignable-users')
          .then((r) => setAssignableUsers(r.users ?? []))
          .catch(() => setAssignableUsers([]));
      }
    } catch (e) {
      const cached = await loadLeadDetailCache(id);
      if (cached) {
        setLead(cached.lead);
        setActivities(cached.activities);
        setStageChanges(cached.stageChanges);
        setTasks(cached.tasks);
        setFromCache(true);
        setCacheSavedAt(cached.savedAt);
      } else {
        setLoadError(e instanceof Error ? e.message : 'Failed to load lead');
      }
    }
  }, [id, user?.role]);

  const timeline = useMemo(
    () =>
      mergeLeadTimeline(
        activities.map((a) => ({
          ...a,
          userName: a.user?.name,
        })),
        stageChanges.map((s) => ({
          ...s,
          userName: s.user.name,
        })),
      ),
    [activities, stageChanges],
  );

  const isClosed = lead?.stage === 'WON' || lead?.stage === 'LOST';

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
      const offline = isOfflineError(msg);
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

  async function sendDraftEmail() {
    if (!id || !lead?.email || !draft.trim()) {
      Alert.alert(
        'Email',
        'Add an email on the lead, load an email draft, then send.',
      );
      return;
    }
    Alert.alert('Send email?', `Send this message to ${lead.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            await api(`/email/leads/${id}/send`, {
              method: 'POST',
              body: {
                subject: `Follow up: ${lead.name}`,
                body: draft.trim(),
              },
            });
            Alert.alert('Sent', 'Email sent via Brevo and logged on the timeline.');
            setDraft('');
            load();
          } catch (e) {
            const err = e as Error & { status?: number };
            if (err.status === 503) {
              Alert.alert(
                'Email not configured',
                'Server needs docs/brevo.local.txt with Brevo credentials.',
              );
              return;
            }
            Alert.alert('Send failed', err.message || 'Could not send email');
          }
        },
      },
    ]);
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
      const msg = e instanceof Error ? e.message : '';
      if (isOfflineError(msg)) {
        await queueOfflineMutation({
          type: 'TASK_CREATE',
          leadId: id,
          payload: { title: taskTitle.trim(), dueAt: due.toISOString() },
        });
        setTaskTitle('');
        void refreshPending();
        Alert.alert('Saved offline', 'Task will sync when you are back online.');
        return;
      }
      Alert.alert('Error', msg || 'Could not add task');
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

  function onStagePress(toStage: string) {
    if (toStage === 'WON' || toStage === 'LOST') {
      setCloseMode(toStage);
      return;
    }
    void confirmStage(toStage);
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

  async function submitCloseWon(data: { wonValue: number; wonProducts?: string }) {
    if (!id) return;
    setCloseSaving(true);
    try {
      await api(`/leads/${id}`, {
        method: 'PATCH',
        body: {
          stage: 'WON',
          wonValue: data.wonValue,
          wonStartAt: new Date().toISOString(),
          wonProducts: data.wonProducts,
        },
      });
      setCloseMode(null);
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not close as won');
    } finally {
      setCloseSaving(false);
    }
  }

  async function reopenLead() {
    if (!id) return;
    Alert.alert('Reopen lead', 'Move back to Qualified and clear won/lost details?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reopen',
        onPress: () => {
          void api(`/leads/${id}`, { method: 'PATCH', body: { stage: 'QUALIFIED' } })
            .then(() => load())
            .catch((e) =>
              Alert.alert('Error', e instanceof Error ? e.message : 'Could not reopen'),
            );
        },
      },
    ]);
  }

  async function logActivity(data: { type: string; subject?: string; body: string }) {
    if (!id) return;
    setLogSaving(true);
    try {
      await api(`/leads/${id}/activities`, { method: 'POST', body: data });
      setShowLogActivity(false);
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not log activity');
    } finally {
      setLogSaving(false);
    }
  }

  async function submitCloseLost(data: { lossReason: string }) {
    if (!id) return;
    setCloseSaving(true);
    try {
      await api(`/leads/${id}`, {
        method: 'PATCH',
        body: { stage: 'LOST', lossReason: data.lossReason },
      });
      setCloseMode(null);
      load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not close as lost');
    } finally {
      setCloseSaving(false);
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
        {loadError ? <Text style={styles.loadError}>{loadError}</Text> : <ActivityIndicator color="#38bdf8" />}
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
      {fromCache ? (
        <Text style={styles.cacheBanner}>
          Offline — cached lead
          {cacheSavedAt ? ` (${new Date(cacheSavedAt).toLocaleString()})` : ''}
        </Text>
      ) : null}
      {readOnly ? (
        <Text style={styles.readOnlyBadge}>Manager view (read-only)</Text>
      ) : null}
      <Text style={styles.name}>{lead.name}</Text>
      <Text style={styles.meta}>
        {lead.stage}
        {lead.priority ? ` · ${priorityLabel(lead.priority as 'HOT' | 'WARM' | 'COLD')}` : ''}
        {lead.source ? ` · ${lead.source}` : ''}
      </Text>
      {lead.stage === 'WON' && lead.wonValue != null ? (
        <Text style={styles.closeBannerWon}>
          Won · {String(lead.wonValue)}
          {lead.wonProducts ? ` · ${lead.wonProducts}` : ''}
        </Text>
      ) : null}
      {lead.stage === 'LOST' && lead.lossReason ? (
        <Text style={styles.closeBannerLost}>Lost · {lossReasonLabel(lead.lossReason)}</Text>
      ) : null}
      {lead.company ? <Text style={styles.subMeta}>{lead.company}</Text> : null}
      {lead.owner ? (
        <Text style={styles.subMeta}>
          Owner: {lead.owner.name}
          {lead.owner.team ? ` · ${lead.owner.team.name}` : ''}
        </Text>
      ) : null}
      {lead.tags && lead.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {lead.tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {isManager && assignableUsers.length > 0 ? (
        <Pressable
          style={styles.reassignBtn}
          onPress={() => {
            Alert.alert(
              'Reassign owner',
              lead.name,
              [
                ...assignableUsers.map((u) => ({
                  text: u.name,
                  onPress: () => {
                    void api(`/leads/${id}`, { method: 'PATCH', body: { ownerId: u.id } })
                      .then(() => load())
                      .catch((e) =>
                        Alert.alert('Error', e instanceof Error ? e.message : 'Reassign failed'),
                      );
                  },
                })),
                { text: 'Cancel', style: 'cancel' },
              ],
            );
          }}
        >
          <Text style={styles.reassignBtnText}>Reassign owner</Text>
        </Pressable>
      ) : null}
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

      {!readOnly || isManager ? (
        <View style={styles.actionRow}>
          {!readOnly ? (
            <>
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
            </>
          ) : null}
          <Pressable
            style={styles.editBtn}
            onPress={() => router.push({ pathname: '/lead/edit', params: { id } })}
          >
            <Text style={styles.editBtnText}>{readOnly ? 'Edit / tags' : 'Edit'}</Text>
          </Pressable>
        </View>
      ) : null}

      {!readOnly ? (
        <View style={styles.logRow}>
          <Pressable style={styles.compactBarBtn} onPress={() => setShowLogActivity(true)}>
            <Text style={styles.compactBarBtnText}>Log activity</Text>
          </Pressable>
          <Pressable
            style={[styles.compactBarBtn, styles.compactBarBtnSecondary]}
            onPress={() =>
              router.push({
                pathname: '/lead/post-call',
                params: { leadId: id, leadName: lead.name },
              })
            }
          >
            <Text style={styles.compactBarBtnText}>Log call (AI)</Text>
          </Pressable>
        </View>
      ) : null}

      {!readOnly && isClosed ? (
        <Pressable style={styles.reopenBtn} onPress={reopenLead}>
          <Text style={styles.reopenBtnText}>Reopen lead (Qualified)</Text>
        </Pressable>
      ) : null}

      {pendingCount > 0 ? (
        <Pressable
          style={styles.syncBtn}
          onPress={() => {
            void flushOfflineQueue()
              .then((r) => {
                void refreshPending();
                load();
                Alert.alert(
                  'Sync complete',
                  r.synced > 0
                    ? `${r.synced} change(s) synced.${r.failed > 0 ? ` ${r.failed} failed.` : ''}`
                    : r.failed > 0
                      ? `${r.failed} change(s) could not sync.`
                      : 'Nothing to sync.',
                );
              })
              .catch(() => Alert.alert('Sync failed', 'Check your connection and try again.'));
          }}
        >
          <Text style={styles.syncBtnText}>
            Sync now — {pendingCount} offline change{pendingCount === 1 ? '' : 's'}
          </Text>
        </Pressable>
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

      <LeadTeamChat leadId={id!} readOnly={readOnly} />

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
          {lead.email && draft ? (
            <Pressable style={styles.sendEmailBtn} onPress={sendDraftEmail}>
              <Text style={styles.sendEmailBtnText}>Send email (Brevo)</Text>
            </Pressable>
          ) : null}
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
      {isClosed && !readOnly ? (
        <Text style={styles.mutedHint}>Closed — use Reopen above or tap Won/Lost to update close details.</Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
        {LEAD_STAGES.map((s) => (
          <Pressable
            key={s}
            style={[styles.stageChip, lead.stage === s && styles.stageChipActive]}
            onPress={() => !readOnly && onStagePress(s)}
            disabled={readOnly || (isClosed && s !== 'WON' && s !== 'LOST')}
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

      <LeadQuotations leadId={lead.id} />
      <LeadOpportunities leadId={lead.id} leadName={lead.name} readOnly={readOnly} />

      <Text style={styles.section}>Timeline</Text>
      {timeline.length === 0 ? (
        <Text style={styles.mutedHint}>No history yet.</Text>
      ) : (
        timeline.map((item) =>
          item.kind === 'stage' ? (
            <View key={`stage-${item.data.id}`} style={styles.activity}>
              <Text style={styles.activityType}>STAGE</Text>
              <Text style={styles.activityBody}>
                {item.data.fromStage} → {item.data.toStage}
                {item.data.note ? `\n${item.data.note}` : ''}
              </Text>
              <Text style={styles.activityDate}>
                {item.data.userName} · {new Date(item.data.createdAt).toLocaleString()}
              </Text>
            </View>
          ) : (
            <View key={`act-${item.data.id}`} style={styles.activity}>
              <Text style={styles.activityType}>{item.data.type}</Text>
              {item.data.subject ? <Text style={styles.activitySubject}>{item.data.subject}</Text> : null}
              <Text style={styles.activityBody}>{item.data.body}</Text>
              <Text style={styles.activityDate}>
                {item.data.userName ? `${item.data.userName} · ` : ''}
                {new Date(item.data.createdAt).toLocaleString()}
              </Text>
            </View>
          ),
        )
      )}

      <CloseLeadSheet
        visible={closeMode !== null}
        mode={closeMode ?? 'WON'}
        lossReasons={crmConfig?.lossReasons}
        saving={closeSaving}
        onClose={() => setCloseMode(null)}
        onSubmitWon={(d) => void submitCloseWon(d)}
        onSubmitLost={(d) => void submitCloseLost(d)}
      />
      <LogActivitySheet
        visible={showLogActivity}
        saving={logSaving}
        onClose={() => setShowLogActivity(false)}
        onSubmit={(d) => void logActivity(d)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 16, paddingBottom: 120 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tagChip: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: { color: '#e2e8f0', fontSize: 12 },
  reassignBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  reassignBtnText: { color: '#38bdf8', fontWeight: '600' },
  readOnlyBadge: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cacheBanner: { color: '#fbbf24', fontSize: 13, marginBottom: 8 },
  loadError: { color: '#f87171', padding: 24, textAlign: 'center' },
  name: { fontSize: 24, fontWeight: '700', color: '#f8fafc' },
  closeBannerWon: { color: '#34d399', marginTop: 8, fontWeight: '600' },
  closeBannerLost: { color: '#f87171', marginTop: 8, fontWeight: '600' },
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
  logRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  compactBarBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBarBtnSecondary: { backgroundColor: '#1e3a5f' },
  compactBarBtnText: { color: '#38bdf8', fontWeight: '600', fontSize: 13 },
  reopenBtn: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#fbbf24',
    alignItems: 'center',
  },
  reopenBtnText: { color: '#fbbf24', fontWeight: '700' },
  mutedHint: { color: '#64748b', marginBottom: 8, fontSize: 13 },
  activitySubject: { color: '#cbd5e1', fontWeight: '600', marginBottom: 4 },
  offlineBadge: { color: '#fbbf24', fontSize: 12, marginBottom: 8 },
  syncBtn: {
    backgroundColor: '#422006',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  syncBtnText: { color: '#fbbf24', fontSize: 14, fontWeight: '600', textAlign: 'center' },
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
  sendEmailBtn: {
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  sendEmailBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
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
