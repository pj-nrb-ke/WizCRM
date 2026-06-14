import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { clearToken } from '../lib/api';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('WizCRM render error:', error);
  }

  private async signOutAndLogin() {
    await clearToken();
    this.setState({ error: null });
    router.replace('/login');
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error.message}</Text>
          </ScrollView>
          <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => this.signOutAndLogin()}>
            <Text style={styles.btnTextSecondary}>Log out</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    justifyContent: 'center',
  },
  title: { color: '#f8fafc', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  scroll: { maxHeight: 200, marginBottom: 20 },
  message: { color: '#94a3b8', lineHeight: 20 },
  btn: {
    backgroundColor: '#38bdf8',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#64748b',
  },
  btnText: { color: '#0f172a', fontWeight: '700', textAlign: 'center' },
  btnTextSecondary: { color: '#94a3b8', fontWeight: '600', textAlign: 'center' },
});
