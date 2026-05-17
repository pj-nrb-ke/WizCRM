import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api, type Lead } from '../../lib/api';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];

export default function PipelineScreen() {
  const [pipeline, setPipeline] = useState<Record<string, Lead[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api<{ pipeline: Record<string, Lead[]> }>('/leads/pipeline');
    setPipeline(data.pipeline);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#38bdf8" />}
    >
      {STAGES.map((stage) => (
        <View key={stage} style={styles.column}>
          <Text style={styles.stageTitle}>{stage}</Text>
          {(pipeline[stage] ?? []).map((lead) => (
            <View key={lead.id} style={styles.card}>
              <Text style={styles.cardName}>{lead.name}</Text>
            </View>
          ))}
          {(pipeline[stage] ?? []).length === 0 ? (
            <Text style={styles.empty}>—</Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 12 },
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
});
