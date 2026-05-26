import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import {
  normalizePipelineStages,
  reorderLeadIds,
  type PipelineStageConfig,
} from '../../lib/pipeline-board';

function pipelineApiPath(teamId?: string): string {
  return teamId ? `/leads/pipeline?teamId=${encodeURIComponent(teamId)}` : '/leads/pipeline';
}

export default function PipelineScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ teamId?: string | string[]; title?: string | string[] }>();
  const teamId = oneParam(params.teamId);
  const filterTitle = oneParam(params.title);
  const isManager = isManagerRole(user?.role);

  const [stages, setStages] = useState<PipelineStageConfig[]>(normalizePipelineStages());
  const [pipeline, setPipeline] = useState<Record<string, Lead[]>>({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState(false);
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
        const data = await api<{
          stages: PipelineStageConfig[];
          pipeline: Record<string, Lead[]>;
        }>(pipelineApiPath(teamId));
        setStages(normalizePipelineStages(data.stages));
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

  async function persistColumnOrder(stage: string, ordered: Lead[]) {
    setMoving(true);
    setError('');
    const prev = pipeline;
    setPipeline({ ...prev, [stage]: ordered });
    try {
      await api('/leads/pipeline/reorder', {
        method: 'PATCH',
        body: { stage, leadIds: ordered.map((l) => l.id) },
      });
    } catch (e) {
      setPipeline(prev);
      Alert.alert('Reorder failed', e instanceof Error ? e.message : 'Could not save order');
    } finally {
      setMoving(false);
    }
  }

  async function moveLeadToStage(lead: Lead, fromStage: string, toStage: string) {
    if (fromStage === toStage || moving) return;
    if (toStage === 'WON' || toStage === 'LOST') {
      router.push(`/lead/${lead.id}`);
      Alert.alert('Close lead', 'Open the lead to mark Won or Lost with deal details.');
      return;
    }
    setMoving(true);
    setError('');
    const prev = pipeline;
    const fromList = (prev[fromStage] ?? []).filter((l) => l.id !== lead.id);
    const toList = [{ ...lead, stage: toStage }, ...(prev[toStage] ?? [])];
    setPipeline({ ...prev, [fromStage]: fromList, [toStage]: toList });
    try {
      await api(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: { stage: toStage, pipelineMove: true },
      });
      if (isManager) {
        await api('/leads/pipeline/reorder', {
          method: 'PATCH',
          body: { stage: toStage, leadIds: toList.map((l) => l.id) },
        });
      }
      load(true);
    } catch (e) {
      setPipeline(prev);
      Alert.alert('Move failed', e instanceof Error ? e.message : 'Could not change stage');
    } finally {
      setMoving(false);
    }
  }

  function showLeadActions(lead: Lead, stage: string) {
    const list = pipeline[stage] ?? [];
    const idx = list.findIndex((l) => l.id === lead.id);
    const otherStages = stages.filter((s) => s.stage !== stage);

    const buttons: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: 'Open lead', onPress: () => router.push(`/lead/${lead.id}`) },
    ];

    if (isManager && idx > 0) {
      buttons.push({
        text: 'Move up',
        onPress: () => {
          const ids = reorderLeadIds(
            list.map((l) => l.id),
            lead.id,
            'up',
          );
          void persistColumnOrder(
            stage,
            ids.map((id) => list.find((l) => l.id === id)!),
          );
        },
      });
    }
    if (isManager && idx >= 0 && idx < list.length - 1) {
      buttons.push({
        text: 'Move down',
        onPress: () => {
          const ids = reorderLeadIds(
            list.map((l) => l.id),
            lead.id,
            'down',
          );
          void persistColumnOrder(
            stage,
            ids.map((id) => list.find((l) => l.id === id)!),
          );
        },
      });
    }

    if (otherStages.length > 0) {
      buttons.push({
        text: 'Change stage…',
        onPress: () => {
          Alert.alert(
            'Move to stage',
            lead.name,
            [
              ...otherStages.map((s) => ({
                text: s.label,
                onPress: () => void moveLeadToStage(lead, stage, s.stage),
              })),
              { text: 'Cancel', style: 'cancel' },
            ],
          );
        },
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(lead.name, 'Pipeline actions', buttons);
  }

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

  const totalCards = stages.reduce((n, s) => n + (pipeline[s.stage]?.length ?? 0), 0);

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

      <Text style={styles.hint}>
        Long-press a card to change stage{isManager ? ' or reorder' : ''}. Tap to open.
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {moving ? <Text style={styles.moving}>Saving…</Text> : null}
      {teamId && totalCards === 0 && !error ? (
        <Text style={styles.emptyTeam}>No open leads for this team.</Text>
      ) : null}

      {stages.map((col) => (
        <View key={col.stage} style={styles.column}>
          <Text style={styles.stageTitle}>
            {col.label}
            <Text style={styles.stageCount}> ({(pipeline[col.stage] ?? []).length})</Text>
          </Text>
          {(pipeline[col.stage] ?? []).map((lead) => (
            <Pressable
              key={lead.id}
              style={styles.card}
              onPress={() => router.push(`/lead/${lead.id}`)}
              onLongPress={() => showLeadActions(lead, col.stage)}
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
          {(pipeline[col.stage] ?? []).length === 0 ? <Text style={styles.empty}>—</Text> : null}
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
  hint: { color: '#64748b', fontSize: 12, paddingHorizontal: 16, paddingTop: 8 },
  emptyTeam: { color: '#94a3b8', textAlign: 'center', padding: 24 },
  moving: { color: '#38bdf8', textAlign: 'center', padding: 8 },
  error: { color: '#f87171', padding: 16 },
  column: { padding: 16, paddingTop: 8 },
  stageTitle: { color: '#38bdf8', fontWeight: '700', marginBottom: 8 },
  stageCount: { color: '#64748b', fontWeight: '400' },
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
