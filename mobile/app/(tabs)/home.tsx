import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';
import { buildPersonalMetrics, type PersonalDashboardMetrics } from '../../lib/personal-dashboard';
import { KpiRow, type KpiItem } from '../../components/KpiRow';
import { MiniBarChart } from '../../components/MiniBarChart';
import { LicenseBanner } from '../../components/LicenseBanner';
import { fetchReminders } from '../../lib/reminders';
import { rescheduleLocalReminders } from '../../lib/notifications';

type MyPacing = {
  period: string;
  target: number;
  wonRevenue: number;
  pacingLabel: string;
};

type QuickLink = { title: string; subtitle: string; route: string };

export default function HomeScreen() {
  const { user, entitlements } = useAuth();
  const isManager = isManagerRole(user?.role);
  const proPacing = entitlements?.features.targetsPacing ?? false;

  const [metrics, setMetrics] = useState<PersonalDashboardMetrics | null>(null);
  const [pacing, setPacing] = useState<MyPacing | null>(null);
  const [pendingCommission, setPendingCommission] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    const now = new Date();
    const from = now.toISOString();
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const calendarQuery = new URLSearchParams({ from, to, view: 'week' });
    try {
      const [leadsRes, tasksRes, eventsRes, crmConfig, remindersRes, pacingRes] = await Promise.all([
        api<{ leads: { stage: string; updatedAt: string; lastActivityAt?: string | null }[] }>(
          `/leads?ownerId=${encodeURIComponent(user.id)}`,
        ),
        api<{
          tasks: {
            id: string;
            title: string;
            dueAt: string | null;
            completedAt?: string | null;
            lead?: { name?: string } | null;
          }[];
        }>('/tasks'),
        api<{ events: { id: string; title: string; startAt: string; reminderMinutes?: number | null }[] }>(
          `/calendar/events?${calendarQuery}`,
        ).catch(() => ({ events: [] })),
        api<{ staleLeadDays?: number }>('/leads/crm-config').catch(() => ({ staleLeadDays: 7 })),
        fetchReminders(from, to).catch(() => ({ reminders: [] })),
        proPacing ? api<MyPacing>('/reports/my-pacing').catch(() => null) : Promise.resolve(null),
      ]);
      const staleDays =
        typeof crmConfig.staleLeadDays === 'number' ? crmConfig.staleLeadDays : 7;
      setMetrics(
        buildPersonalMetrics(
          leadsRes.leads ?? [],
          tasksRes.tasks ?? [],
          eventsRes.events ?? [],
          now,
          staleDays,
        ),
      );
      setPacing(pacingRes);
      void rescheduleLocalReminders({
        tasks: tasksRes.tasks ?? [],
        events: eventsRes.events ?? [],
        customReminders: remindersRes.reminders ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load home');
      setMetrics(null);
    }
  }, [user?.id, proPacing]);

  useRefreshOnFocus(
    useCallback(() => {
      setLoading(true);
      return load().finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
    }, [load]),
  );

  useRefreshOnFocus(
    useCallback(() => {
      if (!user?.id) return Promise.resolve();
      return api<{ pendingCommission: number; hidden: boolean }>('/commission/my-pending')
        .then((d) => setPendingCommission(d.hidden ? null : d.pendingCommission))
        .catch(() => setPendingCommission(null));
    }, [user?.id]),
  );

  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';
  const kpiItems: KpiItem[] = metrics
    ? [
        { key: 'open', label: 'Open leads', value: metrics.openLeads, onPress: () => router.push('/(tabs)/leads') },
        {
          key: 'tasks',
          label: 'Tasks due',
          value: metrics.tasksDue,
          warn: true,
          onPress: () => router.push('/(tabs)/desk'),
        },
        {
          key: 'stale',
          label: 'Stale',
          value: metrics.staleLeads,
          warn: true,
          onPress: () => router.push('/(tabs)/leads'),
        },
        {
          key: 'events',
          label: 'Events (7d)',
          value: metrics.upcomingEvents,
          onPress: () => router.push('/(tabs)/calendar'),
        },
        ...(pendingCommission != null
          ? [{ key: 'commission', label: 'Pending commission', value: pendingCommission }]
          : []),
      ]
    : [];

  const quickLinks: QuickLink[] = [
    { title: 'Sales desk', subtitle: 'AI priorities for today', route: '/(tabs)/desk' },
    { title: 'My leads', subtitle: 'Search and open records', route: '/(tabs)/leads' },
    { title: 'Pipeline', subtitle: 'Stages and follow-ups', route: '/(tabs)/pipeline' },
    { title: 'Calendar', subtitle: 'Week & month schedule', route: '/(tabs)/calendar' },
    { title: 'Capture', subtitle: 'Photo → lead (exhibitions, billboards)', route: '/lead/photo-capture' },
    { title: 'Business card', subtitle: 'Scan a card → new lead', route: '/lead/new' },
    { title: 'Reminders', subtitle: 'Custom alerts', route: '/reminders' },
  ];
  if (isManager) {
    quickLinks.push(
      { title: 'Team', subtitle: 'Members and metrics', route: '/(tabs)/team' },
      { title: 'Reports', subtitle: 'Funnel and attendance', route: '/(tabs)/reports' },
      { title: 'Expo finder', subtitle: 'Trade shows worth attending', route: '/expos' },
    );
    if (proPacing) {
      quickLinks.push({
        title: 'Targets & pacing',
        subtitle: 'Monthly revenue goals',
        route: '/targets',
      });
    }
  } else if (proPacing) {
    quickLinks.push({
      title: 'My target',
      subtitle: 'Monthly pacing',
      route: '/targets',
    });
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          tintColor="#38bdf8"
        />
      }
    >
      <LicenseBanner entitlements={entitlements} />
      <Text style={styles.greeting}>Hello, {firstName}</Text>
      <Text style={styles.sub}>
        {user?.organizationName ? `${user.organizationName} · Your field command center` : 'Your field command center'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !metrics ? (
        <ActivityIndicator color="#38bdf8" style={{ marginVertical: 24 }} />
      ) : null}
      {metrics ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My metrics</Text>
          <KpiRow items={kpiItems} />
          <MiniBarChart
            title="Workload snapshot"
            bars={[
              { label: 'Open', value: metrics.openLeads, color: '#38bdf8' },
              { label: 'Due', value: metrics.tasksDue, color: '#fbbf24' },
              { label: 'Stale', value: metrics.staleLeads, color: '#f87171' },
              { label: 'Events', value: metrics.upcomingEvents, color: '#a78bfa' },
            ]}
          />
        </View>
      ) : null}
      {pacing && pacing.target > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>My target · {pacing.period}</Text>
          <Text style={styles.pacingLine}>
            {pacing.wonRevenue.toLocaleString()} / {pacing.target.toLocaleString()} — {pacing.pacingLabel}
          </Text>
        </View>
      ) : null}
      <Text style={styles.section}>Quick links</Text>
      <View style={styles.linkGrid}>
        {quickLinks.map((l) => (
          <Pressable key={l.route} style={styles.linkCard} onPress={() => router.push(l.route as never)}>
            <Text style={styles.linkTitle}>{l.title}</Text>
            <Text style={styles.linkSub}>{l.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  greeting: { color: '#f8fafc', fontSize: 26, fontWeight: '800' },
  sub: { color: '#94a3b8', marginBottom: 16, marginTop: 4 },
  error: { color: '#f87171', marginBottom: 12 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 10 },
  pacingLine: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  section: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 },
  linkCard: {
    width: '47%',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
  },
  linkTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  linkSub: { color: '#64748b', fontSize: 12, marginTop: 4 },
});
