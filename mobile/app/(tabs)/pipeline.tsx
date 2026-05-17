import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { api, type Lead } from '../../lib/api';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];

export default function PipelineScreen() {
  const [pipeline, setPipeline] = useState<Record<string, Lead[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    setError('');
    try {
      const data = await api<{ pipeline: Record<string, Lead[]> }>('/leads/pipeline');
      setPipeline(data.pipeline);
    } catch (e) {
      const err = e as Error;
      setError(err.message === 'Network request failed' ? 'Cannot reach the API.' : err.message);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefreshOnFocus(useCallback(() => load(false), [load]));

  if (initialLoading && Object.keys(pipeline).length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#38bdf8" />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {STAGES.map((stage) => (
        <View key={stage} style={styles.column}>
          <Text style={styles.stageTitle}>{stage}</Text>
          {(pipeline[stage] ?? []).map((lead) => (
            <View key={lead.id} style={styles.card}>
              <Text style={styles.cardName}>{lead.name}</Text>
            </View>
          ))}
          {(pipeline[stage] ?? []).length === 0 ? <Text style={styles.empty}>—</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  column: { marginBottom: 20 },
  stageTitle: { color: '#38bdf8', fontWeight: '700', marginBottom: 8, fontSize: 14 },
  card: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  cardName: { color: '#f8fafc' },
  empty: { color: '#475569' },
  error: { color: '#f87171', marginBottom: 12 },
});
