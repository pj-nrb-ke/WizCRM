import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  listDocuments,
  saveDocumentsCache,
  loadDocumentsCache,
  openDocument,
  type ProductDocument,
} from '../../lib/product-documents';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryScreen() {
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      setFromCache(false);
      void saveDocumentsCache(docs);
    } catch (e) {
      const cached = await loadDocumentsCache();
      if (cached) {
        setDocuments(cached.documents);
        setFromCache(true);
      } else {
        setError(e instanceof Error ? e.message : 'Could not load documents');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set).sort();
  }, [documents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (activeCategory && d.category !== activeCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.category ?? '').toLowerCase().includes(q) ||
        d.productTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [documents, query, activeCategory]);

  async function onOpen(doc: ProductDocument) {
    setOpeningId(doc.id);
    try {
      await openDocument(doc);
    } catch (e) {
      Alert.alert('Open document', e instanceof Error ? e.message : 'Could not open the document');
    } finally {
      setOpeningId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search catalogs, brochures, price lists…"
        placeholderTextColor="#64748b"
      />

      {categories.length > 0 ? (
        <View style={styles.chipRow}>
          <Pressable
            style={[styles.chip, !activeCategory && styles.chipActive]}
            onPress={() => setActiveCategory(null)}
          >
            <Text style={[styles.chipText, !activeCategory && styles.chipTextActive]}>All</Text>
          </Pressable>
          {categories.map((c) => (
            <Pressable
              key={c}
              style={[styles.chip, activeCategory === c && styles.chipActive]}
              onPress={() => setActiveCategory(activeCategory === c ? null : c)}
            >
              <Text style={[styles.chipText, activeCategory === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {fromCache ? <Text style={styles.cacheNote}>Offline — showing saved library</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : styles.listPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#38bdf8"
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {documents.length === 0 ? 'No documents yet.' : 'No matches.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => onOpen(item)}
            disabled={openingId === item.id}
          >
            <View style={styles.cardMain}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.category ?? 'Uncategorised'} · {formatSize(item.sizeBytes)}
                {item.version > 1 ? ` · v${item.version}` : ''}
              </Text>
              {item.productTags.length > 0 ? (
                <Text style={styles.cardTags}>{item.productTags.join(' · ')}</Text>
              ) : null}
            </View>
            {openingId === item.id ? (
              <ActivityIndicator color="#38bdf8" />
            ) : (
              <Text style={styles.openHint}>Open ›</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  centre: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  search: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9' },
  chipText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f172a' },
  cacheNote: { color: '#fbbf24', fontSize: 12, marginTop: 12 },
  error: { color: '#f87171', marginTop: 12 },
  listPad: { paddingVertical: 12, gap: 8 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  empty: { color: '#64748b' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  cardMain: { flex: 1 },
  cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700' },
  cardMeta: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  cardTags: { color: '#38bdf8', fontSize: 12, marginTop: 4 },
  openHint: { color: '#38bdf8', fontWeight: '700' },
});
