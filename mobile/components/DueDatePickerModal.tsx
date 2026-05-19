import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  title?: string;
  onSelect: (date: Date) => void;
  onClose: () => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isBeforeToday(d: Date): boolean {
  return startOfDay(d).getTime() < startOfDay(new Date()).getTime();
}

function getCalendarCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1, 12, 0, 0, 0);
  const leading = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day, 12, 0, 0, 0));
  }
  return cells;
}

function CustomCalendar({
  viewMonth,
  onChangeMonth,
  onSelectDay,
}: {
  viewMonth: Date;
  onChangeMonth: (delta: number) => void;
  onSelectDay: (date: Date) => void;
}) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const cells = useMemo(() => getCalendarCells(year, month), [year, month]);
  const monthLabel = viewMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View>
      <View style={styles.calHeader}>
        <Pressable style={styles.calNav} onPress={() => onChangeMonth(-1)}>
          <Text style={styles.calNavText}>‹</Text>
        </Pressable>
        <Text style={styles.calMonth}>{monthLabel}</Text>
        <Pressable style={styles.calNav} onPress={() => onChangeMonth(1)}>
          <Text style={styles.calNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekLabel}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }
          const disabled = isBeforeToday(date);
          const isToday = startOfDay(date).getTime() === startOfDay(new Date()).getTime();
          return (
            <Pressable
              key={date.toISOString()}
              style={[styles.dayCell, isToday && styles.dayCellToday]}
              disabled={disabled}
              onPress={() => onSelectDay(date)}
            >
              <Text style={[styles.dayNum, disabled && styles.dayNumDisabled]}>{date.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DueDatePickerModal({ visible, title, onSelect, onClose }: Props) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
  });

  useEffect(() => {
    if (visible) {
      const d = new Date();
      setShowCalendar(false);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0));
    }
  }, [visible]);

  const quick = useMemo(() => {
    const today = new Date();
    return [
      { label: 'Today', date: addDays(today, 0) },
      { label: 'Tomorrow', date: addDays(today, 1) },
      { label: 'In 3 days', date: addDays(today, 3) },
      { label: 'In 1 week', date: addDays(today, 7) },
    ];
  }, [visible]);

  const days = useMemo(() => {
    const list: { key: string; date: Date; label: string }[] = [];
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    for (let i = 0; i < 60; i++) {
      const date = addDays(start, i);
      list.push({
        key: date.toISOString(),
        date,
        label: date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      });
    }
    return list;
  }, [visible]);

  function pick(date: Date) {
    onSelect(date);
    onClose();
  }

  function shiftMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1, 12, 0, 0, 0));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {showCalendar
              ? 'Custom due date'
              : title
                ? `Due date — ${title}`
                : 'Choose due date'}
          </Text>

          {showCalendar ? (
            <>
              <CustomCalendar
                viewMonth={viewMonth}
                onChangeMonth={shiftMonth}
                onSelectDay={pick}
              />
              <Pressable style={styles.backBtn} onPress={() => setShowCalendar(false)}>
                <Text style={styles.backBtnText}>← Back to quick picks</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.quickRow}>
                {quick.map((q) => (
                  <Pressable key={q.label} style={styles.quickChip} onPress={() => pick(q.date)}>
                    <Text style={styles.quickChipText}>{q.label}</Text>
                  </Pressable>
                ))}
              </View>
              <FlatList
                data={days}
                keyExtractor={(item) => item.key}
                style={styles.list}
                renderItem={({ item }) => (
                  <Pressable style={styles.dayRow} onPress={() => pick(item.date)}>
                    <Text style={styles.dayText}>{item.label}</Text>
                  </Pressable>
                )}
              />
              <Pressable style={styles.customBtn} onPress={() => setShowCalendar(true)}>
                <Text style={styles.customBtnText}>Custom date…</Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  title: { color: '#f8fafc', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  quickChip: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  quickChipText: { color: '#38bdf8', fontWeight: '600', fontSize: 13 },
  list: { maxHeight: 220 },
  dayRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#334155',
  },
  dayText: { color: '#e2e8f0', fontSize: 16 },
  customBtn: {
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  customBtnText: { color: '#38bdf8', fontWeight: '700', fontSize: 16 },
  backBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  backBtnText: { color: '#94a3b8', fontWeight: '600' },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calNav: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavText: { color: '#f8fafc', fontSize: 24, lineHeight: 28 },
  calMonth: { color: '#f8fafc', fontSize: 17, fontWeight: '600' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  dayCellToday: { backgroundColor: '#334155' },
  dayNum: { color: '#f8fafc', fontSize: 15, fontWeight: '500' },
  dayNumDisabled: { color: '#475569' },
  cancel: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#94a3b8', fontWeight: '600' },
});
