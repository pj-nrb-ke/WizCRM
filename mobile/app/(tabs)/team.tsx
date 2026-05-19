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
import { Redirect, router } from 'expo-router';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { api, type TeamsResponse } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';

function formatLastActivity(iso: string | null) {
  if (!iso) return 'No activity yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  return `Last activity ${days}d ago`;
}

function StatPill({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={[styles.pill, warn && value > 0 && styles.pillWarn]}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

export default function TeamScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<TeamsResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (!user || !isManagerRole(user.role)) return;
    if (isPull) setRefreshing(true);
    else setInitialLoading(true);
    setError('');
    try {
      const res = await api<TeamsResponse>('/teams');
      setData(res);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 403) {
        setError('Team view is for managers. Sign in as manager@wizag.local.');
      } else if (err.status === 404 || err.message.includes('Cannot GET')) {
        setError(
          'Teams API not found. Restart the API after updating (scripts\\start-api.ps1 -Restart).',
        );
      } else {
        setError(err.message === 'Network request failed' ? 'Cannot reach the API.' : err.message);
      }
      setData({ teams: [], unassigned: [] });
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useRefreshOnFocus(useCallback(() => load(false), [load]));

  if (!user || !isManagerRole(user.role)) {
    return <Redirect href="/(tabs)/desk" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Teams</Text>
        <Pressable style={styles.addBtn} onPress={() => router.push('/team/form')}>
          <Text style={styles.addBtnText}>+ Design team</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {initialLoading && !data ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={data?.teams ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              No teams yet. Tap “Design team” to create one and assign sales reps.
            </Text>
          }
          ListFooterComponent={
            data && data.unassigned.length > 0 ? (
              <View style={styles.unassigned}>
                <Text style={styles.unassignedTitle}>Unassigned reps</Text>
                {data.unassigned.map((u) => (
                  <Pressable
                    key={u.id}
                    style={styles.unassignedRow}
                    onPress={() =>
                      router.push(
                        `/(tabs)/leads?ownerId=${encodeURIComponent(u.id)}&title=${encodeURIComponent(u.name)}`,
                      )
                    }
                  >
                    <Text style={styles.memberName}>{u.name}</Text>
                    <Text style={styles.memberMeta}>
                      {u.stats.openLeads} open · {u.stats.overdueTasks} overdue
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/team/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={styles.teamName}>{item.name}</Text>
                <Text style={styles.memberCount}>
                  {item.memberCount} {item.memberCount === 1 ? 'rep' : 'reps'}
                </Text>
              </View>
              <Text style={styles.activity}>{formatLastActivity(item.stats.lastActivityAt)}</Text>
              <View style={styles.statsRow}>
                <StatPill label="Open" value={item.stats.openLeads} />
                <StatPill label="Overdue" value={item.stats.overdueTasks} warn />
                <StatPill label="Stale" value={item.stats.staleLeads} warn />
                <StatPill label="Won" value={item.stats.wonLeads} />
              </View>
            </Pressable>
          )}
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
  },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  addBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },
  error: { color: '#f87171', paddingHorizontal: 16, marginBottom: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
  memberCount: { color: '#94a3b8', fontSize: 13 },
  activity: { color: '#64748b', marginTop: 6, fontSize: 13 },
  statsRow: { flexDirection: 'row', marginTop: 12, flexWrap: 'wrap' },
  pill: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 72,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  pillWarn: { borderWidth: 1, borderColor: '#f59e0b' },
  pillValue: { color: '#f8fafc', fontWeight: '700', fontSize: 16 },
  pillLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  unassigned: {
    marginTop: 8,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#172033',
    borderRadius: 12,
    marginBottom: 24,
  },
  unassignedTitle: { color: '#94a3b8', fontWeight: '600', marginBottom: 8 },
  unassignedRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1e293b' },
  memberName: { color: '#e2e8f0', fontWeight: '600' },
  memberMeta: { color: '#64748b', fontSize: 13, marginTop: 2 },
});
