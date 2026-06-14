import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  tags: string[];
  suggestions?: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

export function LeadTagsEditor({ tags, suggestions = [], onChange, disabled }: Props) {
  const [draft, setDraft] = useState('');

  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || tags.length >= 20) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onChange([...tags, t]);
    setDraft('');
  }

  const unused = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()),
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {tags.length === 0 ? (
          <Text style={styles.muted}>No tags</Text>
        ) : (
          tags.map((tag) => (
            <View key={tag} style={styles.chip}>
              <Text style={styles.chipText}>{tag}</Text>
              {!disabled ? (
                <Pressable onPress={() => onChange(tags.filter((t) => t !== tag))} hitSlop={8}>
                  <Text style={styles.remove}>×</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>
      {!disabled ? (
        <>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Add tag"
              placeholderTextColor="#64748b"
              value={draft}
              maxLength={40}
              onChangeText={setDraft}
              onSubmitEditing={() => addTag(draft)}
            />
            <Pressable style={styles.addBtn} onPress={() => addTag(draft)}>
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          {unused.length > 0 ? (
            <View style={styles.suggestions}>
              {unused.slice(0, 8).map((s) => (
                <Pressable key={s} style={styles.suggestion} onPress={() => addTag(s)}>
                  <Text style={styles.suggestionText}>+ {s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: '#e2e8f0', fontSize: 13 },
  remove: { color: '#94a3b8', fontSize: 16 },
  muted: { color: '#64748b', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    color: '#f8fafc',
  },
  addBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnText: { color: '#0f172a', fontWeight: '700' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  suggestion: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suggestionText: { color: '#38bdf8', fontSize: 12 },
});
