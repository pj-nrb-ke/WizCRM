import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { clearApiUrlCache, resolveApiUrl } from '../lib/api-url-file';
import { importApiUrlFromDocument, saveApiUrlToAppStorage } from '../lib/api-url-store';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [apiUrl, setApiUrl] = useState('');
  const [apiSource, setApiSource] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  const refresh = useCallback(async () => {
    clearApiUrlCache();
    const r = await resolveApiUrl(true);
    setApiUrl(r.url);
    setApiSource(r.source);
    setDraft(r.url);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function onSaveUrl() {
    setBusy(true);
    setMessage('');
    try {
      const url = await saveApiUrlToAppStorage(draft);
      await refresh();
      setMessage(`Saved: ${url}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setBusy(true);
    setMessage('');
    try {
      const url = await importApiUrlFromDocument();
      setDraft(url);
      await refresh();
      setMessage(`Imported: ${url}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      if (msg !== 'No file selected.') setMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.muted}>WizCRM v{version}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Signed in</Text>
        <Text style={styles.value}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email} · {user?.role}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API server</Text>
        <Text style={styles.muted}>Source: {apiSource}</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://api.wizcrm.app"
          placeholderTextColor="#64748b"
        />
        {busy ? <ActivityIndicator color="#38bdf8" style={{ marginVertical: 8 }} /> : null}
        {message ? <Text style={styles.msg}>{message}</Text> : null}
        <Pressable style={styles.btn} onPress={() => void onSaveUrl()} disabled={busy}>
          <Text style={styles.btnText}>Save API URL</Text>
        </Pressable>
        <Pressable style={styles.btnSecondary} onPress={() => void onImport()} disabled={busy}>
          <Text style={styles.btnSecondaryText}>Import api-url.txt</Text>
        </Pressable>
        <Text style={styles.hint}>Production: https://api.wizcrm.app (no :3000)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Pilot checklist</Text>
        <Text style={styles.bullet}>• Desk → open a priority lead</Text>
        <Text style={styles.bullet}>• New lead or scan card</Text>
        <Text style={styles.bullet}>• Lead → Log call (AI)</Text>
        <Text style={styles.bullet}>• Note or voice on timeline</Text>
        <Text style={styles.bullet}>• Pipeline shows correct stage</Text>
      </View>

      <Pressable
        style={styles.signOut}
        onPress={async () => {
          await signOut();
          router.replace('/login');
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 20, paddingBottom: 40 },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700' },
  muted: { color: '#94a3b8', marginTop: 4, marginBottom: 16 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  label: { color: '#38bdf8', fontWeight: '700', marginBottom: 8 },
  value: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#f8fafc',
    marginTop: 8,
    marginBottom: 8,
  },
  msg: { color: '#4ade80', marginBottom: 8 },
  btn: {
    backgroundColor: '#38bdf8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: { color: '#0f172a', fontWeight: '700' },
  btnSecondary: {
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: { color: '#e2e8f0', fontWeight: '600' },
  hint: { color: '#64748b', fontSize: 12, marginTop: 10 },
  bullet: { color: '#e2e8f0', marginBottom: 6 },
  signOut: { padding: 16, alignItems: 'center' },
  signOutText: { color: '#f87171', fontWeight: '600' },
});
