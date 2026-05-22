import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { LEAD_PRIORITIES, type LeadPriority } from '../../constants/priorities';
import { ContactFields } from '../../components/ContactFields';
import { buildLeadPayload, formHasContact, type LeadFormState } from '../../lib/lead-form';
import {
  type CardImageAsset,
  pickBusinessCardFromGallery,
  pickBusinessCardImage,
  scanBusinessCardAsset,
} from '../../lib/card-scan';
import { buildGoogleMapsSearchUrl } from '../../lib/maps-links';

const emptyForm = (): LeadFormState => ({
  name: '',
  company: '',
  phone: '',
  email: '',
  extraPhones: [],
  extraEmails: [],
  address: '',
  googleMapsUrl: '',
  source: '',
  priority: null,
});

export default function NewLeadScreen() {
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  const patch = (partial: Partial<LeadFormState>) => setForm((f) => ({ ...f, ...partial }));

  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<CardImageAsset | null>(null);

  async function choosePhoto(pick: () => Promise<CardImageAsset | null>) {
    try {
      const asset = await pick();
      if (asset) setPendingPhoto(asset);
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : 'Could not open camera or gallery');
    }
  }

  function applyCardFields(fields: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    phone2?: string;
    email2?: string;
    address?: string;
  }) {
    if (fields.name) patch({ name: fields.name });
    if (fields.company) patch({ company: fields.company });
    if (fields.email) patch({ email: fields.email });
    if (fields.phone) patch({ phone: fields.phone });
    if (fields.phone2) {
      setForm((f) => ({ ...f, extraPhones: [...f.extraPhones, fields.phone2!] }));
    }
    if (fields.email2) {
      setForm((f) => ({ ...f, extraEmails: [...f.extraEmails, fields.email2!] }));
    }
    if (fields.address) {
      patch({
        address: fields.address,
        googleMapsUrl: buildGoogleMapsSearchUrl(fields.address) ?? '',
      });
    }
    const found = [
      fields.name,
      fields.company,
      fields.email,
      fields.phone,
      fields.phone2,
      fields.email2,
      fields.address,
    ].filter(Boolean).length;
    if (found === 0) {
      Alert.alert('No details found', 'Try another photo or enter details manually.');
    } else {
      Alert.alert('Card scanned', `Filled ${found} field(s). Review below, then tap Save lead.`);
    }
  }

  async function runScan() {
    if (!pendingPhoto) return;
    setScanning(true);
    try {
      const fields = await scanBusinessCardAsset(pendingPhoto);
      setPendingPhoto(null);
      applyCardFields(fields as Parameters<typeof applyCardFields>[0]);
    } catch (e) {
      Alert.alert('Scan failed', e instanceof Error ? e.message : 'Could not read card');
    } finally {
      setScanning(false);
    }
  }

  function closeCardPreview() {
    setPendingPhoto(null);
  }

  async function save(force = false) {
    if (!form.name.trim()) {
      Alert.alert('Name', 'Name is required.');
      return;
    }
    if (!formHasContact(form)) {
      Alert.alert('Contact', 'At least one phone or email is required.');
      return;
    }
    setSaving(true);
    try {
      const { lead } = await api<{ lead: { id: string } }>('/leads', {
        method: 'POST',
        body: { ...buildLeadPayload(form), force },
      });
      router.replace(`/lead/${lead.id}`);
    } catch (e) {
      const err = e as Error & { status?: number };
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Pressable
        style={styles.scanBtn}
        onPress={() => choosePhoto(pickBusinessCardImage)}
        disabled={scanning}
      >
        <Text style={styles.scanBtnText}>Take photo of card</Text>
      </Pressable>
      <Pressable
        style={styles.scanBtn}
        onPress={() => choosePhoto(pickBusinessCardFromGallery)}
        disabled={scanning}
      >
        <Text style={styles.scanBtnText}>Choose photo from gallery</Text>
      </Pressable>

      <Modal visible={pendingPhoto !== null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Business card photo</Text>
            <Text style={styles.modalHint}>
              Crop in the camera step if needed. Scan reads the card — it does not save the lead yet.
            </Text>
            {pendingPhoto ? (
              <Image source={{ uri: pendingPhoto.uri }} style={styles.preview} resizeMode="contain" />
            ) : null}
            <Pressable style={styles.scanPrimary} onPress={runScan} disabled={scanning}>
              {scanning ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.scanPrimaryText}>Scan card (read details)</Text>
              )}
            </Pressable>
            <Pressable style={styles.scanSecondary} onPress={closeCardPreview} disabled={scanning}>
              <Text style={styles.scanSecondaryText}>Done — fill in manually</Text>
            </Pressable>
            <Pressable style={styles.scanCancel} onPress={closeCardPreview} disabled={scanning}>
              <Text style={styles.scanCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
        placeholder="Referral, event, website…"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Priority</Text>
      <View style={styles.priorityRow}>
        {LEAD_PRIORITIES.map((p) => (
          <Pressable
            key={p}
            style={[styles.priorityChip, form.priority === p && styles.priorityChipActive]}
            onPress={() => patch({ priority: form.priority === p ? null : p })}
          >
            <Text
              style={[styles.priorityChipText, form.priority === p && styles.priorityChipTextActive]}
            >
              {p}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.hint}>At least one phone or email required</Text>

      <Pressable style={styles.button} onPress={() => save()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save lead'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 48 },
  scanBtn: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  scanBtnText: { color: '#38bdf8', fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16 },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  modalHint: { color: '#94a3b8', marginTop: 6, marginBottom: 12, lineHeight: 20 },
  preview: {
    width: '100%',
    height: 220,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 16,
  },
  scanPrimary: {
    backgroundColor: '#38bdf8',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  scanPrimaryText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  scanSecondary: {
    backgroundColor: '#334155',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  scanSecondaryText: { color: '#f8fafc', fontWeight: '600' },
  scanCancel: { padding: 12, alignItems: 'center' },
  scanCancelText: { color: '#94a3b8', fontWeight: '600' },
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  priorityRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  priorityChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  priorityChipActive: { backgroundColor: '#38bdf8' },
  priorityChipText: { color: '#f8fafc', fontSize: 12 },
  priorityChipTextActive: { color: '#0f172a', fontWeight: '700' },
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
