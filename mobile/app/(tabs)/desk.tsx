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

type DeskItem = { leadId: string; title: string; reason: string };

export default function DeskScreen() {
  const [items, setItems] = useState<DeskItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else if (items.length === 0) setInitialLoading(true);
    setError('');
    try {
      const data = await api<{ items: DeskItem[] }>('/ai/desk');
      setItems(data.items);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 503) {
        setError(
          'AI is not configured on the server yet (OPENAI_API_KEY). Use the Leads tab — everything else works.',
        );
      } else if (err.message === 'Network request failed') {
        setError('Cannot reach the API. Is start-api.ps1 running? (http://10.0.2.2:3000)');
      } else {
        setError(err.message || 'Failed to load desk');
      }
      setItems([]);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [items.length]);

  useRefreshOnFocus(useCallback(() => load(false), [load]));

  if (initialLoading && items.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Do today</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item, i) => `${item.leadId}-${i}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#38bdf8"
          />
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
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
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
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
});
