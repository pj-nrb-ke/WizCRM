import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { clearApiUrlCache, resolveApiUrl } from '../lib/api-url-file';
import { importApiUrlFromDocument, saveApiUrlToAppStorage } from '../lib/api-url-store';
import { isManagerRole } from '../lib/roles';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('rep@wizag.local');
  const [password, setPassword] = useState('wizcrm123');
  const [apiUrlDraft, setApiUrlDraft] = useState('');
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('');
  const [apiDetails, setApiDetails] = useState('');
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);

  const refreshApiStatus = useCallback(async () => {
    clearApiUrlCache();
    const { url, source, debug } = await resolveApiUrl(true);
    setApiUrlDraft(url);
    setApiDetails(debug ?? '');
    if (source === 'build (APK default)') {
      setApiStatus('Using APK default URL (file not loaded yet).');
    } else {
      setApiStatus(`API: ${url}`);
      setShowApiDetails(false);
    }
    return { url, source, debug };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshApiStatus();
    }, [refreshApiStatus]),
  );

  async function onSaveApiUrl() {
    setError('');
    setApiBusy(true);
    try {
      const url = await saveApiUrlToAppStorage(apiUrlDraft);
      await refreshApiStatus();
      setApiStatus(`Saved. API: ${url}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save API URL');
    } finally {
      setApiBusy(false);
    }
  }

  async function onImportApiFile() {
    setError('');
    setApiBusy(true);
    try {
      const url = await importApiUrlFromDocument();
      setApiUrlDraft(url);
      await refreshApiStatus();
      setApiStatus(`Imported. API: ${url}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      if (msg !== 'No file selected.') setError(msg);
    } finally {
      setApiBusy(false);
    }
  }

  async function onLogin() {
    setError('');
    setLoading(true);
    try {
      const u = await signIn(email.trim(), password);
      router.replace(isManagerRole(u.role) ? '/(tabs)/team' : '/(tabs)/desk');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={require('../assets/icon.png')} style={styles.logo} />
        <Text style={styles.title}>WizCRM</Text>
        <Text style={styles.subtitle}>AI sales OS — Lite</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={onLogin} disabled={loading || apiBusy}>
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.sectionLabel}>PC API URL (when Wi‑Fi IP changes)</Text>
        <TextInput
          style={styles.input}
          placeholder="https://api.wizcrm.app"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={apiUrlDraft}
          onChangeText={setApiUrlDraft}
          editable={!apiBusy}
        />
        <View style={styles.apiRow}>
          <Pressable
            style={[styles.apiButton, apiBusy && styles.apiButtonDisabled]}
            onPress={() => void onSaveApiUrl()}
            disabled={apiBusy}
          >
            <Text style={styles.apiButtonText}>Save API URL</Text>
          </Pressable>
          <Pressable
            style={[styles.apiButtonSecondary, apiBusy && styles.apiButtonDisabled]}
            onPress={() => void onImportApiFile()}
            disabled={apiBusy}
          >
            <Text style={styles.apiButtonSecondaryText}>Import api-url.txt</Text>
          </Pressable>
        </View>
        {apiStatus ? <Text style={styles.hint}>{apiStatus}</Text> : null}
        <Pressable
          onPress={() => {
            void refreshApiStatus();
            setShowApiDetails((v) => !v);
          }}
        >
          <Text style={styles.reloadApi}>
            {showApiDetails ? 'Hide details' : 'Reload / show details'}
          </Text>
        </Pressable>
        {showApiDetails && apiDetails ? (
          <Text style={styles.details}>
            Pick Documents/WizCRM/api-url.txt with Import, or paste the line and tap Save.
            {'\n\n'}
            {apiDetails}
          </Text>
        ) : null}

        <Text style={styles.accounts}>
          Try: rep@wizag.local or manager@wizag.local{'\n'}Password: wizcrm123
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 24, paddingBottom: 40, flexGrow: 1, justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 24 },
  sectionLabel: { color: '#94a3b8', fontSize: 13, marginTop: 20, marginBottom: 8 },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  apiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  apiButton: {
    flex: 1,
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  apiButtonSecondary: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  apiButtonText: { color: '#0f172a', fontWeight: '600', fontSize: 13 },
  apiButtonSecondaryText: { color: '#e2e8f0', fontWeight: '600', fontSize: 13 },
  apiButtonDisabled: { opacity: 0.5 },
  error: { color: '#f87171', marginBottom: 8 },
  hint: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  reloadApi: { color: '#38bdf8', fontSize: 12, marginTop: 8, textAlign: 'center' },
  details: {
    color: '#475569',
    fontSize: 10,
    marginTop: 8,
    lineHeight: 14,
    textAlign: 'left',
  },
  accounts: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
});
