import { Pressable, StyleSheet, Text, View } from 'react-native';

export type KpiItem = {
  key: string;
  label: string;
  value: number;
  warn?: boolean;
  onPress?: () => void;
};

export function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={[styles.pill, item.warn && item.value > 0 && styles.pillWarn]}
          onPress={item.onPress}
          disabled={!item.onPress}
        >
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 76,
    alignItems: 'center',
  },
  pillWarn: { borderWidth: 1, borderColor: '#f59e0b' },
  value: { color: '#f8fafc', fontWeight: '700', fontSize: 18 },
  label: { color: '#64748b', fontSize: 11, marginTop: 2, textAlign: 'center' },
});
