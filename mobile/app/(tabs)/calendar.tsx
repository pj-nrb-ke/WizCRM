import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import {
  type CalendarEventRow,
  formatEventWhen,
  monthRange,
} from '../../lib/calendar-utils';
import { fetchReminders } from '../../lib/reminders';
import { rescheduleLocalReminders } from '../../lib/notifications';

type ViewMode = 'month' | 'week';

export default function CalendarScreen() {
  const now = new Date();
  const [view, setView] = useState<ViewMode>('month');
  const [selected, setSelected] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  );
  const [monthCursor, setMonthCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const { from, to } = monthRange(monthCursor.year, monthCursor.month);
      const params = new URLSearchParams({ from, to, view: 'month' });
      const [data, remindersRes, tasksRes] = await Promise.all([
        api<{ events: CalendarEventRow[] }>(`/calendar/events?${params}`),
        fetchReminders(from, to).catch(() => ({ reminders: [] })),
        api<{ tasks: { id: string; title: string; dueAt: string | null; completedAt?: string | null }[] }>('/tasks'),
      ]);
      const list = (data.events ?? []).sort((a, b) => a.startAt.localeCompare(b.startAt));
      setEvents(list);
      void rescheduleLocalReminders({
        tasks: tasksRes.tasks ?? [],
        events: list.map((e) => ({
          id: e.id,
          title: e.title,
          startAt: e.startAt,
          reminderMinutes: e.reminderMinutes,
        })),
        customReminders: remindersRes.reminders ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [monthCursor.year, monthCursor.month]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean }> = {};
    for (const ev of events) {
      const d = ev.startAt.slice(0, 10);
      marks[d] = { ...(marks[d] ?? {}), marked: true, dotColor: '#38bdf8' };
    }
    marks[selected] = { ...(marks[selected] ?? {}), selected: true, selectedColor: '#2563eb' };
    return marks;
  }, [events, selected]);

  const dayEvents = useMemo(
    () => events.filter((e) => e.startAt.startsWith(selected)),
    [events, selected],
  );

  const weekSections = useMemo(() => {
    const start = new Date(selected + 'T12:00:00');
    const sections: { date: string; label: string; events: CalendarEventRow[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      sections.push({
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        events: events.filter((e) => e.startAt.startsWith(key)),
      });
    }
    return sections;
  }, [events, selected]);

  function onMonthChange(m: { year: number; month: number }) {
    setMonthCursor({ year: m.year, month: m.month });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Calendar</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/calendar/new')}>
          <Text style={styles.addBtnText}>+ Event</Text>
        </Pressable>
      </View>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, view === 'month' && styles.toggleActive]}
          onPress={() => setView('month')}
        >
          <Text style={styles.toggleText}>Month</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, view === 'week' && styles.toggleActive]}
          onPress={() => setView('week')}
        >
          <Text style={styles.toggleText}>Week</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {view === 'month' ? (
        <ScrollView>
          <Calendar
            current={selected}
            onDayPress={(d) => setSelected(d.dateString)}
            onMonthChange={onMonthChange}
            markedDates={markedDates}
            theme={{
              calendarBackground: '#0f172a',
              monthTextColor: '#f8fafc',
              dayTextColor: '#e2e8f0',
              textDisabledColor: '#475569',
              selectedDayBackgroundColor: '#2563eb',
              selectedDayTextColor: '#fff',
              todayTextColor: '#38bdf8',
              arrowColor: '#38bdf8',
              dotColor: '#38bdf8',
            }}
          />
          <Text style={styles.dayHead}>
            {new Date(selected + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {loading ? <ActivityIndicator color="#38bdf8" style={{ marginVertical: 12 }} /> : null}
          {dayEvents.length === 0 && !loading ? (
            <Text style={styles.empty}>No events this day.</Text>
          ) : null}
          {dayEvents.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </ScrollView>
      ) : (
        <ScrollView>
          <Calendar
            current={selected}
            onDayPress={(d) => setSelected(d.dateString)}
            markedDates={markedDates}
            theme={{
              calendarBackground: '#0f172a',
              monthTextColor: '#f8fafc',
              dayTextColor: '#e2e8f0',
              todayTextColor: '#38bdf8',
              arrowColor: '#38bdf8',
            }}
          />
          {weekSections.map((s) => (
            <View key={s.date}>
              <Text style={styles.dayHead}>{s.label}</Text>
              {s.events.length === 0 ? (
                <Text style={styles.empty}>—</Text>
              ) : (
                s.events.map((ev) => <EventCard key={ev.id} ev={ev} />)
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function EventCard({ ev }: { ev: CalendarEventRow }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/calendar/[id]', params: { id: ev.id } })}
    >
      <Text style={styles.cardTitle}>{ev.title}</Text>
      <Text style={styles.cardMeta}>{formatEventWhen(ev)}</Text>
      {ev.tags && ev.tags.length > 0 ? (
        <Text style={styles.tags}>{ev.tags.join(' · ')}</Text>
      ) : null}
      {ev.lead ? (
        <Text style={styles.cardLead}>
          {ev.lead.name}
          {ev.lead.company ? ` · ${ev.lead.company}` : ''}
        </Text>
      ) : null}
    </Pressable>
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
  toggleRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  toggle: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
  },
  toggleActive: { backgroundColor: '#2563eb' },
  toggleText: { color: '#f8fafc', fontWeight: '600', fontSize: 13 },
  error: { color: '#f87171', paddingHorizontal: 16, marginBottom: 8 },
  dayHead: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  empty: { color: '#64748b', textAlign: 'center', marginVertical: 16, paddingHorizontal: 16 },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  cardTitle: { color: '#f8fafc', fontWeight: '600', fontSize: 16 },
  cardMeta: { color: '#64748b', fontSize: 13, marginTop: 4 },
  tags: { color: '#a78bfa', fontSize: 12, marginTop: 4 },
  cardLead: { color: '#38bdf8', fontSize: 13, marginTop: 6 },
});
