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

import {

  type CardImageAsset,

  pickBusinessCardFromGallery,

  pickBusinessCardImage,

  scanBusinessCardAsset,

} from '../../lib/card-scan';



export default function NewLeadScreen() {

  const [name, setName] = useState('');

  const [company, setCompany] = useState('');

  const [email, setEmail] = useState('');

  const [phone, setPhone] = useState('');

  const [source, setSource] = useState('');

  const [priority, setPriority] = useState<LeadPriority | null>(null);

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

  }) {

    if (fields.name) setName(fields.name);

    if (fields.company) setCompany(fields.company);

    if (fields.email) setEmail(fields.email);

    if (fields.phone) setPhone(fields.phone);

    const found = [fields.name, fields.company, fields.email, fields.phone].filter(Boolean).length;

    if (found === 0) {

      Alert.alert(

        'No details found',

        'Crop the full card, tap Scan, or enter details manually.',

      );

    } else {

      Alert.alert('Card scanned', `Filled ${found} field(s). Check them, then tap Save lead.`);

    }

  }



  async function runScan() {

    if (!pendingPhoto) return;

    setScanning(true);

    try {

      const fields = await scanBusinessCardAsset(pendingPhoto);

      setPendingPhoto(null);

      applyCardFields(fields);

    } catch (e) {

      Alert.alert('Scan failed', e instanceof Error ? e.message : 'Could not read card');

    } finally {

      setScanning(false);

    }

  }



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

          source: source.trim() || undefined,

          priority: priority ?? undefined,

          force,

        },

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

    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

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

            <Text style={styles.modalTitle}>Business card</Text>

            <Text style={styles.modalHint}>
              Crop the card in the previous step if needed, then tap Scan to read it.
            </Text>

            {pendingPhoto ? (

              <Image source={{ uri: pendingPhoto.uri }} style={styles.preview} resizeMode="contain" />

            ) : null}

            <Pressable style={styles.scanPrimary} onPress={runScan} disabled={scanning}>

              {scanning ? (

                <ActivityIndicator color="#0f172a" />

              ) : (

                <Text style={styles.scanPrimaryText}>Scan</Text>

              )}

            </Pressable>

            <Pressable style={styles.scanCancel} onPress={() => setPendingPhoto(null)} disabled={scanning}>

              <Text style={styles.scanCancelText}>Cancel</Text>

            </Pressable>

          </View>

        </View>

      </Modal>



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

        placeholder="Referral, event, website…"

        placeholderTextColor="#64748b"

      />

      <Text style={styles.label}>Priority</Text>

      <View style={styles.priorityRow}>

        {LEAD_PRIORITIES.map((p) => (

          <Pressable

            key={p}

            style={[styles.priorityChip, priority === p && styles.priorityChipActive]}

            onPress={() => setPriority(priority === p ? null : p)}

          >

            <Text

              style={[

                styles.priorityChipText,

                priority === p && styles.priorityChipTextActive,

              ]}

            >

              {p}

            </Text>

          </Pressable>

        ))}

      </View>



      <Text style={styles.hint}>Phone or email required</Text>

      <Pressable style={styles.button} onPress={() => save()} disabled={saving}>

        <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save lead'}</Text>

      </Pressable>

    </ScrollView>

  );

}



const styles = StyleSheet.create({

  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },

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

  modalCard: {

    backgroundColor: '#1e293b',

    borderRadius: 12,

    padding: 16,

  },

  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },

  modalHint: { color: '#94a3b8', marginTop: 6, marginBottom: 12 },

  preview: {

    width: '100%',

    height: 220,

    backgroundColor: '#0f172a',

    borderRadius: 8,

    marginBottom: 16,

  },

  scanPrimary: {

    backgroundColor: '#38bdf8',

    padding: 16,

    borderRadius: 10,

    alignItems: 'center',

    marginBottom: 8,

  },

  scanPrimaryText: { color: '#0f172a', fontWeight: '700', fontSize: 17 },

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

  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },

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

  button: {

    backgroundColor: '#38bdf8',

    marginTop: 24,

    padding: 16,

    borderRadius: 10,

    alignItems: 'center',

  },

  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },

});


