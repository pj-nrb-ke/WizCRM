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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { api, type Lead } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';
import { oneParam } from '../../lib/route-params';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];

function pipelineApiPath(teamId?: string): string {
  return teamId ? `/leads/pipeline?teamId=${encodeURIComponent(teamId)}` : '/leads/pipeline';
}

export default function PipelineScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ teamId?: string | string[]; title?: string | string[] }>();
  const teamId = oneParam(params.teamId);
  const filterTitle = oneParam(params.title);
  const isManager = isManagerRole(user?.role);

  const [pipeline, setPipeline] = useState<Record<string, Lead[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else {
        setInitialLoading(true);
        setPipeline({});
      }
      setError('');
      try {
        const data = await api<{ pipeline: Record<string, Lead[]> }>(pipelineApiPath(teamId));
        setPipeline(data.pipeline ?? {});
      } catch (e) {
        const err = e as Error;
        setError(err.message === 'Network request failed' ? 'Cannot reach the API.' : err.message);
        setPipeline({});
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [teamId],
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  function goToAllTeams() {
    router.replace('/(tabs)/team');
  }

  function clearFilter() {
    router.replace('/(tabs)/pipeline');
  }

  if (initialLoading && Object.keys(pipeline).length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  const totalCards = STAGES.reduce((n, s) => n + (pipeline[s]?.length ?? 0), 0);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#38bdf8" />
      }
    >
      {isManager && teamId ? (
        <View style={styles.filterBar}>
          <Pressable onPress={goToAllTeams}>
            <Text style={styles.filterLinkText}>All teams</Text>
          </Pressable>
          <Text style={styles.filterSep}> / </Text>
          <Text style={styles.filterCurrent}>{filterTitle ?? 'Team'}</Text>
          <Pressable onPress={clearFilter} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>All pipeline</Text>
          </Pressable>
        </View>
      ) : null}

      {filterTitle && !teamId ? (
        <View style={styles.filterBar}>
          <Text style={styles.filterCurrent}>Pipeline · {filterTitle}</Text>
          <Pressable onPress={clearFilter}>
            <Text style={styles.clearBtnText}>Show all</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {teamId && totalCards === 0 && !error ? (
        <Text style={styles.emptyTeam}>No open leads for this team.</Text>
      ) : null}
      {STAGES.map((stage) => (
        <View key={stage} style={styles.column}>
          <Text style={styles.stageTitle}>{stage}</Text>
          {(pipeline[stage] ?? []).map((lead) => (
            <Pressable
              key={lead.id}
              style={styles.card}
              onPress={() => router.push(`/lead/${lead.id}`)}
            >
              <Text style={styles.cardName}>{lead.name}</Text>
              {isManager && lead.owner ? (
                <Text style={styles.cardOwner}>
                  {lead.owner.name}
                  {lead.owner.team ? ` · ${lead.owner.team.name}` : ''}
                </Text>
              ) : null}
            </Pressable>
          ))}
          {(pipeline[stage] ?? []).length === 0 ? <Text style={styles.empty}>—</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 0,
    flexWrap: 'wrap',
  },
  filterLinkText: { color: '#38bdf8', fontWeight: '600' },
  filterSep: { color: '#64748b' },
  filterCurrent: { color: '#f8fafc', fontWeight: '600' },
  clearBtn: { marginLeft: 'auto' },
  clearBtnText: { color: '#64748b', fontSize: 13 },
  emptyTeam: { color: '#94a3b8', textAlign: 'center', padding: 24 },
  error: { color: '#f87171', padding: 16 },
  column: { padding: 16, paddingTop: 8 },
  stageTitle: { color: '#38bdf8', fontWeight: '700', marginBottom: 8 },
  card: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardName: { color: '#f8fafc', fontWeight: '600' },
  cardOwner: { color: '#64748b', fontSize: 12, marginTop: 4 },
  empty: { color: '#64748b' },
});
