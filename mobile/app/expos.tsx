import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import {
  EXPO_RECOMMENDATION_LABELS,
  EXPO_TIERS,
  EXPO_TIER_LABELS,
  type ExpoRecommendation,
  type ExpoTier,
} from '@wizcrm/shared';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { isManagerRole } from '../lib/roles';

type Expo = {
  id: string;
  name: string;
  tier: ExpoTier;
  brief: string | null;
  positioning: string | null;
  recommendation: ExpoRecommendation | null;
  recommendationReason: string | null;
  startDate: string | null;
  endDate: string | null;
  dateText: string | null;
  city: string | null;
  country: string | null;
  venue: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  sourceTitle: string | null;
  confidence: number;
  calendarEventId: string | null;
  dismissedAt: string | null;
  visitorFee: string | null;
  boothFee: string | null;
  participationFee: string | null;
};

const REC_COLOR: Record<ExpoRecommendation, string> = {
  BOOTH: '#22c55e',
  PARTICIPANT: '#38bdf8',
  SKIP: '#94a3b8',
};

function isKenya(e: Pick<Expo, 'country' | 'tier'>): boolean {
  const c = e.country?.trim().toLowerCase();
  if (c) return c === 'kenya';
  return e.tier === 'LOCAL_KENYA';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function whenLabel(e: Expo): string {
  if (e.startDate && e.endDate && e.startDate !== e.endDate) {
    return `${fmtDate(e.startDate)} – ${fmtDate(e.endDate)}`;
  }
  if (e.startDate) return fmtDate(e.startDate);
  if (e.dateText) return `${e.dateText} (not confirmed)`;
  return 'Date not confirmed';
}

function whereLabel(e: Expo): string {
  return [e.venue, e.city, e.country].filter(Boolean).join(', ') || 'Location not stated';
}

export default function ExposScreen() {
  const { user } = useAuth();
  const isManager = isManagerRole(user?.role);

  const [expos, setExpos] = useState<Expo[]>([]);
  const [tier, setTier] = useState<ExpoTier | 'ALL'>('ALL');
  const [countryFilter, setCountryFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState('');

  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualTier, setManualTier] = useState<ExpoTier>('LOCAL_KENYA');
  const [manualSaving, setManualSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams();
      if (tier !== 'ALL') params.set('tier', tier);
      const data = await api<{ expos: Expo[] }>(`/expos?${params}`);
      setExpos(data.expos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expos');
    }
  }, [tier]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const e of expos) if (e.country?.trim()) set.add(e.country.trim());
    return Array.from(set).sort();
  }, [expos]);

  const visible = useMemo(
    () => (countryFilter === 'ALL' ? expos : expos.filter((e) => e.country?.trim() === countryFilter)),
    [expos, countryFilter],
  );
  const kenyaExpos = useMemo(() => visible.filter(isKenya), [visible]);
  const intlExpos = useMemo(() => visible.filter((e) => !isKenya(e)), [visible]);

  async function discover() {
    setDiscovering(true);
    setError('');
    try {
      const body = tier === 'ALL' ? {} : { tier };
      const { summary } = await api<{ summary: { found: number; added: number; updated: number } }>(
        '/expos/discover',
        { method: 'POST', body },
      );
      Alert.alert(
        'Search complete',
        summary.found === 0
          ? 'No upcoming expos found this time.'
          : `Found ${summary.found} — ${summary.added} new, ${summary.updated} refreshed.`,
      );
      void load();
    } catch (e) {
      Alert.alert('Search failed', e instanceof Error ? e.message : 'Try again');
    } finally {
      setDiscovering(false);
    }
  }

  async function addToCalendar(e: Expo) {
    if (!e.startDate) {
      Alert.alert('No confirmed date', 'This expo has no confirmed date yet, so it cannot be scheduled.');
      return;
    }
    try {
      const res = await api<{ alreadyOnCalendar: boolean }>(`/expos/${e.id}/add-to-calendar`, {
        method: 'POST',
        body: {},
      });
      Alert.alert(res.alreadyOnCalendar ? 'Already on the calendar' : 'Added', `${e.name}`);
      void load();
    } catch (err) {
      Alert.alert('Could not add', err instanceof Error ? err.message : 'Try again');
    }
  }

  async function toggleDismiss(e: Expo) {
    try {
      await api(`/expos/${e.id}/dismiss`, { method: 'POST' });
      void load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update');
    }
  }

  async function submitManual() {
    if (manualText.trim().length < 20) {
      Alert.alert('Add more detail', 'Paste at least a couple of sentences with the event name and date.');
      return;
    }
    setManualSaving(true);
    try {
      const res = await api<{ name: string; wasUpdate: boolean }>('/expos/manual-add', {
        method: 'POST',
        body: { text: manualText.trim(), tier: manualTier },
      });
      setManualOpen(false);
      setManualText('');
      Alert.alert(res.wasUpdate ? 'Updated' : 'Added', res.name);
      void load();
    } catch (e) {
      Alert.alert('Could not add this expo', e instanceof Error ? e.message : 'Try again');
    } finally {
      setManualSaving(false);
    }
  }

  function renderCard(e: Expo) {
    const fees = [
      e.visitorFee ? `Visitor fee: ${e.visitorFee}` : null,
      e.boothFee ? `Stall/booth fee: ${e.boothFee}` : null,
      e.participationFee ? `Participation fee: ${e.participationFee}` : null,
    ].filter((f): f is string => !!f);

    return (
      <View key={e.id} style={[styles.card, e.dismissedAt ? { opacity: 0.55 } : null]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{e.name}</Text>
          {e.recommendation ? (
            <Text style={[styles.recBadge, { color: REC_COLOR[e.recommendation], borderColor: REC_COLOR[e.recommendation] }]}>
              {EXPO_RECOMMENDATION_LABELS[e.recommendation]}
            </Text>
          ) : null}
        </View>
        <Text style={styles.cardMeta}>
          {whenLabel(e)} · {whereLabel(e)}
          {e.calendarEventId ? ' · ✓ on calendar' : ''}
        </Text>
        {e.brief ? <Text style={styles.cardBody}>{e.brief}</Text> : null}
        {e.positioning ? <Text style={styles.cardBody}>How we position: {e.positioning}</Text> : null}
        {fees.length ? <Text style={styles.feeText}>{fees.join(' · ')}</Text> : null}
        <View style={styles.cardActions}>
          <Pressable
            style={[styles.actionBtn, styles.primaryBtn, e.calendarEventId ? styles.disabledBtn : null]}
            disabled={!!e.calendarEventId}
            onPress={() => void addToCalendar(e)}
          >
            <Text style={styles.primaryBtnText}>{e.calendarEventId ? 'On calendar' : 'Add to calendar'}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.secondaryBtn]} onPress={() => void toggleDismiss(e)}>
            <Text style={styles.secondaryBtnText}>{e.dismissedAt ? 'Restore' : 'Not interested'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Expo finder' }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#38bdf8" />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isManager ? (
          <View style={styles.headerActions}>
            <Pressable style={[styles.actionBtn, styles.secondaryBtn]} onPress={() => setManualOpen(true)}>
              <Text style={styles.secondaryBtnText}>+ Add manually</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.primaryBtn]}
              disabled={discovering}
              onPress={() => void discover()}
            >
              <Text style={styles.primaryBtnText}>{discovering ? 'Searching…' : 'Find expos'}</Text>
            </Pressable>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
          <Pressable
            style={[styles.pill, tier === 'ALL' ? styles.pillActive : null]}
            onPress={() => setTier('ALL')}
          >
            <Text style={[styles.pillText, tier === 'ALL' ? styles.pillTextActive : null]}>All regions</Text>
          </Pressable>
          {EXPO_TIERS.map((t) => (
            <Pressable key={t} style={[styles.pill, tier === t ? styles.pillActive : null]} onPress={() => setTier(t)}>
              <Text style={[styles.pillText, tier === t ? styles.pillTextActive : null]}>{EXPO_TIER_LABELS[t]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {countries.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
            <Pressable
              style={[styles.pill, countryFilter === 'ALL' ? styles.pillActive : null]}
              onPress={() => setCountryFilter('ALL')}
            >
              <Text style={[styles.pillText, countryFilter === 'ALL' ? styles.pillTextActive : null]}>
                All countries
              </Text>
            </Pressable>
            {countries.map((c) => (
              <Pressable
                key={c}
                style={[styles.pill, countryFilter === c ? styles.pillActive : null]}
                onPress={() => setCountryFilter(c)}
              >
                <Text style={[styles.pillText, countryFilter === c ? styles.pillTextActive : null]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {loading && expos.length === 0 ? <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} /> : null}

        {!loading && visible.length === 0 ? (
          <Text style={styles.muted}>
            {isManager ? 'Tap "Find expos" to search, or add one manually.' : 'Ask a manager to run the expo search.'}
          </Text>
        ) : null}

        {kenyaExpos.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>🇰🇪 Kenya</Text>
            {kenyaExpos.map(renderCard)}
          </>
        ) : null}
        {intlExpos.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>🌍 International</Text>
            {intlExpos.map(renderCard)}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={manualOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Add an expo manually</Text>
            <Text style={styles.muted}>Paste the flyer text or event description — AI extracts the details.</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
              {EXPO_TIERS.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.pill, manualTier === t ? styles.pillActive : null]}
                  onPress={() => setManualTier(t)}
                >
                  <Text style={[styles.pillText, manualTier === t ? styles.pillTextActive : null]}>
                    {EXPO_TIER_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={8}
              value={manualText}
              onChangeText={setManualText}
              placeholder="Paste the flyer text or event description here…"
              placeholderTextColor="#64748b"
            />
            <View style={styles.cardActions}>
              <Pressable
                style={[styles.actionBtn, styles.secondaryBtn]}
                onPress={() => setManualOpen(false)}
                disabled={manualSaving}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={() => void submitManual()}
                disabled={manualSaving}
              >
                <Text style={styles.primaryBtnText}>{manualSaving ? 'Reading…' : 'Add expo'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },
  error: { color: '#f87171', marginBottom: 12 },
  muted: { color: '#94a3b8', marginTop: 16, marginBottom: 8 },
  headerActions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pillRow: { marginBottom: 10 },
  pill: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  pillActive: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
  pillText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#0f172a' },
  sectionTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginTop: 12, marginBottom: 8 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16, flex: 1 },
  recBadge: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  cardMeta: { color: '#94a3b8', fontSize: 13, marginTop: 4, marginBottom: 6 },
  cardBody: { color: '#e2e8f0', fontSize: 13, marginBottom: 6 },
  feeText: { color: '#facc15', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, flex: 1, alignItems: 'center' },
  primaryBtn: { backgroundColor: '#38bdf8' },
  primaryBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
  secondaryBtn: { borderWidth: 1, borderColor: '#38bdf8' },
  secondaryBtnText: { color: '#38bdf8', fontWeight: '600', fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.85)', justifyContent: 'flex-end' },
  modalPanel: { backgroundColor: '#0f172a', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  modalTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 18, marginBottom: 4 },
  textArea: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    minHeight: 140,
    textAlignVertical: 'top',
  },
});
