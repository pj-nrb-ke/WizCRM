import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { LogoutButton } from './LogoutButton';

export function HeaderActions() {
  const { user } = useAuth();
  return (
    <View style={styles.row}>
      {user?.organizationName ? (
        <Text style={styles.orgText} numberOfLines={1}>
          {user.organizationName}
        </Text>
      ) : null}
      <Pressable onPress={() => router.push('/settings')} style={styles.btn} hitSlop={8}>
        <Text style={styles.text}>Settings</Text>
      </Pressable>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  orgText: { color: '#38bdf8', fontSize: 12, fontWeight: '600', marginRight: 10, maxWidth: 110 },
  btn: { marginRight: 4, paddingVertical: 4, paddingHorizontal: 4 },
  text: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
