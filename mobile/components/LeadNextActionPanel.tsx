import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';

type Props = {
  leadId: string;
};

export function LeadNextActionPanel({ leadId }: Props) {
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setError('');
    api<{ action: string; reason: string; dismissed?: boolean }>(`/ai/leads/${leadId}/next-action`)
      .then((d) => {
        if (d.dismissed || !d.action) {
          setAction('');
          setReason('');
        } else {
          setAction(d.action);
          setReason(d.reason);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'AI unavailable'));
  }, [leadId]);

  async function createTask() {
    if (!action) return;
    setBusy(true);
    setMessage('');
    try {
      await api(`/ai/leads/${leadId}/next-action/create-task`, {
        method: 'POST',
        body: { action },
      });
      setMessage('Follow-up task created.');
      setAction('');
      setReason('');
    } catch (e) {
      Alert.alert('Task', e instanceof Error ? e.message : 'Could not create task');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!action) return null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Suggested next action</Text>
      <Text style={styles.action}>{action}</Text>
      {reason ? <Text style={styles.reason}>{reason}</Text> : null}
      <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={() => void createTask()} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'Creating…' : 'Create follow-up task'}</Text>
      </Pressable>
      {message ? <Text style={styles.ok}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#a78bfa',
  },
  title: { color: '#c4b5fd', fontWeight: '700', marginBottom: 6 },
  action: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  reason: { color: '#94a3b8', marginTop: 6, fontSize: 13 },
  btn: {
    marginTop: 10,
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700' },
  ok: { color: '#4ade80', marginTop: 8, fontSize: 13 },
  error: { color: '#f87171', marginTop: 8 },
});
