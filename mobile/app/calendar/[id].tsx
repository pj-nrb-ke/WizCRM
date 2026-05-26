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
import * as Location from 'expo-location';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import {
  type CalendarEventRow,
  formatEventWhen,
  openMapsForEvent,
  parseLocalDatetimeInput,
  toLocalDatetimeInput,
} from '../../lib/calendar-utils';
import { openGoogleMaps } from '../../lib/maps-links';
import { oneParam } from '../../lib/route-params';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';

export default function CalendarEventScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = oneParam(params.id);
  const { user } = useAuth();
  const isManager = isManagerRole(user?.role);
  const [ev, setEv] = useState<CalendarEventRow | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [meetingAddress, setMeetingAddress] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { from, to } = (() => {
        const f = new Date();
        f.setDate(f.getDate() - 7);
        const t = new Date();
        t.setDate(t.getDate() + 30);
        return { from: f.toISOString(), to: t.toISOString() };
      })();
      const paramsQs = new URLSearchParams({ from, to });
      const data = await api<{ events: CalendarEventRow[] }>(`/calendar/events?${paramsQs}`);
      const found = (data.events ?? []).find((e) => e.id === id);
      if (!found) {
        setError('Event not found');
        setEv(null);
        return;
      }
      setEv(found);
      setTitle(found.title);
      setNotes(found.notes ?? '');
      setMeetingAddress(found.meetingAddress ?? '');
      setStartAt(toLocalDatetimeInput(found.startAt));
      setEndAt(toLocalDatetimeInput(found.endAt));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function save() {
    if (!id || !title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api(`/calendar/events/${id}`, {
        method: 'PATCH',
        body: {
          title: title.trim(),
          notes: notes.trim() || undefined,
          startAt: parseLocalDatetimeInput(startAt),
          endAt: parseLocalDatetimeInput(endAt),
          meetingAddress: meetingAddress.trim() || undefined,
        },
      });
      await load();
      Alert.alert('Saved', 'Event updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function getCoords() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }

  async function checkIn(override = false) {
    if (!id) return;
    setBusy(true);
    try {
      const coords = await getCoords();
      const res = await api<{ event: CalendarEventRow }>(`/calendar/events/${id}/check-in`, {
        method: 'POST',
        body: override ? { ...coords, geofenceOverride: true } : coords,
      });
      setEv(res.event);
      Alert.alert('Checked in', 'Visit started.');
    } catch (e) {
      const err = e as Error & { status?: number; data?: any };
      if (err.status === 409 && err.data?.code === 'GEOFENCE') {
        const distanceM = Number(err.data.distanceM ?? 0);
        const radiusM = Number(err.data.radiusM ?? 0);
        const msg = `You are ${Math.round(distanceM)}m from the meeting location (limit ${Math.round(radiusM)}m).`;
        if (isManager) {
          Alert.alert('Outside geofence', msg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Override check-in', style: 'destructive', onPress: () => void checkIn(true) },
          ]);
        } else {
          Alert.alert('Outside geofence', msg);
        }
      } else {
        Alert.alert('Check-in failed', e instanceof Error ? e.message : 'Error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    if (!id) return;
    setBusy(true);
    try {
      const coords = await getCoords();
      const res = await api<{ event: CalendarEventRow }>(`/calendar/events/${id}/check-out`, {
        method: 'POST',
        body: coords,
      });
      setEv(res.event);
      Alert.alert('Checked out', res.event.attendanceStatus ?? 'Visit recorded.');
    } catch (e) {
      Alert.alert('Check-out failed', e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!id) return;
    Alert.alert('Delete event?', title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void api(`/calendar/events/${id}`, { method: 'DELETE' })
            .then(() => router.back())
            .catch((e) => Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed'));
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  if (!ev) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'Event not found'}</Text>
      </View>
    );
  }

  const mapsUrl = openMapsForEvent(ev);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.when}>{formatEventWhen(ev)}</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Start (local)</Text>
      <TextInput style={styles.input} value={startAt} onChangeText={setStartAt} placeholder="YYYY-MM-DDTHH:mm" />

      <Text style={styles.label}>End (local)</Text>
      <TextInput style={styles.input} value={endAt} onChangeText={setEndAt} placeholder="YYYY-MM-DDTHH:mm" />

      <Text style={styles.label}>Meeting address</Text>
      <TextInput
        style={styles.input}
        value={meetingAddress}
        onChangeText={setMeetingAddress}
        placeholder="Street, city"
      />
      {mapsUrl ? (
        <Pressable style={styles.mapsBtn} onPress={() => void openGoogleMaps(mapsUrl)}>
          <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
        </Pressable>
      ) : null}

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
      />

      <View style={styles.attendanceBox}>
        <Text style={styles.section}>Field attendance</Text>
        <Text style={styles.attMeta}>
          {ev.checkInAt
            ? `In: ${new Date(ev.checkInAt).toLocaleString()}`
            : 'Not checked in'}
        </Text>
        {ev.checkOutAt ? (
          <Text style={styles.attMeta}>
            Out: {new Date(ev.checkOutAt).toLocaleString()}
            {ev.attendanceStatus ? ` · ${ev.attendanceStatus}` : ''}
          </Text>
        ) : null}
        <View style={styles.row}>
          {!ev.checkInAt ? (
            <Pressable style={styles.primaryBtn} disabled={busy} onPress={() => void checkIn()}>
              <Text style={styles.primaryBtnText}>{busy ? '…' : 'Check in'}</Text>
            </Pressable>
          ) : !ev.checkOutAt ? (
            <Pressable style={styles.secondaryBtn} disabled={busy} onPress={() => void checkOut()}>
              <Text style={styles.secondaryBtnText}>{busy ? '…' : 'Check out'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {ev.lead ? (
        <Pressable
          style={styles.linkLead}
          onPress={() => router.push({ pathname: '/lead/[id]', params: { id: ev.lead!.id } })}
        >
          <Text style={styles.linkLeadText}>Open lead: {ev.lead.name}</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.primaryBtn} disabled={busy} onPress={() => void save()}>
        <Text style={styles.primaryBtnText}>{busy ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
      <Pressable style={styles.dangerBtn} disabled={busy} onPress={() => void remove()}>
        <Text style={styles.dangerBtnText}>Delete event</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 40 },
  when: { color: '#94a3b8', marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  section: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  attendanceBox: {
    marginTop: 20,
    padding: 14,
    backgroundColor: '#172033',
    borderRadius: 10,
  },
  attMeta: { color: '#94a3b8', marginTop: 6, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  mapsBtn: { marginTop: 8, alignSelf: 'flex-start' },
  mapsBtnText: { color: '#38bdf8', fontWeight: '600' },
  linkLead: { marginTop: 16, marginBottom: 8 },
  linkLeadText: { color: '#38bdf8', fontWeight: '600' },
  primaryBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#0f172a', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 8,
    padding: 14,
    flex: 1,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#38bdf8', fontWeight: '600' },
  dangerBtn: {
    marginTop: 12,
    padding: 14,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  dangerBtnText: { color: '#f87171', fontWeight: '600' },
  error: { color: '#f87171', marginBottom: 12 },
});
