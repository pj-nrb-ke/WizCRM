import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, getToken } from './api';
import { getApiUrl } from './api-url-file';

export type ProductDocument = {
  id: string;
  title: string;
  category: string | null;
  productTags: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string } | null;
};

const CACHE_FILE = `${FileSystem.documentDirectory}documents-cache.json`;

export async function listDocuments(params?: { q?: string; category?: string }): Promise<ProductDocument[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.category) qs.set('category', params.category);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await api<{ documents: ProductDocument[] }>(`/documents${suffix}`);
  return res.documents;
}

export async function saveDocumentsCache(documents: ProductDocument[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(
      CACHE_FILE,
      JSON.stringify({ savedAt: new Date().toISOString(), documents }),
    );
  } catch {
    /* ignore cache write failures */
  }
}

export async function loadDocumentsCache(): Promise<{ savedAt: string; documents: ProductDocument[] } | null> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(CACHE_FILE);
    const parsed = JSON.parse(raw) as { savedAt?: string; documents?: ProductDocument[] };
    if (!parsed.documents) return null;
    return { savedAt: parsed.savedAt ?? '', documents: parsed.documents };
  } catch {
    return null;
  }
}

function sanitize(name: string): string {
  return name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 120) || 'document';
}

/**
 * Downloads the document (with the auth header the file endpoint requires) into the
 * cache, then opens the OS share/open sheet — from which the rep can view it in a PDF
 * app or send it to the customer on WhatsApp. Cached per version, so a re-upload refetches.
 */
export async function openDocument(doc: ProductDocument): Promise<void> {
  const localUri = `${FileSystem.cacheDirectory}${doc.id}-v${doc.version}-${sanitize(doc.fileName)}`;
  const existing = await FileSystem.getInfoAsync(localUri);
  if (!existing.exists) {
    const token = await getToken();
    const apiUrl = await getApiUrl();
    const result = await FileSystem.downloadAsync(`${apiUrl}/documents/${doc.id}/file`, localUri, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (result.status !== 200) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
      throw new Error(`Download failed (${result.status})`);
    }
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Opening files is not available on this device');
  }
  await Sharing.shareAsync(localUri, {
    mimeType: doc.mimeType || 'application/octet-stream',
    dialogTitle: doc.title,
  });
}
