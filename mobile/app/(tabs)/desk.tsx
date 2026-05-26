import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { buildPersonalMetrics, type PersonalDashboardMetrics } from '../../lib/personal-dashboard';
import { PersonalDashboardCard } from '../../components/PersonalDashboardCard';
import { LicenseBanner } from '../../components/LicenseBanner';
import { rescheduleLocalReminders } from '../../lib/notifications';

type DeskItem = { leadId: string; title: string; reason: string };

export default function DeskScreen() {
  const { user, entitlements } = useAuth();
  const [items, setItems] = useState<DeskItem[]>([]);
  const [personal, setPersonal] = useState<PersonalDashboardMetrics | null>(null);
  const [personalError, setPersonalError] = useState('');
  const [personalLoading, setPersonalLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadPersonal = useCallback(async () => {
    if (!user?.id) return;
    setPersonalLoading(true);
    setPersonalError('');
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const calendarQuery = new URLSearchParams({ from, to, view: 'week' });
    try {
      const [leadsRes, tasksRes, eventsRes, crmConfig] = await Promise.all([
        api<{ leads: { stage: string; updatedAt: string; lastActivityAt?: string | null }[] }>(
          `/leads?ownerId=${encodeURIComponent(user.id)}`,
        ),
        api<{
          tasks: {
            id: string;
            title: string;
            dueAt: string | null;
            completedAt?: string | null;
            lead?: { id: string; name: string } | null;
          }[];
        }>('/tasks'),
        api<{ events: { id: string; title: string; startAt: string }[] }>(`/calendar/events?${calendarQuery}`).catch(() => ({
          events: [],
        })),
        api<{ staleLeadDays?: number }>('/leads/crm-config').catch(() => ({ staleLeadDays: 7 })),
      ]);
      const staleDays =
        typeof crmConfig.staleLeadDays === 'number' ? crmConfig.staleLeadDays : 7;
      setPersonal(
        buildPersonalMetrics(
          leadsRes.leads ?? [],
          tasksRes.tasks ?? [],
          eventsRes.events ?? [],
          now,
          staleDays,
        ),
      );
      void rescheduleLocalReminders({
        tasks: tasksRes.tasks ?? [],
        events: eventsRes.events ?? [],
      });
    } catch (e) {
      setPersonalError(e instanceof Error ? e.message : 'Failed to load dashboard');
      setPersonal(null);
    } finally {
      setPersonalLoading(false);
    }
  }, [user?.id]);

  const load = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else if (items.length === 0) setInitialLoading(true);
      setError('');
      try {
        const [deskRes] = await Promise.all([
          api<{ items: DeskItem[] }>('/ai/desk'),
          loadPersonal(),
        ]);
        setItems(deskRes.items);
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 503) {
          setError(
            'AI is not configured on the server yet (OPENAI_API_KEY). Use the Leads tab — everything else works.',
          );
        } else if (err.message === 'Network request failed' || err.message.includes('Cannot reach')) {
          setError(
            err.message.includes('Cannot reach') ? err.message : 'Cannot reach the API. Check Settings → API URL.',
          );
        } else {
          setError(err.message || 'Failed to load desk');
        }
        setItems([]);
        if (!isPull) void loadPersonal();
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [items.length, loadPersonal],
  );

  useRefreshOnFocus(useCallback(() => load(false), [load]));

  if (initialLoading && items.length === 0 && !personal) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.leadId}-${i}`}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#38bdf8" />
        }
        ListHeaderComponent={
          <>
            <LicenseBanner entitlements={entitlements} />
            <PersonalDashboardCard metrics={personal} loading={personalLoading} error={personalError} />
            <Text style={styles.heading}>Do today</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          !error ? (
            <Text style={styles.empty}>No priorities yet. Add leads to get AI suggestions.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/lead/${item.leadId}`)}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardReason}>{item.reason}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16, paddingBottom: 0 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  heading: { fontSize: 22, fontWeight: '700', color: '#f8fafc', marginBottom: 12 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  cardReason: { color: '#94a3b8', marginTop: 6, fontSize: 14 },
  error: { color: '#f87171', marginBottom: 8, lineHeight: 20 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24, marginBottom: 24 },
});
