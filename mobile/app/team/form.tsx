import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';

type AssignableUser = {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
};

export default function TeamFormScreen() {
  const { teamId } = useLocalSearchParams<{ teamId?: string }>();
  const isEdit = Boolean(teamId);
  const [name, setName] = useState('');
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ users: assignable }, teamRes] = await Promise.all([
        api<{ users: AssignableUser[] }>('/teams/assignable-users'),
        isEdit && teamId
          ? api<{ team: { id: string; name: string; members: { id: string }[] } }>(`/teams/${teamId}`)
          : Promise.resolve(null),
      ]);
      setUsers(assignable);
      if (teamRes) {
        setName(teamRes.team.name);
        setSelected(new Set(teamRes.team.members.map((m) => m.id)));
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [isEdit, teamId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function toggleUser(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a team name.');
      return;
    }
    setSaving(true);
    try {
      let id = teamId;
      if (isEdit && teamId) {
        await api(`/teams/${teamId}`, { method: 'PATCH', body: { name: trimmed } });
      } else {
        const created = await api<{ team: { id: string } }>('/teams', {
          method: 'POST',
          body: { name: trimmed },
        });
        id = created.team.id;
      }
      if (id) {
        await api(`/teams/${id}/members`, {
          method: 'PUT',
          body: { userIds: [...selected] },
        });
      }
      router.replace(id ? `/team/${id}` : '/(tabs)/team');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save team');
    } finally {
      setSaving(false);
    }
  }

  async function removeTeam() {
    if (!teamId) return;
    Alert.alert('Delete team', 'Reps will be unassigned but keep their leads.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/teams/${teamId}`, { method: 'DELETE' });
            router.replace('/(tabs)/team');
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.allTeamsLink} onPress={() => router.replace('/(tabs)/team')}>
        <Text style={styles.allTeamsText}>All teams</Text>
      </Pressable>
      <Text style={styles.label}>Team name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Field Sales"
        placeholderTextColor="#64748b"
      />

      <Text style={styles.label}>Assign sales reps</Text>
      <Text style={styles.hint}>
        Reps can belong to one team. Saving moves selected reps to this team.
      </Text>
      {users.map((u) => {
        const onOtherTeam = u.teamId && u.teamId !== teamId;
        const checked = selected.has(u.id);
        return (
          <Pressable
            key={u.id}
            style={[styles.userRow, checked && styles.userRowSelected]}
            onPress={() => toggleUser(u.id)}
          >
            <View style={[styles.checkbox, checked && styles.checkboxOn]}>
              {checked ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{u.name}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
              {onOtherTeam ? (
                <Text style={styles.userWarn}>Currently on another team — will move here</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={save} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : isEdit ? 'Save team' : 'Create team'}</Text>
      </Pressable>

      {isEdit ? (
        <Pressable style={styles.deleteBtn} onPress={removeTeam}>
          <Text style={styles.deleteBtnText}>Delete team</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  centered: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  allTeamsLink: { marginBottom: 8 },
  allTeamsText: { color: '#38bdf8', fontSize: 16, fontWeight: '600' },
  label: { color: '#94a3b8', fontWeight: '600', marginBottom: 8, marginTop: 8 },
  hint: { color: '#64748b', fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 8,
  },
  userRowSelected: { borderWidth: 1, borderColor: '#38bdf8' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#64748b',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
  checkmark: { color: '#0f172a', fontWeight: '700', fontSize: 14 },
  userInfo: { flex: 1 },
  userName: { color: '#f8fafc', fontWeight: '600' },
  userEmail: { color: '#64748b', fontSize: 13 },
  userWarn: { color: '#fbbf24', fontSize: 12, marginTop: 4 },
  saveBtn: {
    backgroundColor: '#38bdf8',
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#0f172a', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  deleteBtn: { padding: 16, marginTop: 8, marginBottom: 32 },
  deleteBtnText: { color: '#f87171', textAlign: 'center', fontWeight: '600' },
});
