import { useCallback, useEffect, useState } from 'react';
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
import { api } from '../../lib/api';
import { LEAD_PRIORITIES, type LeadPriority } from '../../constants/priorities';
import { ContactFields } from '../../components/ContactFields';
import { buildLeadPayload, formHasContact, leadToFormState, type LeadFormState } from '../../lib/lead-form';
import { LeadTagsEditor } from '../../components/LeadTagsEditor';
import { fetchCrmConfig, type CrmConfig } from '../../lib/crm-config';

const SOURCE_PRESETS = ['Referral', 'Event', 'Website', 'Cold call', 'Partner', 'Other'];

export default function EditLeadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LeadFormState>({
    name: '',
    company: '',
    phone: '',
    email: '',
    extraPhones: [],
    extraEmails: [],
    address: '',
    googleMapsUrl: '',
    source: '',
    tags: [],
    priority: null,
  });
  const [crmConfig, setCrmConfig] = useState<CrmConfig | null>(null);

  useEffect(() => {
    fetchCrmConfig().then(setCrmConfig);
  }, []);

  const patch = (partial: Partial<LeadFormState>) => setForm((f) => ({ ...f, ...partial }));

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { lead } = await api<{ lead: Parameters<typeof leadToFormState>[0] }>(`/leads/${id}`);
      setForm(leadToFormState(lead));
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
    if (!id || !form.name.trim()) return;
    if (!formHasContact(form)) {
      Alert.alert('Contact', 'At least one phone or email is required.');
      return;
    }
    setSaving(true);
    try {
      await api(`/leads/${id}`, {
        method: 'PATCH',
        body: {
          ...buildLeadPayload(form),
          company: form.company.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          googleMapsUrl: form.googleMapsUrl.trim() || null,
          source: form.source.trim() || null,
          priority: form.priority as LeadPriority | null,
          tags: form.tags,
          extraPhones: buildLeadPayload(form).extraPhones,
          extraEmails: buildLeadPayload(form).extraEmails,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={form.name}
        onChangeText={(name) => patch({ name })}
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Company</Text>
      <TextInput
        style={styles.input}
        value={form.company}
        onChangeText={(company) => patch({ company })}
        placeholderTextColor="#64748b"
      />

      <ContactFields
        phone={form.phone}
        email={form.email}
        extraPhones={form.extraPhones}
        extraEmails={form.extraEmails}
        address={form.address}
        googleMapsUrl={form.googleMapsUrl}
        onPhoneChange={(phone) => patch({ phone })}
        onEmailChange={(email) => patch({ email })}
        onExtraPhonesChange={(extraPhones) => patch({ extraPhones })}
        onExtraEmailsChange={(extraEmails) => patch({ extraEmails })}
        onAddressChange={(address) => patch({ address })}
        onGoogleMapsUrlChange={(googleMapsUrl) => patch({ googleMapsUrl })}
      />

      <Text style={styles.label}>Source</Text>
      <TextInput
        style={styles.input}
        value={form.source}
        onChangeText={(source) => patch({ source })}
        placeholder="How did you meet them?"
        placeholderTextColor="#64748b"
      />
      <View style={styles.chipRow}>
        {SOURCE_PRESETS.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, form.source === s && styles.chipActive]}
            onPress={() => patch({ source: s })}
          >
            <Text style={[styles.chipText, form.source === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Tags</Text>
      <LeadTagsEditor
        tags={form.tags}
        suggestions={crmConfig?.leadTags ?? []}
        onChange={(tags) => patch({ tags })}
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, form.priority === null && styles.chipActive]}
          onPress={() => patch({ priority: null })}
        >
          <Text style={[styles.chipText, form.priority === null && styles.chipTextActive]}>None</Text>
        </Pressable>
        {LEAD_PRIORITIES.map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, form.priority === p && styles.chipActive]}
            onPress={() => patch({ priority: p })}
          >
            <Text style={[styles.chipText, form.priority === p && styles.chipTextActive]}>{p}</Text>
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
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 48 },
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
