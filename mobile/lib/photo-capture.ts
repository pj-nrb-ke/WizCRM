import { api } from './api';
import { type CardImageAsset } from './card-scan';

export type PhotoCaptureCategory = 'EXHIBITION_TENDER' | 'BILLBOARD_SIGNBOARD';

export type PhotoCaptureFields = {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  eventName?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  venue?: string;
  whatFor?: string;
  participationFee?: string;
  pitchNote: string;
};

function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export async function assetBase64(asset: CardImageAsset): Promise<{ data: string; mimeType: string }> {
  let data = asset.base64?.replace(/^data:image\/[a-z+]+;base64,/, '') ?? '';
  if (!data) {
    const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
    data = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
  }
  if (!data) {
    throw new Error('Could not read the photo. Try another image.');
  }
  return { data, mimeType: asset.mimeType ?? mimeFromUri(asset.uri) };
}

export async function analyzePhotoCapture(
  asset: CardImageAsset,
  category: PhotoCaptureCategory,
): Promise<PhotoCaptureFields> {
  const { data, mimeType } = await assetBase64(asset);
  const { fields } = await api<{ fields: PhotoCaptureFields }>('/ai/photo-capture', {
    method: 'POST',
    body: { imageBase64: data, imageMimeType: mimeType, category },
    timeoutMs: 45_000,
  });
  return fields;
}

export function extFromMimeType(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'jpg';
}

export { pickBusinessCardImage as pickCapturePhoto, pickBusinessCardFromGallery as pickCapturePhotoFromGallery } from './card-scan';
