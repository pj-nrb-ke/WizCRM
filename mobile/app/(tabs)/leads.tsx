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
import { api, type Lead } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function LeadsScreen() {
  const { signOut } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else if (leads.length === 0) setInitialLoading(true);
    setError('');
    try {
      const data = await api<{ leads: Lead[] }>('/leads');
      setLeads(data.leads);
    } catch (e) {
      const err = e as Error;
      setError(
        err.message === 'Network request failed'
          ? 'Cannot reach the API. Start scripts\\start-api.ps1 first.'
          : err.message,
      );
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [leads.length]);

  useRefreshOnFocus(useCallback(() => load(false), [load]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.addBtn} onPress={() => router.push('/lead/new')}>
          <Text style={styles.addBtnText}>+ New lead</Text>
        </Pressable>
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {initialLoading && leads.length === 0 ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>No leads yet.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/lead/${item.id}`)}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.stage} · {item.company ?? item.phone ?? item.email ?? '—'}
              </Text>
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
  addBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: '#0f172a', fontWeight: '700' },
  signOut: { color: '#94a3b8' },
  error: { color: '#f87171', paddingHorizontal: 16, marginBottom: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  name: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  meta: { color: '#64748b', marginTop: 4 },
});
