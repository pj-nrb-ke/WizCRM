import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isManagerRole } from '../../lib/roles';
import { KpiRow, type KpiItem } from '../../components/KpiRow';

type ConversionFunnelRow = {
  stage: string;
  reached: number;
  pctOfTotal: number;
  pctFromPrevious: number | null;
};

type TimeInStageRow = {
  stage: string;
  avgDays: number;
  samples: number;
};

type ReportSummary = {
  totalLeads: number;
  openLeads: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  conversionFunnel?: ConversionFunnelRow[];
  timeInStage?: TimeInStageRow[];
};

type AttendanceReport = {
  summary: {
    totalMeetings: number;
    checkedIn: number;
    checkedOut: number;
    onTime: number;
    late: number;
    noShow: number;
    partial: number;
    geofenceOverride: number;
    missingCheckIn: number;
  };
  rows: {
    id: string;
    title: string;
    startAt: string;
    userName: string;
    leadName: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    attendanceStatus: string | null;
    geofenceOverride: boolean;
    checkInDistanceM: number | null;
  }[];
};

export default function ReportsScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isPull = false) => {
    if (!user || !isManagerRole(user.role)) return;
    if (isPull) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [reportsRes, attendanceRes] = await Promise.all([
        api<{ summary: ReportSummary }>('/reports/summary'),
        api<{ report: AttendanceReport }>('/calendar/attendance/report').catch(() => ({ report: null })),
      ]);
      setSummary(reportsRes.summary);
      setAttendance(attendanceRes.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
      setSummary(null);
      setAttendance(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useRefreshOnFocus(useCallback(() => load(false), [load]));

  if (!user || !isManagerRole(user.role)) {
    return <Redirect href="/(tabs)/desk" />;
  }

  const kpis: KpiItem[] = summary
    ? [
        { key: 'total', label: 'Total', value: summary.totalLeads },
        { key: 'open', label: 'Open', value: summary.openLeads },
        { key: 'won', label: 'Won', value: summary.wonCount },
        { key: 'lost', label: 'Lost', value: summary.lostCount },
      ]
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#38bdf8" />}
    >
      <Text style={styles.hint}>Org summary — last 30 days where applicable.</Text>
      {loading && !summary ? (
        <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : summary ? (
        <>
          <KpiRow items={kpis} />
          {summary.winRate != null ? (
            <Text style={styles.winRate}>
              Win rate: {Math.round(summary.winRate * 100)}% (closed leads)
            </Text>
          ) : null}
          <Text style={styles.section}>Conversion funnel</Text>
          {(summary.conversionFunnel ?? []).length === 0 ? (
            <Text style={styles.muted}>No funnel data yet.</Text>
          ) : (
            (summary.conversionFunnel ?? []).map((row) => (
              <View key={row.stage} style={styles.row}>
                <Text style={styles.rowTitle}>{row.stage}</Text>
                <Text style={styles.rowMeta}>
                  {row.reached} leads · {Math.round(row.pctOfTotal)}% of total
                  {row.pctFromPrevious != null
                    ? ` · ${Math.round(row.pctFromPrevious)}% from prev`
                    : ''}
                </Text>
              </View>
            ))
          )}
          <Text style={styles.section}>Time in stage (avg days)</Text>
          {(summary.timeInStage ?? []).length === 0 ? (
            <Text style={styles.muted}>No stage timing data yet.</Text>
          ) : (
            (summary.timeInStage ?? []).map((row) => (
              <View key={row.stage} style={styles.row}>
                <Text style={styles.rowTitle}>{row.stage}</Text>
                <Text style={styles.rowMeta}>
                  {row.avgDays.toFixed(1)}d avg · {row.samples} samples
                </Text>
              </View>
            ))
          )}

          <Text style={styles.section}>Attendance (field visits)</Text>
          {!attendance ? (
            <Text style={styles.muted}>No attendance data yet.</Text>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowTitle}>Last 30 days</Text>
                <Text style={styles.rowMeta}>
                  {attendance.summary.totalMeetings} meetings · {attendance.summary.checkedIn} checked in ·{' '}
                  {attendance.summary.late} late · {attendance.summary.geofenceOverride} overrides
                </Text>
              </View>
              {attendance.rows.slice(0, 12).map((r) => (
                <View key={r.id} style={styles.row}>
                  <Text style={styles.rowTitle}>
                    {new Date(r.startAt).toLocaleDateString()} · {r.userName}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {r.title}
                    {r.leadName ? ` · ${r.leadName}` : ''}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {r.checkInAt ? `In ${new Date(r.checkInAt).toLocaleTimeString()}` : 'No check-in'}
                    {r.attendanceStatus ? ` · ${r.attendanceStatus}` : ''}
                    {r.checkInDistanceM != null ? ` · ${r.checkInDistanceM}m` : ''}
                    {r.geofenceOverride ? ' · override' : ''}
                  </Text>
                </View>
              ))}
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 32 },
  hint: { color: '#64748b', fontSize: 13, marginBottom: 12 },
  winRate: { color: '#94a3b8', fontSize: 14, marginTop: 8 },
  section: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginTop: 20, marginBottom: 10 },
  muted: { color: '#64748b' },
  error: { color: '#f87171', marginTop: 12 },
  row: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  rowTitle: { color: '#f8fafc', fontWeight: '600' },
  rowMeta: { color: '#94a3b8', fontSize: 13, marginTop: 4 },
});
