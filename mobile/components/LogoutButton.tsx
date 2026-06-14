import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export function LogoutButton() {
  const { user, signOut } = useAuth();

  function onPress() {
    Alert.alert('Sign out', `Sign out as ${user?.email ?? 'current user'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  }

  return (
    <Pressable onPress={onPress} style={styles.btn} hitSlop={8}>
      <Text style={styles.text}>Log out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { marginRight: 12, paddingVertical: 4, paddingHorizontal: 4 },
  text: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
