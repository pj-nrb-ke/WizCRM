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
import { LEAD_PRIORITIES, type LeadPriority } from '../../constants/priorities';

const SOURCE_PRESETS = ['Referral', 'Event', 'Website', 'Cold call', 'Partner', 'Other'];

export default function EditLeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState('');
  const [priority, setPriority] = useState<LeadPriority | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { lead } = await api<{ lead: Lead }>(`/leads/${id}`);
      setName(lead.name);
      setCompany(lead.company ?? '');
      setEmail(lead.email ?? '');
      setPhone(lead.phone ?? '');
      setSource(lead.source ?? '');
      setPriority((lead.priority as LeadPriority) ?? null);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load lead');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function save() {
    if (!id || !name.trim()) return;
    if (!email.trim() && !phone.trim()) {
      Alert.alert('Contact', 'Phone or email is required.');
      return;
    }
    setSaving(true);
    try {
      await api(`/leads/${id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          company: company.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          source: source.trim() || null,
          priority,
        },
      });
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
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
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Source</Text>
      <TextInput
        style={styles.input}
        value={source}
        onChangeText={setSource}
        placeholder="How did you meet them?"
        placeholderTextColor="#64748b"
      />
      <View style={styles.chipRow}>
        {SOURCE_PRESETS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, source === s && styles.chipActive]}
            onPress={() => setSource(s)}
          >
            <Text style={[styles.chipText, source === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, priority === null && styles.chipActive]}
          onPress={() => setPriority(null)}
        >
          <Text style={[styles.chipText, priority === null && styles.chipTextActive]}>None</Text>
        </Pressable>
        {LEAD_PRIORITIES.map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, priority === p && styles.chipActive]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={save} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#f8fafc', fontSize: 12 },
  chipTextActive: { color: '#0f172a', fontWeight: '700' },
  button: {
    backgroundColor: '#38bdf8',
    marginTop: 24,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
});
