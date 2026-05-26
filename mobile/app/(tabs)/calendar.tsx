import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import {
  type CalendarEventRow,
  formatEventWhen,
  listRangeDays,
} from '../../lib/calendar-utils';

type Section = { title: string; data: CalendarEventRow[] };

export default function CalendarScreen() {
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const { from, to } = listRangeDays(14);
      const params = new URLSearchParams({ from, to, view: 'week' });
      const data = await api<{ events: CalendarEventRow[] }>(`/calendar/events?${params}`);
      setEvents((data.events ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar');
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const sections = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    for (const ev of events) {
      const key = new Date(ev.startAt).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
  }, [events]);

  const flatData = useMemo(
    () =>
      sections.flatMap((s) => [
        { type: 'header' as const, title: s.title },
        ...s.data.map((ev) => ({ type: 'event' as const, ev })),
      ]),
    [sections],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My calendar</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/calendar/new')}>
          <Text style={styles.addBtnText}>+ Event</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && events.length === 0 ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, i) =>
            item.type === 'header' ? `h-${item.title}` : `e-${item.ev.id}-${i}`
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#38bdf8" />
          }
          ListEmptyComponent={
            !error ? (
              <Text style={styles.empty}>No events in the next 14 days. Tap + Event to schedule.</Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={styles.dayHead}>{item.title}</Text>;
            }
            const ev = item.ev;
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push({ pathname: '/calendar/[id]', params: { id: ev.id } })}
              >
                <Text style={styles.cardTitle}>{ev.title}</Text>
                <Text style={styles.cardMeta}>{formatEventWhen(ev)}</Text>
                {ev.lead ? (
                  <Text style={styles.cardLead}>
                    {ev.lead.name}
                    {ev.lead.company ? ` · ${ev.lead.company}` : ''}
                  </Text>
                ) : null}
                {ev.checkInAt && !ev.checkOutAt ? (
                  <Text style={styles.checkedIn}>Checked in</Text>
                ) : null}
                {ev.checkOutAt ? (
                  <Text style={styles.checkedOut}>
                    Visit complete{ev.attendanceStatus ? ` · ${ev.attendanceStatus}` : ''}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  addBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#0f172a', fontWeight: '700' },
  error: { color: '#f87171', paddingHorizontal: 16, marginBottom: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  dayHead: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  cardTitle: { color: '#f8fafc', fontWeight: '600', fontSize: 16 },
  cardMeta: { color: '#64748b', fontSize: 13, marginTop: 4 },
  cardLead: { color: '#38bdf8', fontSize: 13, marginTop: 6 },
  checkedIn: { color: '#4ade80', fontSize: 12, marginTop: 6 },
  checkedOut: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
});
