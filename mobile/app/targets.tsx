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
import { Stack, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { isManagerRole } from '../lib/roles';

type PacingReport = {
  period: string;
  orgTarget: number;
  orgWonRevenue: number;
  orgPacingLabel: string;
  reps: {
    userId: string;
    name: string;
    target: number;
    wonRevenue: number;
    wonDeals: number;
    pacingLabel: string;
  }[];
};

type MyPacing = {
  period: string;
  target: number;
  wonRevenue: number;
  wonDeals: number;
  pacingLabel: string;
};

export default function TargetsScreen() {
  const { user, entitlements } = useAuth();
  const isManager = isManagerRole(user?.role);
  const pro = entitlements?.features.targetsPacing ?? false;

  const [org, setOrg] = useState<PacingReport | null>(null);
  const [mine, setMine] = useState<MyPacing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!pro) return;
    setError('');
    try {
      if (isManager) {
        const data = await api<PacingReport>('/reports/pacing');
        setOrg(data);
        setMine(null);
      } else {
        const data = await api<MyPacing>('/reports/my-pacing');
        setMine(data);
        setOrg(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load targets');
    }
  }, [pro, isManager]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  if (!pro) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Targets' }} />
        <Text style={styles.muted}>Targets & pacing require a Pro plan.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor="#38bdf8" />}
    >
      <Stack.Screen options={{ title: 'Targets & pacing' }} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !org && !mine ? <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} /> : null}
      {mine ? (
        <View style={styles.card}>
          <Text style={styles.period}>{mine.period}</Text>
          <Text style={styles.big}>{mine.wonRevenue.toLocaleString()}</Text>
          <Text style={styles.sub}>of {mine.target.toLocaleString()} target · {mine.wonDeals} deals</Text>
          <Text style={styles.badge}>{mine.pacingLabel}</Text>
        </View>
      ) : null}
      {org ? (
        <>
          <View style={styles.card}>
            <Text style={styles.period}>Org · {org.period}</Text>
            <Text style={styles.big}>{org.orgWonRevenue.toLocaleString()}</Text>
            <Text style={styles.sub}>of {org.orgTarget.toLocaleString()} · {org.orgPacingLabel}</Text>
          </View>
          <Text style={styles.section}>Reps</Text>
          {org.reps.map((r) => (
            <View key={r.userId} style={styles.repRow}>
              <Text style={styles.repName}>{r.name}</Text>
              <Text style={styles.repMeta}>
                {r.wonRevenue.toLocaleString()} / {r.target.toLocaleString()} · {r.pacingLabel}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: '#94a3b8', textAlign: 'center' },
  link: { color: '#38bdf8', marginTop: 16, fontWeight: '600' },
  error: { color: '#f87171', marginBottom: 12 },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16 },
  period: { color: '#94a3b8', fontSize: 13 },
  big: { color: '#f8fafc', fontSize: 28, fontWeight: '800', marginTop: 8 },
  sub: { color: '#cbd5e1', marginTop: 4 },
  badge: { color: '#38bdf8', fontWeight: '700', marginTop: 10 },
  section: { color: '#94a3b8', fontWeight: '600', marginBottom: 8, fontSize: 12, textTransform: 'uppercase' },
  repRow: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  repName: { color: '#f8fafc', fontWeight: '600' },
  repMeta: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
});
