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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { oneParam } from '../../lib/route-params';

type MetricLead = {
  id: string;
  name: string;
  company: string | null;
  stage: string;
};

type MetricTask = {
  id: string;
  title: string;
  dueAt: string | null;
  owner: { id: string; name: string };
  lead: { id: string; name: string; company: string | null; stage: string } | null;
};

const METRIC_TITLES: Record<string, string> = {
  open: 'Open leads',
  stale: 'Stale leads',
  won: 'Won leads',
  overdue: 'Overdue tasks',
};

export default function TeamMetricsScreen() {
  const params = useLocalSearchParams<{
    metric?: string | string[];
    teamId?: string | string[];
    title?: string | string[];
  }>();
  const metric = oneParam(params.metric) ?? 'open';
  const teamId = oneParam(params.teamId);
  const title = oneParam(params.title) ?? METRIC_TITLES[metric] ?? 'Records';

  const [leads, setLeads] = useState<MetricLead[]>([]);
  const [tasks, setTasks] = useState<MetricTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams();
        if (teamId) qs.set('teamId', teamId);
        const q = qs.toString();
        const res = await api<{ leads: MetricLead[]; tasks: MetricTask[] }>(
          `/teams/metrics/${metric}${q ? `?${q}` : ''}`,
        );
        setLeads(res.leads ?? []);
        setTasks(res.tasks ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLeads([]);
        setTasks([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [metric, teamId],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const isOverdue = metric === 'overdue';

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>{title}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList<MetricLead | MetricTask>
          data={(isOverdue ? tasks : leads) as (MetricLead | MetricTask)[]}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#38bdf8" />
          }
          ListEmptyComponent={
            !error ? <Text style={styles.empty}>No records for this metric.</Text> : null
          }
          renderItem={({ item }) => {
            if (isOverdue) {
              const t = item as MetricTask;
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => t.lead && router.push(`/lead/${t.lead.id}`)}
                >
                  <Text style={styles.name}>{t.title}</Text>
                  <Text style={styles.meta}>
                    {t.owner.name}
                    {t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}
                  </Text>
                  {t.lead ? <Text style={styles.lead}>{t.lead.name}</Text> : null}
                </Pressable>
              );
            }
            const l = item as MetricLead;
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/lead/${l.id}`)}>
                <Text style={styles.name}>{l.name}</Text>
                {l.company ? <Text style={styles.meta}>{l.company}</Text> : null}
                <Text style={styles.stage}>{l.stage}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', paddingTop: 8 },
  subtitle: { color: '#94a3b8', paddingHorizontal: 16, marginBottom: 8 },
  error: { color: '#f87171', paddingHorizontal: 16 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
  row: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  name: { color: '#f8fafc', fontWeight: '600', fontSize: 16 },
  meta: { color: '#64748b', fontSize: 13, marginTop: 4 },
  lead: { color: '#38bdf8', fontSize: 13, marginTop: 4 },
  stage: { color: '#38bdf8', fontSize: 12, marginTop: 6, fontWeight: '600' },
});
