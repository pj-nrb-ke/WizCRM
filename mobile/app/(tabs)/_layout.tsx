import { Tabs } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Redirect } from 'expo-router';

export default function TabsLayout() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#1e293b' },
        tabBarActiveTintColor: '#38bdf8',
        tabBarInactiveTintColor: '#64748b',
      }}
    >
      <Tabs.Screen name="desk" options={{ title: 'Desk' }} />
      <Tabs.Screen name="leads" options={{ title: 'Leads' }} />
      <Tabs.Screen name="pipeline" options={{ title: 'Pipeline' }} />
    </Tabs>
  );
}
