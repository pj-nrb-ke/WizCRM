import { StyleSheet, Text, View } from 'react-native';
import type { Entitlements } from '../lib/entitlements';

type Props = { entitlements: Entitlements | null };

export function LicenseBanner({ entitlements }: Props) {
  if (!entitlements?.banner) return null;
  const warn =
    entitlements.licenseStatus === 'expired' || entitlements.licenseStatus === 'read_only';
  return (
    <View style={[styles.banner, warn && styles.bannerWarn]}>
      <Text style={styles.plan}>{entitlements.plan.toUpperCase()}</Text>
      <Text style={styles.text}>{entitlements.banner}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#172554',
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  bannerWarn: { backgroundColor: '#451a03' },
  plan: { color: '#93c5fd', fontWeight: '700', fontSize: 11, marginBottom: 4 },
  text: { color: '#e2e8f0', fontSize: 13 },
});
