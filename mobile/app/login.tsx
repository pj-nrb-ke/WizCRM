import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/config';
import { isManagerRole } from '../lib/roles';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('rep@wizag.local');
  const [password, setPassword] = useState('wizcrm123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <Pressable style={styles.button} onPress={onLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
      <Text style={styles.hint}>API: {API_URL}</Text>
      <Text style={styles.accounts}>
        Try: rep@wizag.local or manager@wizag.local{'\n'}Password: wizcrm123
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'center',
  },
  title: { fontSize: 32, fontWeight: '700', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32 },
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
    marginTop: 8,
  },
  buttonText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  error: { color: '#f87171', marginBottom: 8 },
  hint: { color: '#475569', fontSize: 12, marginTop: 24, textAlign: 'center' },
  accounts: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
