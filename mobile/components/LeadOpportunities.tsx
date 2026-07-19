import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { isManagerRole } from '../lib/roles';
import { SALES_OPP_STAGE_LABELS, SALES_OPP_STATUS_LABELS } from '../lib/opportunity-labels';
import { SalesOpportunitySheet } from './SalesOpportunitySheet';
import { LeadTeamChat } from './LeadTeamChat';
import { OpportunityTasks } from './OpportunityTasks';
import { OpportunityExpenses } from './OpportunityExpenses';
import { OpportunitySummaryStrip } from './OpportunitySummaryStrip';
import { OpportunityCommission } from './OpportunityCommission';

type Opportunity = {
  id: string;
  referenceNumber: string;
  description: string;
  oppStage: string;
  oppStatus: string;
  probabilityPct: number;
  expectedValue: number | null;
  owner?: { id: string; name: string };
};

type Props = {
  leadId: string;
  leadName: string;
  readOnly?: boolean;
};

export function LeadOpportunities({ leadId, leadName, readOnly }: Props) {
  const { user } = useAuth();
  const manager = isManagerRole(user?.role);
  const [rows, setRows] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expenseRefreshKey, setExpenseRefreshKey] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<{ opportunities: Opportunity[] }>(`/opportunities/lead/${leadId}`)
      .then((d) => setRows(d.opportunities ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Sales opportunities</Text>
      {loading ? (
        <ActivityIndicator color="#38bdf8" />
      ) : rows.length === 0 ? (
        <Text style={styles.muted}>No opportunities yet.</Text>
      ) : (
        rows.map((o) => {
          const expanded = expandedId === o.id;
          return (
            <View key={o.id} style={styles.row}>
              <Pressable onPress={() => setExpandedId(expanded ? null : o.id)}>
                <Text style={styles.ref}>
                  {expanded ? '▾' : '▸'} {o.referenceNumber}
                </Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {o.description}
                </Text>
                <Text style={styles.meta}>
                  {SALES_OPP_STAGE_LABELS[o.oppStage] ?? o.oppStage} ·{' '}
                  {SALES_OPP_STATUS_LABELS[o.oppStatus] ?? o.oppStatus} · {o.probabilityPct}%
                </Text>
              </Pressable>
              {expanded ? (
                <View style={{ marginTop: 8 }}>
                  <OpportunitySummaryStrip
                    opportunityId={o.id}
                    canView={manager || o.owner?.id === user?.id}
                    refreshKey={expenseRefreshKey}
                  />
                  <LeadTeamChat
                    leadId={leadId}
                    opportunityId={o.id}
                    showDocumentTypeTag
                    readOnly={readOnly}
                    onAttachmentUploaded={() => setExpenseRefreshKey((k) => k + 1)}
                  />
                  <OpportunityTasks opportunityId={o.id} />
                  <OpportunityExpenses
                    opportunityId={o.id}
                    canLog={o.owner?.id === user?.id}
                    onChanged={() => setExpenseRefreshKey((k) => k + 1)}
                  />
                  <OpportunityCommission
                    opportunityId={o.id}
                    canManage={manager}
                    refreshKey={expenseRefreshKey}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}
      {!readOnly ? (
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Text style={styles.addBtnText}>Add opportunity</Text>
        </Pressable>
      ) : null}
      <SalesOpportunitySheet
        visible={showForm}
        leadId={leadId}
        leadName={leadName}
        saving={saving}
        onClose={() => setShowForm(false)}
        onCreated={() => {
          setSaving(false);
          load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  section: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  muted: { color: '#64748b' },
  row: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  ref: { color: '#38bdf8', fontWeight: '600', fontSize: 13 },
  desc: { color: '#f8fafc', marginTop: 4 },
  meta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  addBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  addBtnText: { color: '#e2e8f0', fontWeight: '600' },
});
