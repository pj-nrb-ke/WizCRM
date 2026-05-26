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

type ActivityItem = {
  id: string;
  kind: 'activity' | 'calendar';
  at: string;
  user: { id: string; name: string };
  lead: { id: string; name: string; company: string | null } | null;
  summary: string;
  detail: string | null;
  activityType?: string;
};

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeamActivityScreen() {
  const [rangeDays, setRangeDays] = useState(14);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const dateFrom = useMemo(() => daysAgoIso(rangeDays), [rangeDays]);
  const dateTo = useMemo(() => todayIso(), []);

  const load = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ dateFrom, dateTo });
        const data = await api<{ items: ActivityItem[] }>(`/teams/activity-feed?${params}`);
        setItems(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load activity');
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFrom, dateTo],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {[7, 14, 30].map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, rangeDays === d && styles.chipActive]}
            onPress={() => setRangeDays(d)}
          >
            <Text style={[styles.chipText, rangeDays === d && styles.chipTextActive]}>{d}d</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && items.length === 0 ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#38bdf8" />
          }
          ListEmptyComponent={
            !error ? <Text style={styles.empty}>No team activity in this period.</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => item.lead && router.push(`/lead/${item.lead.id}`)}
              disabled={!item.lead}
            >
              <Text style={styles.summary}>{item.summary}</Text>
              <Text style={styles.meta}>
                {item.user.name} · {new Date(item.at).toLocaleString()}
              </Text>
              {item.lead ? (
                <Text style={styles.lead}>
                  {item.lead.name}
                  {item.lead.company ? ` · ${item.lead.company}` : ''}
                </Text>
              ) : null}
              {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  filters: { flexDirection: 'row', padding: 16, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  chipActive: { backgroundColor: '#38bdf8' },
  chipText: { color: '#94a3b8', fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  error: { color: '#f87171', paddingHorizontal: 16 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  row: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  summary: { color: '#f8fafc', fontWeight: '600', fontSize: 15 },
  meta: { color: '#64748b', fontSize: 12, marginTop: 4 },
  lead: { color: '#38bdf8', fontSize: 13, marginTop: 6 },
  detail: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
});
