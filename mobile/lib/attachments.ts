import { api } from './api';

/**
 * A photo or voice note captured on the Visit Report screen and uploaded as a
 * lead attachment (POST /leads/:leadId/attachments). Held in memory as base64
 * until the report is saved, so captures survive going offline mid-visit.
 */
export type CapturedAttachment = {
  id: string;
  kind: 'photo' | 'voice';
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
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
  if (voices) parts.push(`${voices} voice note${voices > 1 ? 's' : ''}`);
  return parts.join(', ');
}

/** Payload shape shared by the live upload and the offline queue replay. */
export function attachmentPayload(file: CapturedAttachment) {
  return { fileName: file.fileName, mimeType: file.mimeType, dataBase64: file.dataBase64 };
}

export async function uploadAttachment(leadId: string, file: CapturedAttachment): Promise<void> {
  await api(`/leads/${leadId}/attachments`, { method: 'POST', body: attachmentPayload(file) });
}
