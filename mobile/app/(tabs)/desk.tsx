import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';

type DeskItem = { leadId: string; title: string; reason: string };

export default function DeskScreen() {
  const [items, setItems] = useState<DeskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api<{ items: DeskItem[] }>('/ai/desk');
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load desk');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (loading && items.length === 0) {
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#38bdf8" />}
        ListEmptyComponent={<Text style={styles.empty}>No priorities yet. Add leads to get AI suggestions.</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/lead/${item.leadId}`)}
          >
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
  error: { color: '#f87171', marginBottom: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40 },
});
