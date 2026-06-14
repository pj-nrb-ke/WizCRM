import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const TYPES = [
  { value: 'CALL', label: 'Call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'NOTE', label: 'Note' },
] as const;

type Props = {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: { type: string; subject?: string; body: string }) => void;
};

export function LogActivitySheet({ visible, saving, onClose, onSubmit }: Props) {
  const [type, setType] = useState<string>('CALL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  function reset() {
    setType('CALL');
    setSubject('');
    setBody('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Log activity</Text>
            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.chip, type === t.value && styles.chipActive]}
                  onPress={() => setType(t.value)}
                >
                  <Text style={[styles.chipText, type === t.value && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Subject (optional)</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholderTextColor="#64748b"
            />
            <Text style={styles.label}>Details *</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={body}
              onChangeText={setBody}
              placeholder={
                type === 'EMAIL'
                  ? 'Summary of the email…'
                  : type === 'MEETING'
                    ? 'Attendees, outcomes…'
                    : 'What happened?'
              }
              placeholderTextColor="#64748b"
            />
            <View style={styles.actions}>
              <Pressable style={styles.btnSecondary} onPress={handleClose} disabled={saving}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.btnPrimary}
                disabled={saving || !body.trim()}
                onPress={() => {
                  onSubmit({
                    type,
                    subject: subject.trim() || undefined,
                    body: body.trim(),
                  });
                  reset();
                }}
              >
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '75%',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    marginBottom: 8,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#334155',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#e2e8f0', fontSize: 12 },
  chipTextActive: { color: '#0f172a', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnSecondary: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '600' },
  btnPrimary: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#0f172a', fontWeight: '700' },
});
