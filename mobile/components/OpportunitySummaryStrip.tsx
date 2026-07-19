import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';

type CostSummary = {
  budgeted: number | null;
  spent: number;
  remaining: number | null;
  revenue: number;
  margin: number | null;
  overBudget: boolean;
};

type Props = {
  opportunityId: string;
  /** Money view is owner + Manager+. */
  canView: boolean;
  refreshKey?: number;
};

function money(n: number | null) {
  if (n == null) return '—';
  return n.toLocaleString();
}

export function OpportunitySummaryStrip({ opportunityId, canView, refreshKey }: Props) {
  const [summary, setSummary] = useState<CostSummary | null>(null);

  useEffect(() => {
    if (!canView) return;
    api<{ summary: CostSummary }>(`/opportunities/${opportunityId}/summary`)
      .then((d) => setSummary(d.summary))
      .catch(() => setSummary(null));
  }, [opportunityId, canView, refreshKey]);

  if (!canView || !summary) return null;

  return (
    <View style={[styles.box, summary.overBudget && styles.boxOver]}>
      <View style={styles.item}>
        <Text style={styles.label}>Budget</Text>
        <Text style={styles.value}>{money(summary.budgeted)}</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.label}>Spent</Text>
        <Text style={styles.value}>{money(summary.spent)}</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.label}>Remaining</Text>
        <Text style={styles.value}>{money(summary.remaining)}</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.label}>Revenue</Text>
        <Text style={styles.value}>{money(summary.revenue)}</Text>
      </View>
      <View style={styles.item}>
        <Text style={styles.label}>Margin</Text>
        <Text style={styles.value}>{money(summary.margin)}</Text>
      </View>
      {summary.overBudget ? <Text style={styles.overText}>Over budget</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginBottom: 4,
  },
  boxOver: { borderWidth: 1, borderColor: '#ef4444' },
  item: { minWidth: '28%' },
  label: { color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' },
  value: { color: '#f8fafc', fontWeight: '700', fontSize: 14 },
  overText: { color: '#ef4444', fontWeight: '600', width: '100%' },
});
