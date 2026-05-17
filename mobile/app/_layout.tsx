import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lead/[id]" options={{ headerShown: true, title: 'Lead' }} />
        <Stack.Screen name="lead/new" options={{ headerShown: true, title: 'New lead' }} />
        <Stack.Screen name="lead/post-call" options={{ headerShown: true, title: 'Log call' }} />
      </Stack>
    </AuthProvider>
  );
}
