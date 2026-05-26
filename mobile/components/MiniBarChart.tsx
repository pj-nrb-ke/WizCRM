import { StyleSheet, Text, View } from 'react-native';

type Bar = { label: string; value: number; color?: string };

type Props = {
  title?: string;
  bars: Bar[];
  maxValue?: number;
};

export function MiniBarChart({ title, bars, maxValue }: Props) {
  const max = maxValue ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {bars.map((b) => (
        <View key={b.label} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {b.label}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, (b.value / max) * 100)}%`,
                  backgroundColor: b.color ?? '#38bdf8',
                },
              ]}
            />
          </View>
          <Text style={styles.value}>{b.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  title: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 72, color: '#cbd5e1', fontSize: 11 },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 28, textAlign: 'right', color: '#f8fafc', fontSize: 12, fontWeight: '600' },
});
