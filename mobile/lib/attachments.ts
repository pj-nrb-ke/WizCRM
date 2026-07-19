import { api, getToken } from './api';

/**
 * A photo or voice note captured on the Visit Report screen and uploaded as a
 * lead attachment (POST /leads/:leadId/attachments). Held in memory as base64
 * until the report is saved, so captures survive going offline mid-visit.
 */
export type CapturedAttachment = {
  id: string;
  kind: 'photo' | 'voice' | 'video' | 'document';
  fileName: string;
  mimeType: string;
  dataBase64: string;
  sizeLabel: string;
};

// Server caps decoded attachments at ~5MB; base64 inflates bytes by ~4/3.
const MAX_BASE64_LEN = 7_000_000;

export function isAttachmentTooLarge(dataBase64: string): boolean {
  return dataBase64.length > MAX_BASE64_LEN;
}

function sizeLabelFromBase64(b64: string): string {
  const bytes = Math.floor((b64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readBase64FromUri(uri: string): Promise<string> {
  const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
  return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.heic')) return 'image/heic';
  return 'image/jpeg';
}

// quality 0.6 keeps field photos comfortably under the 5MB cap on poor networks.
const PHOTO_OPTIONS = { quality: 0.6, base64: true, allowsEditing: false } as const;

export async function capturePhoto(source: 'camera' | 'gallery'): Promise<CapturedAttachment | null> {
  const ImagePicker = await import('expo-image-picker');
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission is required to take a photo.'
        : 'Photo library permission is required to choose a photo.',
    );
  }
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(PHOTO_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PHOTO_OPTIONS);
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  let data = asset.base64?.replace(/^data:[^;]+;base64,/, '') ?? '';
  if (!data) data = await readBase64FromUri(asset.uri);
  if (!data) throw new Error('Could not read the photo. Try again.');

  const mimeType = asset.mimeType ?? mimeFromUri(asset.uri);
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  return {
    id: newId(),
    kind: 'photo',
    fileName: `visit-photo-${Date.now()}.${ext}`,
    mimeType,
    dataBase64: data,
    sizeLabel: sizeLabelFromBase64(data),
  };
}

export async function captureDocument(source: 'camera' | 'gallery'): Promise<CapturedAttachment | null> {
  const photo = await capturePhoto(source);
  if (!photo) return null;
  return { ...photo, kind: 'document', fileName: photo.fileName.replace('visit-photo-', 'visit-doc-') };
}

// Short + low-res so a clip has a real chance of fitting the 5MB attachment cap.
const VIDEO_OPTIONS = { videoMaxDuration: 12, quality: 0 as const, base64: false } as const;

export async function captureVideo(): Promise<CapturedAttachment | null> {
  const ImagePicker = await import('expo-image-picker');
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Camera permission is required to record a video.');
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], ...VIDEO_OPTIONS });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const data = await readBase64FromUri(asset.uri);
  if (!data) throw new Error('Could not read the video. Try again.');
  if (isAttachmentTooLarge(data)) {
    throw new Error('That video is too large (over ~5MB) — try recording a shorter clip.');
  }

  return {
    id: newId(),
    kind: 'video',
    fileName: `visit-video-${Date.now()}.mp4`,
    mimeType: asset.mimeType ?? 'video/mp4',
    dataBase64: data,
    sizeLabel: sizeLabelFromBase64(data),
  };
}

export function buildVoiceAttachment(dataBase64: string): CapturedAttachment {
  return {
    id: newId(),
    kind: 'voice',
    fileName: `voice-note-${Date.now()}.m4a`,
    mimeType: 'audio/m4a',
    dataBase64,
    sizeLabel: sizeLabelFromBase64(dataBase64),
  };
}

/** Human summary for the report body, e.g. "2 photos, 1 voice note". */
export function summarizeAttachments(list: CapturedAttachment[]): string {
  const photos = list.filter((a) => a.kind === 'photo').length;
  const voices = list.filter((a) => a.kind === 'voice').length;
  const videos = list.filter((a) => a.kind === 'video').length;
  const docs = list.filter((a) => a.kind === 'document').length;
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
  if (docs) parts.push(`${docs} document${docs > 1 ? 's' : ''}`);
  if (videos) parts.push(`${videos} video${videos > 1 ? 's' : ''}`);
  if (voices) parts.push(`${voices} voice note${voices > 1 ? 's' : ''}`);
  return parts.join(', ');
}

/** Payload shape shared by the live upload and the offline queue replay. */
export function attachmentPayload(file: CapturedAttachment, visitId?: string) {
  return { fileName: file.fileName, mimeType: file.mimeType, dataBase64: file.dataBase64, visitId };
}

export async function uploadAttachment(leadId: string, file: CapturedAttachment, visitId?: string): Promise<void> {
  await api(`/leads/${leadId}/attachments`, { method: 'POST', body: attachmentPayload(file, visitId) });
}

export type LeadAttachmentMeta = {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  visitId?: string | null;
};

export async function listAttachmentsForVisit(leadId: string, visitId: string): Promise<LeadAttachmentMeta[]> {
  const { attachments } = await api<{ attachments: LeadAttachmentMeta[] }>(`/leads/${leadId}/attachments`);
  return attachments.filter((a) => a.visitId === visitId);
}

function isInlineViewable(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('image/');
}

/** Most recent viewable (image/pdf) attachment on a lead — e.g. the original photo-capture flyer. */
export async function findLeadPhoto(leadId: string): Promise<LeadAttachmentMeta | null> {
  const { attachments } = await api<{ attachments: LeadAttachmentMeta[] }>(`/leads/${leadId}/attachments`);
  return (attachments ?? []).find((a) => isInlineViewable(a.mimeType)) ?? null;
}

/** Downloads an attachment to a local cache file (with auth header) so <Image> can render it. */
export async function downloadLeadAttachment(leadId: string, attachment: LeadAttachmentMeta): Promise<string> {
  const { downloadAsync, cacheDirectory } = await import('expo-file-system/legacy');
  const { getApiUrl } = await import('./api-url-file');
  const apiUrl = await getApiUrl();
  const token = await getToken();
  const ext = attachment.fileName.split('.').pop() ?? 'jpg';
  const dest = `${cacheDirectory}lead-photo-${attachment.id}.${ext}`;
  const result = await downloadAsync(`${apiUrl}/leads/${leadId}/attachments/${attachment.id}`, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return result.uri;
}
