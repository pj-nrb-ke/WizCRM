import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LogoutButton } from './LogoutButton';

export function HeaderActions() {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push('/settings')} style={styles.btn} hitSlop={8}>
        <Text style={styles.text}>Settings</Text>
      </Pressable>
      <LogoutButton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  btn: { marginRight: 4, paddingVertical: 4, paddingHorizontal: 4 },
  text: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
});
