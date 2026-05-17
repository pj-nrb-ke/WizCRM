import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';

export default function NewLeadScreen() {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(force = false) {
    setSaving(true);
    try {
      const { lead } = await api<{ lead: { id: string } }>('/leads', {
        method: 'POST',
        body: {
          name: name.trim(),
          company: company.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          force,
        },
      });
      router.replace(`/lead/${lead.id}`);
    } catch (e) {
      const err = e as Error & { status?: number; data?: { duplicates?: unknown[] } };
      if (err.status === 409) {
        Alert.alert('Possible duplicate', 'A lead with this phone or email exists. Save anyway?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: () => save(true) },
        ]);
      } else {
        Alert.alert('Error', err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#64748b" />
      <Text style={styles.label}>Company</Text>
      <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholderTextColor="#64748b" />
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#64748b"
      />
      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#64748b" />
      <Text style={styles.hint}>Phone or email required</Text>
      <Pressable style={styles.button} onPress={() => save()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save lead'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  button: {
    backgroundColor: '#38bdf8',
    marginTop: 24,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
});
