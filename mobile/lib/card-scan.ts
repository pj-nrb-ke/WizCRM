import { api } from './api';

export type CardFields = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
};

export type CardImageAsset = {
  uri: string;
  base64?: string | null;
  mimeType?: string | null;
};

const PICK_OPTIONS = {
  quality: 0.85,
  base64: true,
  allowsEditing: true,
} as const;

function mimeFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function readBase64FromUri(uri: string): Promise<string> {
  const { readAsStringAsync, EncodingType } = await import('expo-file-system/legacy');
  return readAsStringAsync(uri, { encoding: EncodingType.Base64 });
}

async function assetBase64(asset: CardImageAsset): Promise<{ data: string; mimeType: string }> {
  let data = asset.base64?.replace(/^data:image\/[a-z+]+;base64,/, '') ?? '';
  if (!data) {
    data = await readBase64FromUri(asset.uri);
  }
  if (!data) {
    throw new Error('Could not read the photo. Try another image.');
  }
  const mimeType = asset.mimeType ?? mimeFromUri(asset.uri);
  return { data, mimeType };
}

export async function scanBusinessCardAsset(asset: CardImageAsset): Promise<CardFields> {
  const { data, mimeType } = await assetBase64(asset);
  const { fields } = await api<{ fields: Record<string, string | undefined> }>('/ai/card-parse', {
    method: 'POST',
    body: { imageBase64: data, imageMimeType: mimeType },
  });
  return fields;
}

async function pickCardAsset(
  launch: () => Promise<{ canceled: boolean; assets: CardImageAsset[] | null }>,
): Promise<CardImageAsset | null> {
  const result = await launch();
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }
  return result.assets[0]!;
}

export async function pickBusinessCardImage(): Promise<CardImageAsset | null> {
  const ImagePicker = await import('expo-image-picker');
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Camera permission is required to scan a business card.');
  }
  return pickCardAsset(() => ImagePicker.launchCameraAsync(PICK_OPTIONS));
}

export async function pickBusinessCardFromGallery(): Promise<CardImageAsset | null> {
  const ImagePicker = await import('expo-image-picker');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Photo library permission is required to choose a business card image.');
  }
  return pickCardAsset(() => ImagePicker.launchImageLibraryAsync(PICK_OPTIONS));
}
