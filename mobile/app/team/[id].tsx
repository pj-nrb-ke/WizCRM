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
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api, type TeamOverview } from '../../lib/api';
import { oneParam } from '../../lib/route-params';

function openTeamLeads(teamId: string, title: string) {
  router.push(
    `/(tabs)/leads?teamId=${encodeURIComponent(teamId)}&title=${encodeURIComponent(title)}`,
  );
}

function openTeamPipeline(teamId: string, title: string) {
  router.push(
    `/(tabs)/pipeline?teamId=${encodeURIComponent(teamId)}&title=${encodeURIComponent(title)}`,
  );
}

export default function TeamDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = oneParam(params.id);
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (!id) return;
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api<{ team: TeamOverview }>(`/teams/${id}`);
      setTeam(res.team);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  if (loading && !team) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error || 'Team not found'}</Text>
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
      <Pressable style={styles.allTeamsLink} onPress={() => router.replace('/(tabs)/team')}>
        <Text style={styles.allTeamsText}>All teams</Text>
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>{team.name}</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push({ pathname: '/team/form', params: { teamId: id } })}
        >
          <Text style={styles.editBtnText}>Edit team</Text>
        </Pressable>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>
          {team.stats.openLeads} open · {team.stats.wonLeads} won · {team.stats.overdueTasks} overdue
          · {team.stats.staleLeads} stale · {team.stats.memberCount} members
        </Text>
      </View>

      <Pressable
        style={styles.pipelineBtn}
        onPress={() => id && openTeamPipeline(id, team.name)}
      >
        <Text style={styles.pipelineBtnText}>View team pipeline</Text>
      </Pressable>

      <Text style={styles.section}>Members</Text>
      {team.members.length === 0 ? (
        <Text style={styles.empty}>No reps assigned. Tap Edit team to add members.</Text>
      ) : (
        team.members.map((m) => (
          <Pressable
            key={m.id}
            style={styles.memberCard}
            onPress={() =>
              router.push(
                `/(tabs)/leads?ownerId=${encodeURIComponent(m.id)}&title=${encodeURIComponent(m.name)}`,
              )
            }
          >
            <Text style={styles.memberName}>{m.name}</Text>
            <Text style={styles.memberEmail}>{m.email}</Text>
            <Text style={styles.memberStats}>
              {m.stats.openLeads} open · {m.stats.wonLeads ?? 0} won · {m.stats.overdueTasks} overdue
              · {m.stats.staleLeads} stale
            </Text>
            {m.stats.lastActivityAt ? (
              <Text style={styles.lastAct}>
                Last activity {new Date(m.stats.lastActivityAt).toLocaleDateString()}
              </Text>
            ) : (
              <Text style={styles.lastAct}>No recent activity</Text>
            )}
            <View style={styles.metricRow}>
              {(['open', 'stale', 'won', 'overdue'] as const).map((metric) => (
                <Pressable
                  key={metric}
                  style={styles.metricChip}
                  onPress={() =>
                    router.push({
                      pathname: '/team/metrics',
                      params: {
                        metric,
                        teamId: id!,
                        title: `${m.name} · ${metric}`,
                        ownerId: m.id,
                      },
                    })
                  }
                >
                  <Text style={styles.metricChipText}>{metric}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        ))
      )}

      <Pressable
        style={styles.leadsBtn}
        onPress={() => id && openTeamLeads(id, team.name)}
      >
        <Text style={styles.leadsBtnText}>All team leads</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  allTeamsLink: { paddingHorizontal: 16, paddingTop: 12 },
  allTeamsText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700', flex: 1 },
  editBtn: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editBtnText: { color: '#38bdf8', fontWeight: '600' },
  summary: { paddingHorizontal: 16, marginBottom: 12 },
  summaryLine: { color: '#94a3b8', lineHeight: 20 },
  pipelineBtn: {
    marginHorizontal: 16,
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  pipelineBtnText: { color: '#38bdf8', fontWeight: '600', textAlign: 'center' },
  section: {
    color: '#94a3b8',
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  empty: { color: '#64748b', paddingHorizontal: 16, marginBottom: 16 },
  memberCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  memberName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  memberEmail: { color: '#64748b', fontSize: 13, marginTop: 2 },
  memberStats: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
  lastAct: { color: '#64748b', fontSize: 12, marginTop: 4 },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  metricChip: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricChipText: { color: '#38bdf8', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  leadsBtn: {
    margin: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#38bdf8',
  },
  leadsBtnText: { color: '#0f172a', fontWeight: '700', textAlign: 'center' },
  error: { color: '#f87171' },
});
