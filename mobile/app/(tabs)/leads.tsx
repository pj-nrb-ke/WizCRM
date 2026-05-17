import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, type Lead } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function LeadsScreen() {
  const { signOut } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api<{ leads: Lead[] }>('/leads');
    setLeads(data.leads);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

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
      <FlatList
        data={leads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor="#38bdf8" />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/lead/${item.id}`)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.stage} · {item.company ?? item.phone ?? item.email ?? '—'}
            </Text>
          </Pressable>
        )}
      />
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
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  name: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  meta: { color: '#64748b', marginTop: 4 },
});
