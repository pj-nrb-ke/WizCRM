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
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api, type Lead } from '../../lib/api';
import { LEAD_STAGES } from '../../constants/stages';

type Activity = {
  id: string;
  type: string;
  subject?: string | null;
  body: string;
  createdAt: string;
};

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState<{ action: string; reason: string } | null>(null);
  const [note, setNote] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [leadRes, actRes] = await Promise.all([
      api<{ lead: Lead }>(`/leads/${id}`),
      api<{ activities: Activity[] }>(`/leads/${id}/activities`),
    ]);
    setLead(leadRes.lead);
    setActivities(actRes.activities);
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
    await api(`/leads/${id}/activities`, {
      method: 'POST',
      body: { type: 'NOTE', body: note.trim(), useAiClean: true },
    });
    setNote('');
    load();
  }

  async function confirmStage(toStage: string) {
    if (!id) return;
    await api(`/leads/${id}`, {
      method: 'PATCH',
      body: { stage: toStage, confirmStageSuggestion: true },
    });
    load();
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
  meta: { color: '#38bdf8', marginBottom: 12 },
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
