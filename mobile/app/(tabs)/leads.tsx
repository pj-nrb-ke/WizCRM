import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, type Lead } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';
import { oneParam } from '../../lib/route-params';

function leadsApiPath(teamId?: string, ownerId?: string): string {
  const qs = new URLSearchParams();
  if (teamId) qs.set('teamId', teamId);
  if (ownerId) qs.set('ownerId', ownerId);
  const q = qs.toString();
  return q ? `/leads?${q}` : '/leads';
}

export default function LeadsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    teamId?: string | string[];
    ownerId?: string | string[];
    title?: string | string[];
  }>();
  const teamId = oneParam(params.teamId);
  const ownerId = oneParam(params.ownerId);
  const filterTitle = oneParam(params.title);
  const isManager = isManagerRole(user?.role);
  const hasFilter = Boolean(teamId || ownerId);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else {
        setInitialLoading(true);
        setLeads([]);
      }
      setError('');
      try {
        const data = await api<{ leads: Lead[] }>(leadsApiPath(teamId, ownerId));
        setLeads(data.leads);
      } catch (e) {
        const err = e as Error;
        setError(err.message);
        setLeads([]);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [teamId, ownerId],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  function clearFilter() {
    router.replace('/(tabs)/leads');
  }

  function goToAllTeams() {
    router.replace('/(tabs)/team');
  }

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => {
      const hay = [l.name, l.company, l.email, l.phone, l.stage, l.owner?.name, l.owner?.team?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, search]);

  const screenTitle = filterTitle
    ? `Leads: ${filterTitle}`
    : isManager
      ? 'All leads'
      : 'My leads';

  return (
    <View style={styles.container}>
      {isManager && hasFilter ? (
        <View style={styles.filterBar}>
          <Pressable onPress={goToAllTeams} style={styles.filterLink}>
            <Text style={styles.filterLinkText}>All teams</Text>
          </Pressable>
          <Text style={styles.filterSep}> / </Text>
          <Text style={styles.filterCurrent} numberOfLines={1}>
            {filterTitle ?? 'Filtered'}
          </Text>
          <Pressable onPress={clearFilter} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>All leads</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.screenTitle}>{screenTitle}</Text>
        <View style={styles.headerRight}>
          {!isManager ? (
            <Pressable style={styles.addBtn} onPress={() => router.push('/lead/new')}>
              <Text style={styles.addBtnText}>+ New lead</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search leads…"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {initialLoading && leads.length === 0 ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={filteredLeads}
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
              {search.trim()
                ? 'No leads match your search.'
                : hasFilter
                  ? 'No leads for this filter.'
                  : 'No leads yet.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/lead/${item.id}`)}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.stage} · {item.company ?? item.phone ?? item.email ?? '—'}
              </Text>
              {isManager && item.owner ? (
                <Text style={styles.owner}>
                  {item.owner.name}
                  {item.owner.team ? ` · ${item.owner.team.name}` : ''}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    flexWrap: 'wrap',
  },
  filterLink: { paddingVertical: 4 },
  filterLinkText: { color: '#38bdf8', fontWeight: '600', fontSize: 14 },
  filterSep: { color: '#64748b' },
  filterCurrent: { color: '#94a3b8', fontSize: 14, flexShrink: 1 },
  clearBtn: { marginLeft: 'auto', paddingVertical: 4 },
  clearBtnText: { color: '#64748b', fontSize: 13 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: 8,
  },
  headerRight: { alignItems: 'flex-end' },
  screenTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', flex: 1 },
  addBtn: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addBtnText: { color: '#0f172a', fontWeight: '700' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  error: { color: '#f87171', paddingHorizontal: 16, marginBottom: 8 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  name: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  meta: { color: '#64748b', marginTop: 4 },
  owner: { color: '#94a3b8', marginTop: 4, fontSize: 13 },
});
