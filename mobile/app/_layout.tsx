import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LogoutButton } from '../components/LogoutButton';
import { AppErrorBoundary } from '../components/AppErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="lead/[id]"
          options={{
            headerShown: true,
            title: 'Lead',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f8fafc',
            headerRight: () => <LogoutButton />,
          }}
        />
        <Stack.Screen
          name="lead/new"
          options={{
            headerShown: true,
            title: 'New lead',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f8fafc',
            headerRight: () => <LogoutButton />,
          }}
        />
        <Stack.Screen
          name="lead/post-call"
          options={{
            headerShown: true,
            title: 'Log call',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f8fafc',
            headerRight: () => <LogoutButton />,
          }}
        />
        <Stack.Screen
          name="team/[id]"
          options={{
            headerShown: true,
            title: 'Team',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f8fafc',
            headerRight: () => <LogoutButton />,
          }}
        />
        <Stack.Screen
          name="team/form"
          options={{
            headerShown: true,
            title: 'Design team',
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#f8fafc',
            headerRight: () => <LogoutButton />,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
