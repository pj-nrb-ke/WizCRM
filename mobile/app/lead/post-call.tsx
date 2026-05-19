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
import { api } from '../../lib/api';

type PostCallResult = {
  summary: string;
  suggestedTask: { title: string; dueAt?: string };
  suggestedStage?: string;
};

export default function PostCallScreen() {
  const { leadId, leadName } = useLocalSearchParams<{ leadId: string; leadName?: string }>();
  const [roughNote, setRoughNote] = useState('');
  const [result, setResult] = useState<PostCallResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function processNote() {
    if (!leadId || !roughNote.trim()) return;
    setLoading(true);
    try {
      const data = await api<PostCallResult>('/ai/post-call', {
        method: 'POST',
        body: { leadId, roughNote: roughNote.trim() },
      });
      setResult(data);
    } catch (e) {
      Alert.alert('AI', e instanceof Error ? e.message : 'Could not process call note');
    } finally {
      setLoading(false);
    }
  }

  async function confirmSave(applyStage: boolean) {
    if (!leadId || !result) return;
    setSaving(true);
    try {
      await api('/ai/post-call/confirm', {
        method: 'POST',
        body: {
          leadId,
          summary: result.summary,
          taskTitle: result.suggestedTask?.title,
          taskDueAt: result.suggestedTask?.dueAt,
          suggestedStage: result.suggestedStage,
          applyStage,
        },
      });
      Alert.alert('Saved', applyStage ? 'Call logged and stage updated.' : 'Call logged to CRM.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const hasStageSuggestion =
    Boolean(result?.suggestedStage) &&
    result?.suggestedStage !== undefined;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Log call{leadName ? `: ${leadName}` : ''}</Text>
      <Text style={styles.hint}>Type or paste what happened on the call. AI will structure it.</Text>

      <TextInput
        style={styles.input}
        value={roughNote}
        onChangeText={setRoughNote}
        placeholder="e.g. Discussed pricing, will send quote Friday…"
        placeholderTextColor="#64748b"
        multiline
        editable={!result}
      />

      {!result ? (
        <Pressable style={styles.primaryBtn} onPress={processNote} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.primaryText}>Process with AI</Text>
          )}
        </Pressable>
      ) : (
        <>
          <Text style={styles.section}>AI summary</Text>
          <Text style={styles.body}>{result.summary}</Text>
          {result.suggestedTask?.title ? (
            <>
              <Text style={styles.section}>Suggested task</Text>
              <Text style={styles.body}>{result.suggestedTask.title}</Text>
            </>
          ) : null}
          {hasStageSuggestion ? (
            <>
              <Text style={styles.section}>Suggested stage (confirm separately)</Text>
              <Text style={styles.body}>{result.suggestedStage}</Text>
            </>
          ) : null}
          <Pressable style={styles.primaryBtn} onPress={() => confirmSave(false)} disabled={saving}>
            <Text style={styles.primaryText}>
              {saving ? 'Saving…' : 'Confirm & save call'}
            </Text>
          </Pressable>
          {hasStageSuggestion ? (
            <Pressable
              style={styles.stageBtn}
              onPress={() => confirmSave(true)}
              disabled={saving}
            >
              <Text style={styles.stageBtnText}>Save call + apply stage change</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.secondaryBtn} onPress={() => setResult(null)}>
            <Text style={styles.secondaryText}>Edit note and try again</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  hint: { color: '#94a3b8', marginBottom: 16, lineHeight: 20 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    minHeight: 120,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },
  section: { color: '#38bdf8', fontWeight: '600', marginTop: 20, marginBottom: 6 },
  body: { color: '#e2e8f0', lineHeight: 22 },
  primaryBtn: {
    backgroundColor: '#38bdf8',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryText: { color: '#0f172a', fontWeight: '700' },
  stageBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  stageBtnText: { color: '#38bdf8', fontWeight: '600' },
  secondaryBtn: { padding: 16, alignItems: 'center' },
  secondaryText: { color: '#94a3b8' },
});
