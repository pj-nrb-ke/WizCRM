import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../lib/api';

type OrgUser = { id: string; name: string; email: string };

type Message = {
  id: string;
  body: string;
  createdAt: string;
  user: { name: string };
};

type Props = {
  leadId: string;
  readOnly?: boolean;
};

export function LeadTeamChat({ leadId, readOnly }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [msgRes, userRes] = await Promise.all([
        api<{ messages: Message[] }>(`/leads/${leadId}/messages`),
        api<{ users: OrgUser[] }>('/teams/org-members'),
      ]);
      setMessages(msgRes.messages);
      setUsers(userRes.users);
    } catch {
      /* silent when offline */
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  function insertMention(u: OrgUser) {
    setBody((b) => `${b}@[${u.name}](${u.id}) `);
  }

  async function postMessage() {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      await api(`/leads/${leadId}/messages`, { method: 'POST', body: { body: text } });
      setBody('');
      await load();
    } catch (e) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Could not post');
    } finally {
      setSending(false);
    }
  }

  async function attachFile() {
    const pick = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: ['application/pdf', 'image/*'],
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    const asset = pick.assets[0];
    if ((asset.size ?? 0) > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Maximum size is 5MB.');
      return;
    }
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const dataBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await api(`/leads/${leadId}/attachments`, {
        method: 'POST',
        body: {
          fileName: asset.name,
          mimeType: asset.mimeType ?? 'application/octet-stream',
          dataBase64,
        },
      });
      Alert.alert('Uploaded', asset.name);
      await load();
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload');
    }
  }

  const atMatch = body.match(/@(\w*)$/);
  const filter = atMatch?.[1]?.toLowerCase() ?? '';
  const suggestions =
    filter.length >= 1
      ? users
          .filter(
            (u) =>
              u.name.toLowerCase().includes(filter) ||
              u.email.toLowerCase().includes(filter),
          )
          .slice(0, 5)
      : [];

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Team chat</Text>
      <Text style={styles.hint}>Internal only — @mention sends email via Brevo</Text>
      {messages.length === 0 ? (
        <Text style={styles.muted}>No messages yet.</Text>
      ) : (
        messages.slice(-8).map((m) => (
          <View key={m.id} style={styles.msg}>
            <Text style={styles.msgMeta}>
              {m.user.name} · {new Date(m.createdAt).toLocaleString()}
            </Text>
            <Text style={styles.msgBody}>{m.body}</Text>
          </View>
        ))
      )}
      {!readOnly ? (
        <>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Message team… @name to mention"
            placeholderTextColor="#64748b"
            value={body}
            onChangeText={setBody}
          />
          {suggestions.length > 0 ? (
            <View style={styles.suggestRow}>
              {suggestions.map((u) => (
                <Pressable key={u.id} style={styles.suggestChip} onPress={() => insertMention(u)}>
                  <Text style={styles.suggestText}>{u.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, sending && styles.btnDisabled]}
              onPress={() => void postMessage()}
              disabled={sending}
            >
              <Text style={styles.btnText}>{sending ? '…' : 'Post'}</Text>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={() => void attachFile()}>
              <Text style={styles.btnText}>Attach</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 12, backgroundColor: '#1e293b', borderRadius: 10 },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  hint: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  muted: { color: '#64748b', fontSize: 13 },
  msg: { marginBottom: 8 },
  msgMeta: { color: '#94a3b8', fontSize: 11 },
  msgBody: { color: '#e2e8f0', fontSize: 14 },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
    marginTop: 8,
  },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  suggestChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  suggestText: { color: '#e2e8f0', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnSecondary: { backgroundColor: '#475569', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600' },
});
