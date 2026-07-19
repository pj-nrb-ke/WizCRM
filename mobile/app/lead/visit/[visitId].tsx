import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  captureDocument,
  captureVideo,
  capturePhoto,
  isAttachmentTooLarge,
  listAttachmentsForVisit,
  uploadAttachment,
  type LeadAttachmentMeta,
} from '../../../lib/attachments';
import { listVisits, type LeadVisit } from '../../../lib/lead-visits';

export default function VisitDetailScreen() {
  const { visitId, leadId, leadName, visitNumber } = useLocalSearchParams<{
    visitId: string;
    leadId: string;
    leadName?: string;
    visitNumber?: string;
  }>();

  const [visit, setVisit] = useState<LeadVisit | null>(null);
  const [attachments, setAttachments] = useState<LeadAttachmentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId || !visitId) return;
    setLoading(true);
    try {
      const [visits, files] = await Promise.all([
        listVisits(leadId),
        listAttachmentsForVisit(leadId, visitId),
      ]);
      setVisit(visits.find((v) => v.id === visitId) ?? null);
      setAttachments(files);
    } catch {
      // Best-effort — the screen still works for capturing new attachments even if this fails.
    } finally {
      setLoading(false);
    }
  }, [leadId, visitId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function capture(kind: 'photo-camera' | 'photo-gallery' | 'document' | 'video') {
    if (!leadId || !visitId) return;
    setBusy(kind);
    try {
      const file =
        kind === 'photo-camera'
          ? await capturePhoto('camera')
          : kind === 'photo-gallery'
            ? await capturePhoto('gallery')
            : kind === 'document'
              ? await captureDocument('camera')
              : await captureVideo();
      if (!file) return;
      if (isAttachmentTooLarge(file.dataBase64)) {
        Alert.alert('Too large', 'That file is over the 5MB limit — try a shorter clip or lower-res photo.');
        return;
      }
      await uploadAttachment(leadId, file, visitId);
      await load();
    } catch (e) {
      Alert.alert('Could not capture', e instanceof Error ? e.message : 'Try again');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Visit {visitNumber ?? visit?.visitNumber ?? ''}
          {leadName ? ` · ${leadName}` : ''}
        </Text>
        {visit ? (
          <Text style={styles.muted}>{new Date(visit.occurredAt).toLocaleString()}</Text>
        ) : null}
      </View>

      {visit?.hasReport ? (
        <View style={styles.reportBox}>
          <Text style={styles.reportLabel}>Reported</Text>
          {visit.outcome ? <Text style={styles.reportText}>{visit.outcome}</Text> : null}
          {visit.whoMet ? <Text style={styles.muted}>Met: {visit.whoMet}</Text> : null}
          {visit.nextStep ? <Text style={styles.muted}>Next: {visit.nextStep}</Text> : null}
        </View>
      ) : (
        <Pressable
          style={styles.fileReportBtn}
          onPress={() =>
            router.push({
              pathname: '/lead/visit-report',
              params: { leadId, leadName: leadName ?? '', visitId },
            })
          }
        >
          <Text style={styles.fileReportBtnText}>＋ File report for this visit</Text>
        </Pressable>
      )}

      <Text style={styles.section}>Capture</Text>
      <View style={styles.captureRow}>
        <Pressable style={styles.captureBtn} disabled={!!busy} onPress={() => void capture('photo-camera')}>
          <Text style={styles.captureBtnText}>{busy === 'photo-camera' ? '…' : '📷 Photo'}</Text>
        </Pressable>
        <Pressable style={styles.captureBtn} disabled={!!busy} onPress={() => void capture('document')}>
          <Text style={styles.captureBtnText}>{busy === 'document' ? '…' : '📄 Scan doc'}</Text>
        </Pressable>
        <Pressable style={styles.captureBtn} disabled={!!busy} onPress={() => void capture('video')}>
          <Text style={styles.captureBtnText}>{busy === 'video' ? '…' : '🎥 Video'}</Text>
        </Pressable>
        <Pressable style={styles.captureBtn} disabled={!!busy} onPress={() => void capture('photo-gallery')}>
          <Text style={styles.captureBtnText}>{busy === 'photo-gallery' ? '…' : '🖼 Gallery'}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Video clips are capped at ~12s to stay under the 5MB attachment limit.</Text>

      <Text style={styles.section}>
        Files {attachments.length > 0 ? `(${attachments.length})` : ''}
      </Text>
      {loading ? (
        <ActivityIndicator color="#38bdf8" />
      ) : attachments.length === 0 ? (
        <Text style={styles.muted}>Nothing captured for this visit yet.</Text>
      ) : (
        <FlatList
          data={attachments}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <View style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.fileName}
              </Text>
              <Text style={styles.muted}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { marginBottom: 12 },
  title: { color: '#f8fafc', fontWeight: '700', fontSize: 17 },
  muted: { color: '#64748b', fontSize: 13, marginTop: 2 },
  section: { color: '#94a3b8', fontWeight: '600', marginTop: 20, marginBottom: 8 },
  hint: { color: '#475569', fontSize: 11, marginTop: 6 },
  reportBox: {
    backgroundColor: '#172033',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  reportLabel: { color: '#38bdf8', fontWeight: '700', fontSize: 12, marginBottom: 6 },
  reportText: { color: '#f8fafc', fontSize: 14, marginBottom: 4 },
  fileReportBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  fileReportBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  captureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  captureBtn: {
    flexGrow: 1,
    minWidth: '45%',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  captureBtnText: { color: '#f8fafc', fontWeight: '600', fontSize: 14 },
  fileRow: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  fileName: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
});
