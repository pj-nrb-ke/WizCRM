import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { PersonalDashboardMetrics } from '../lib/personal-dashboard';
import { KpiRow, type KpiItem } from './KpiRow';

type Props = {
  metrics: PersonalDashboardMetrics | null;
  loading: boolean;
  error?: string;
};

export function PersonalDashboardCard({ metrics, loading, error }: Props) {
  const items: KpiItem[] = metrics
    ? [
        {
          key: 'open',
          label: 'Open leads',
          value: metrics.openLeads,
          onPress: () => router.push('/(tabs)/leads'),
        },
        {
          key: 'tasks',
          label: 'Tasks due',
          value: metrics.tasksDue,
          warn: true,
          onPress: () => router.push('/(tabs)/leads'),
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
          onPress: () => router.push('/(tabs)/desk'),
        },
      ]
    : [];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>My dashboard</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !metrics ? (
        <ActivityIndicator color="#38bdf8" style={{ marginVertical: 12 }} />
      ) : metrics ? (
        <KpiRow items={items} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  error: { color: '#f87171', fontSize: 13, marginBottom: 8 },
});
