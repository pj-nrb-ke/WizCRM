import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { type CardImageAsset } from '../../lib/card-scan';
import {
  analyzePhotoCapture,
  assetBase64,
  extFromMimeType,
  pickCapturePhoto,
  pickCapturePhotoFromGallery,
  type PhotoCaptureCategory,
  type PhotoCaptureFields,
} from '../../lib/photo-capture';

type OrgUser = { id: string; name: string; role: string };

const CATEGORY_LABEL: Record<PhotoCaptureCategory, string> = {
  EXHIBITION_TENDER: 'Exhibition / Tender',
  BILLBOARD_SIGNBOARD: 'Billboard / Signboard',
};

function toLocalDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function PhotoCaptureScreen() {
  const [category, setCategory] = useState<PhotoCaptureCategory | null>(null);
  const [photo, setPhoto] = useState<CardImageAsset | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [fields, setFields] = useState<PhotoCaptureFields | null>(null);

  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [ownerId, setOwnerId] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [createEvent, setCreateEvent] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ users: OrgUser[] }>('/calendar/org-users')
      .then((d) => setOrgUsers((d.users ?? []).filter((u) => u.role === 'SALES' || u.role === 'MANAGER')))
      .catch(() => setOrgUsers([]));
  }, []);

  async function choosePhoto(pick: () => Promise<CardImageAsset | null>) {
    try {
      const asset = await pick();
      if (asset) {
        setPhoto(asset);
        setFields(null);
      }
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : 'Could not open camera or gallery');
    }
  }

  async function analyze() {
    if (!photo || !category) return;
    setAnalyzing(true);
    try {
      const result = await analyzePhotoCapture(photo, category);
      setFields(result);
    } catch (e) {
      Alert.alert('Could not analyze photo', e instanceof Error ? e.message : 'Try again');
    } finally {
      setAnalyzing(false);
    }
  }

  function patchFields(partial: Partial<PhotoCaptureFields>) {
    setFields((f) => (f ? { ...f, ...partial } : f));
  }

  function toggleAttendee(id: string) {
    setAttendeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createLead() {
    if (!fields) return;
    if (!fields.name.trim()) {
      Alert.alert('Name', 'Name is required.');
      return;
    }
    // Contact details are often absent on expo flyers/billboards — unlike a
    // regular lead, email/phone are optional here.
    if (!ownerId) {
      Alert.alert('Assign to', 'Choose who this lead should be assigned to.');
      return;
    }

    const start = toLocalDate(fields.eventStartDate);
    const wantsEvent =
      category === 'EXHIBITION_TENDER' && createEvent && start !== null;
    const end = toLocalDate(fields.eventEndDate) ?? start;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: fields.name.trim(),
        company: fields.company?.trim() || undefined,
        email: fields.email?.trim() || undefined,
        phone: fields.phone?.trim() || undefined,
        address: fields.address?.trim() || undefined,
        source: category === 'EXHIBITION_TENDER' ? 'Exhibition / Tender photo' : 'Billboard / Signboard photo',
        tags: [CATEGORY_LABEL[category!]],
        ownerId,
        pitchNote: fields.pitchNote,
      };
      if (wantsEvent && start) {
        body.event = {
          title: fields.eventName || fields.company || fields.name,
          startAt: start.toISOString(),
          endAt: (end ?? start).toISOString(),
          attendeeIds,
        };
      }
      // Keep the original photo attached to the lead for recall — the flyer
      // often has details (fine print, extra contacts) not worth transcribing.
      if (photo) {
        try {
          const { data, mimeType } = await assetBase64(photo);
          body.photo = {
            fileName: `capture.${extFromMimeType(mimeType)}`,
            mimeType,
            dataBase64: data,
          };
        } catch {
          // Non-fatal — the lead is still worth creating without the attachment.
        }
      }
      const res = await api<{ lead: { id: string }; calendarError?: string; attachmentError?: string }>(
        '/leads/photo-capture',
        { method: 'POST', body },
      );
      if (res.calendarError || res.attachmentError) {
        const parts = [
          res.calendarError ? `calendar event: ${res.calendarError}` : null,
          res.attachmentError ? `original photo: ${res.attachmentError}` : null,
        ].filter(Boolean);
        Alert.alert('Lead created', `Lead saved, but this had an issue — ${parts.join('; ')}.`);
      }
      router.replace(`/lead/${res.lead.id}`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Capture from photo</Text>
      <Text style={styles.hint}>
        Snap an exhibition flyer, tender notice, billboard, or signboard — AI reads it and drafts a lead.
      </Text>

      <Text style={styles.label}>What is this?</Text>
      <View style={styles.chips}>
        {(Object.keys(CATEGORY_LABEL) as PhotoCaptureCategory[]).map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => {
              setCategory(c);
              setFields(null);
            }}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{CATEGORY_LABEL[c]}</Text>
          </Pressable>
        ))}
      </View>

      {category ? (
        <>
          <Pressable style={styles.scanBtn} onPress={() => choosePhoto(pickCapturePhoto)}>
            <Text style={styles.scanBtnText}>Take photo</Text>
          </Pressable>
          <Pressable style={styles.scanBtn} onPress={() => choosePhoto(pickCapturePhotoFromGallery)}>
            <Text style={styles.scanBtnText}>Choose from gallery</Text>
          </Pressable>
        </>
      ) : null}

      {photo ? (
        <>
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" />
          <Pressable style={styles.analyzeBtn} onPress={analyze} disabled={analyzing}>
            {analyzing ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={styles.analyzeBtnText}>Analyze photo</Text>
            )}
          </Pressable>
        </>
      ) : null}

      {fields ? (
        <View style={styles.reviewBlock}>
          <Text style={styles.reviewTitle}>Review before saving</Text>

          {fields.participationFee ? (
            <View style={styles.feeBanner}>
              <Text style={styles.feeBannerLabel}>⚠️ Participation fee found</Text>
              <TextInput
                style={styles.feeBannerInput}
                value={fields.participationFee}
                onChangeText={(participationFee) => patchFields({ participationFee })}
              />
            </View>
          ) : null}

          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} value={fields.name} onChangeText={(name) => patchFields({ name })} />

          <Text style={styles.label}>Company</Text>
          <TextInput
            style={styles.input}
            value={fields.company ?? ''}
            onChangeText={(company) => patchFields({ company })}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={fields.email ?? ''}
            onChangeText={(email) => patchFields({ email })}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={fields.phone ?? ''}
            onChangeText={(phone) => patchFields({ phone })}
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={fields.address ?? ''}
            onChangeText={(address) => patchFields({ address })}
          />

          {category === 'EXHIBITION_TENDER' ? (
            <>
              <Text style={styles.label}>Event name</Text>
              <TextInput
                style={styles.input}
                value={fields.eventName ?? ''}
                onChangeText={(eventName) => patchFields({ eventName })}
              />
              <Text style={styles.label}>Venue</Text>
              <TextInput
                style={styles.input}
                value={fields.venue ?? ''}
                onChangeText={(venue) => patchFields({ venue })}
              />
              <Text style={styles.label}>Dates (as read from photo)</Text>
              <Text style={styles.dateReadout}>
                {fields.eventStartDate ?? '—'} {fields.eventEndDate ? `→ ${fields.eventEndDate}` : ''}
              </Text>
              {fields.eventStartDate ? (
                <Pressable
                  style={styles.toggleRow}
                  onPress={() => setCreateEvent((v) => !v)}
                >
                  <View style={[styles.checkbox, createEvent && styles.checkboxOn]} />
                  <Text style={styles.toggleText}>Add to calendar</Text>
                </Pressable>
              ) : (
                <Text style={styles.hint}>No dates found on the photo — edit the event name/venue then add manually in Calendar if needed.</Text>
              )}
            </>
          ) : null}

          <Text style={styles.label}>AI pitch note</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={fields.pitchNote}
            onChangeText={(pitchNote) => patchFields({ pitchNote })}
            multiline
          />

          <Text style={styles.label}>Assign to *</Text>
          <View style={styles.chips}>
            {orgUsers.map((u) => (
              <Pressable
                key={u.id}
                style={[styles.chip, ownerId === u.id && styles.chipActive]}
                onPress={() => setOwnerId(u.id)}
              >
                <Text style={[styles.chipText, ownerId === u.id && styles.chipTextActive]}>{u.name}</Text>
              </Pressable>
            ))}
          </View>

          {category === 'EXHIBITION_TENDER' && createEvent && fields.eventStartDate ? (
            <>
              <Text style={styles.label}>Also invite to calendar event</Text>
              <View style={styles.chips}>
                {orgUsers
                  .filter((u) => u.id !== ownerId)
                  .map((u) => (
                    <Pressable
                      key={u.id}
                      style={[styles.chip, attendeeIds.includes(u.id) && styles.chipActive]}
                      onPress={() => toggleAttendee(u.id)}
                    >
                      <Text style={[styles.chipText, attendeeIds.includes(u.id) && styles.chipTextActive]}>
                        {u.name}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            </>
          ) : null}

          <Pressable style={styles.saveBtn} onPress={createLead} disabled={saving}>
            {saving ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveBtnText}>Create lead</Text>}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 48 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  hint: { color: '#94a3b8', fontSize: 13, marginTop: 4, marginBottom: 12, lineHeight: 18 },
  label: { color: '#94a3b8', marginBottom: 6, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#f8fafc', fontSize: 13 },
  chipTextActive: { color: '#0f172a', fontWeight: '700' },
  scanBtn: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  scanBtnText: { color: '#38bdf8', fontWeight: '600' },
  preview: {
    width: '100%',
    height: 220,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginTop: 16,
  },
  analyzeBtn: {
    backgroundColor: '#38bdf8',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  analyzeBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  reviewBlock: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 16 },
  reviewTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  feeBanner: {
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  feeBannerLabel: { color: '#fbbf24', fontWeight: '700', fontSize: 13, marginBottom: 6 },
  feeBannerInput: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  dateReadout: { color: '#e2e8f0', fontSize: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#64748b' },
  checkboxOn: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
  toggleText: { color: '#f8fafc' },
  saveBtn: {
    backgroundColor: '#38bdf8',
    marginTop: 24,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
});
